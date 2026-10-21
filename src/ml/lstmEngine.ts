import type { DatasetRecord } from '../simulation/types';
import type { ForecastingMetrics } from './types';
import { DataPreprocessor } from './preprocessing';

export class LSTMEngine {
  private inputDim = 8;
  private hiddenDim = 12;

  // Weight matrices for Forget gate (f), Input gate (i), Candidate (c), Output gate (o)
  private Wf: number[][];
  private Wi: number[][];
  private Wc: number[][];
  private Wo: number[][];

  // Dense Output Layer weights
  private Wy: number[];
  private by: number;

  constructor() {
    this.Wf = this.initWeights(this.inputDim + this.hiddenDim, this.hiddenDim);
    this.Wi = this.initWeights(this.inputDim + this.hiddenDim, this.hiddenDim);
    this.Wc = this.initWeights(this.inputDim + this.hiddenDim, this.hiddenDim);
    this.Wo = this.initWeights(this.inputDim + this.hiddenDim, this.hiddenDim);

    this.Wy = new Array(this.hiddenDim).fill(0).map(() => (Math.random() - 0.5) * 0.2);
    this.by = 55.0; // Base temperature bias initialization
  }

  private initWeights(rows: number, cols: number): number[][] {
    const W: number[][] = [];
    const scale = Math.sqrt(2.0 / rows);
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push((Math.random() - 0.5) * scale);
      }
      W.push(row);
    }
    return W;
  }

  private sigmoid(x: number): number {
    return 1.0 / (1.0 + Math.exp(-Math.max(-15, Math.min(15, x))));
  }

  private tanh(x: number): number {
    return Math.tanh(x);
  }

  public forwardSequence(sequence: number[][]) {
    let h = new Array(this.hiddenDim).fill(0);
    let c = new Array(this.hiddenDim).fill(0);

    for (const xt of sequence) {
      const concat = [...xt, ...h];

      // 1. Forget Gate
      const f = new Array(this.hiddenDim).fill(0);
      for (let j = 0; j < this.hiddenDim; j++) {
        let sum = 0;
        for (let i = 0; i < concat.length; i++) sum += concat[i] * this.Wf[i][j];
        f[j] = this.sigmoid(sum);
      }

      // 2. Input Gate & Candidate
      const iGate = new Array(this.hiddenDim).fill(0);
      const cCand = new Array(this.hiddenDim).fill(0);
      for (let j = 0; j < this.hiddenDim; j++) {
        let sumI = 0;
        let sumC = 0;
        for (let i = 0; i < concat.length; i++) {
          sumI += concat[i] * this.Wi[i][j];
          sumC += concat[i] * this.Wc[i][j];
        }
        iGate[j] = this.sigmoid(sumI);
        cCand[j] = this.tanh(sumC);
      }

      // 3. Cell State Update
      const cNext = new Array(this.hiddenDim).fill(0);
      for (let j = 0; j < this.hiddenDim; j++) {
        cNext[j] = f[j] * c[j] + iGate[j] * cCand[j];
      }
      c = cNext;

      // 4. Output Gate & Hidden State
      const oGate = new Array(this.hiddenDim).fill(0);
      const hNext = new Array(this.hiddenDim).fill(0);
      for (let j = 0; j < this.hiddenDim; j++) {
        let sumO = 0;
        for (let i = 0; i < concat.length; i++) sumO += concat[i] * this.Wo[i][j];
        oGate[j] = this.sigmoid(sumO);
        hNext[j] = oGate[j] * this.tanh(c[j]);
      }
      h = hNext;
    }

    // Dense Regression Prediction
    let predictedTemp = this.by;
    for (let j = 0; j < this.hiddenDim; j++) {
      predictedTemp += h[j] * this.Wy[j];
    }

    return { lastH: h, predictedTemp };
  }

  public train(
    dataset: DatasetRecord[],
    seqLength: number = 10,
    epochs: number = 25,
    learningRate: number = 0.01
  ): ForecastingMetrics {
    const startTime = performance.now();

    // 1. Sliding Window Sequences
    const windows = DataPreprocessor.createSlidingWindows(dataset, seqLength);

    if (windows.length === 0) {
      return {
        rmse: 0,
        mae: 0,
        r2Score: 0,
        actualVsPredicted: [],
        trainingTimeMs: 0,
        trainSamplesCount: 0,
        testSamplesCount: 0,
      };
    }

    // 2. CHRONOLOGICAL SPLIT (Data leakage prevention for time-series)
    const { train, test } = DataPreprocessor.chronologicalSplit(windows, 0.25);

    // Initial temperature bias setting based on train mean
    const trainMeanTemp = train.reduce((sum, item) => sum + item.targetTemp, 0) / Math.max(1, train.length);
    this.by = trainMeanTemp;

    // 3. Sequential Backprop Training Loop
    for (let ep = 1; ep <= epochs; ep++) {
      for (const item of train) {
        const { lastH, predictedTemp } = this.forwardSequence(item.sequence);
        const error = predictedTemp - item.targetTemp;

        // Update Dense Output Weights
        for (let j = 0; j < this.hiddenDim; j++) {
          this.Wy[j] -= learningRate * error * lastH[j] * 0.01;
        }
        this.by -= learningRate * error * 0.01;
      }
    }

    // 4. Evaluate Test Set Forecasting Performance
    const actualVsPredicted: Array<{ timestamp: string; actual: number; predicted: number }> = [];

    let sumSquaredErr = 0;
    let sumAbsErr = 0;
    let actualSum = 0;

    for (const item of test) {
      const { predictedTemp } = this.forwardSequence(item.sequence);
      const actual = Number(item.targetTemp.toFixed(1));
      const pred = Number(Math.max(20, Math.min(150, predictedTemp)).toFixed(1));

      actualVsPredicted.push({
        timestamp: item.timestamp,
        actual,
        predicted: pred,
      });

      const err = pred - actual;
      sumSquaredErr += err * err;
      sumAbsErr += Math.abs(err);
      actualSum += actual;
    }

    const testCount = Math.max(1, test.length);
    const rmse = Number(Math.sqrt(sumSquaredErr / testCount).toFixed(2));
    const mae = Number((sumAbsErr / testCount).toFixed(2));

    const meanActual = actualSum / testCount;
    let totalVar = 0;
    for (const item of test) {
      const dev = item.targetTemp - meanActual;
      totalVar += dev * dev;
    }
    const r2Score = Number((1.0 - sumSquaredErr / (totalVar || 1)).toFixed(3));

    const endTime = performance.now();

    return {
      rmse,
      mae,
      r2Score,
      actualVsPredicted: actualVsPredicted.slice(0, 100), // Return top 100 points for chart rendering
      trainingTimeMs: Number((endTime - startTime).toFixed(1)),
      trainSamplesCount: train.length,
      testSamplesCount: test.length,
    };
  }
}
