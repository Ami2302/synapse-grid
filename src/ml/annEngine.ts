import type { DatasetRecord, OperatingState } from '../simulation/types';
import type { ClassificationMetrics, EpochLog } from './types';
import { DataPreprocessor } from './preprocessing';
import { argmax, computeClassificationMetrics } from './metrics';

export class ANNEngine {
  private inputDim: number;
  private hiddenDim1 = 16;
  private hiddenDim2 = 8;
  private outputDim = 5;

  private W1: number[][];
  private b1: number[];
  private W2: number[][];
  private b2: number[];
  private W3: number[][];
  private b3: number[];

  /** inputDim defaults to the 8 Digital Twin features; the hybrid model uses a larger enriched vector. */
  constructor(inputDim: number = 8) {
    this.inputDim = inputDim;
    this.W1 = this.initWeights(this.inputDim, this.hiddenDim1);
    this.b1 = new Array(this.hiddenDim1).fill(0.01);
    this.W2 = this.initWeights(this.hiddenDim1, this.hiddenDim2);
    this.b2 = new Array(this.hiddenDim2).fill(0.01);
    this.W3 = this.initWeights(this.hiddenDim2, this.outputDim);
    this.b3 = new Array(this.outputDim).fill(0.01);
  }

  public get architecture() {
    return { input: this.inputDim, hidden1: this.hiddenDim1, hidden2: this.hiddenDim2, output: this.outputDim };
  }

  private initWeights(rows: number, cols: number): number[][] {
    const W: number[][] = [];
    const scale = Math.sqrt(2.0 / rows); // He initialization
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push((Math.random() - 0.5) * 2 * scale);
      }
      W.push(row);
    }
    return W;
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  private reluDeriv(x: number): number {
    return x > 0 ? 1 : 0;
  }

  private softmax(arr: number[]): number[] {
    const maxVal = Math.max(...arr);
    const exps = arr.map((v) => Math.exp(v - maxVal));
    const sumExps = exps.reduce((a, b) => a + b, 0) || 1e-6;
    return exps.map((v) => v / sumExps);
  }

  public forward(x: number[]) {
    const z1 = new Array(this.hiddenDim1).fill(0);
    for (let j = 0; j < this.hiddenDim1; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < this.inputDim; i++) sum += x[i] * this.W1[i][j];
      z1[j] = sum;
    }
    const a1 = z1.map((v) => this.relu(v));

    const z2 = new Array(this.hiddenDim2).fill(0);
    for (let j = 0; j < this.hiddenDim2; j++) {
      let sum = this.b2[j];
      for (let i = 0; i < this.hiddenDim1; i++) sum += a1[i] * this.W2[i][j];
      z2[j] = sum;
    }
    const a2 = z2.map((v) => this.relu(v));

    const z3 = new Array(this.outputDim).fill(0);
    for (let j = 0; j < this.outputDim; j++) {
      let sum = this.b3[j];
      for (let i = 0; i < this.hiddenDim2; i++) sum += a2[i] * this.W3[i][j];
      z3[j] = sum;
    }
    const probs = this.softmax(z3);

    return { z1, a1, z2, a2, z3, probs };
  }

  /** One SGD step on a single sample. Returns the cross-entropy loss before the update. */
  private step(x: number[], targetLabel: number, learningRate: number): { loss: number; correct: boolean } {
    const { a1, z1, a2, z2, probs } = this.forward(x);
    const loss = -Math.log(Math.max(1e-7, probs[targetLabel]));
    const correct = argmax(probs) === targetLabel;

    const dZ3 = [...probs];
    dZ3[targetLabel] -= 1.0; // softmax + cross-entropy gradient

    // Backprop to layer 2 (using W3 before it is updated)
    const dA2 = new Array(this.hiddenDim2).fill(0);
    for (let i = 0; i < this.hiddenDim2; i++) {
      for (let j = 0; j < this.outputDim; j++) dA2[i] += dZ3[j] * this.W3[i][j];
    }
    const dZ2 = dA2.map((da, idx) => da * this.reluDeriv(z2[idx]));

    const dA1 = new Array(this.hiddenDim1).fill(0);
    for (let i = 0; i < this.hiddenDim1; i++) {
      for (let j = 0; j < this.hiddenDim2; j++) dA1[i] += dZ2[j] * this.W2[i][j];
    }
    const dZ1 = dA1.map((da, idx) => da * this.reluDeriv(z1[idx]));

    for (let i = 0; i < this.hiddenDim2; i++) {
      for (let j = 0; j < this.outputDim; j++) this.W3[i][j] -= learningRate * dZ3[j] * a2[i];
    }
    for (let j = 0; j < this.outputDim; j++) this.b3[j] -= learningRate * dZ3[j];

    for (let i = 0; i < this.hiddenDim1; i++) {
      for (let j = 0; j < this.hiddenDim2; j++) this.W2[i][j] -= learningRate * dZ2[j] * a1[i];
    }
    for (let j = 0; j < this.hiddenDim2; j++) this.b2[j] -= learningRate * dZ2[j];

    for (let i = 0; i < this.inputDim; i++) {
      for (let j = 0; j < this.hiddenDim1; j++) this.W1[i][j] -= learningRate * dZ1[j] * x[i];
    }
    for (let j = 0; j < this.hiddenDim1; j++) this.b1[j] -= learningRate * dZ1[j];

    return { loss, correct };
  }

  private meanLoss(X: number[][], y: number[]): number {
    if (X.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < X.length; i++) {
      total += -Math.log(Math.max(1e-7, this.forward(X[i]).probs[y[i]]));
    }
    return total / X.length;
  }

  /**
   * Trains on pre-built feature arrays. Used by train() and by the hybrid model.
   * valX/valY (optional) give a real held-out loss per epoch.
   */
  public fitArrays(
    trainX: number[][],
    trainY: number[],
    epochs: number,
    learningRate: number,
    valX: number[][] = [],
    valY: number[] = [],
    onProgress?: (log: EpochLog) => void
  ): EpochLog[] {
    const epochLogs: EpochLog[] = [];
    const order = trainX.map((_, i) => i);

    for (let ep = 1; ep <= epochs; ep++) {
      // reshuffle sample order every epoch
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      let totalLoss = 0;
      let trainCorrect = 0;
      for (const idx of order) {
        const r = this.step(trainX[idx], trainY[idx], learningRate);
        totalLoss += r.loss;
        if (r.correct) trainCorrect++;
      }

      const avgLoss = totalLoss / Math.max(1, trainX.length);
      const logEntry: EpochLog = {
        epoch: ep,
        trainLoss: Number(avgLoss.toFixed(4)),
        valLoss: Number((valX.length > 0 ? this.meanLoss(valX, valY) : avgLoss).toFixed(4)),
        trainAccuracy: Number(((trainCorrect / Math.max(1, trainX.length)) * 100).toFixed(2)),
      };
      epochLogs.push(logEntry);
      if (onProgress && ep % 5 === 0) onProgress(logEntry);
    }
    return epochLogs;
  }

  public train(
    dataset: DatasetRecord[],
    epochs: number = 35,
    learningRate: number = 0.05,
    onProgress?: (log: EpochLog) => void
  ): { metrics: ClassificationMetrics; epochLogs: EpochLog[] } {
    const startTime = performance.now();

    const { X, y } = DataPreprocessor.preprocess(dataset);
    const { train, test } = DataPreprocessor.trainTestSplit(
      X.map((x, i) => ({ x, y: y[i] })),
      0.25,
      true
    );

    // Hold out 15% of the training portion for an honest validation-loss curve
    const valCount = Math.max(1, Math.floor(train.length * 0.15));
    const fitPart = train.slice(0, train.length - valCount);
    const valPart = train.slice(train.length - valCount);

    const epochLogs = this.fitArrays(
      fitPart.map((s) => s.x),
      fitPart.map((s) => s.y),
      epochs,
      learningRate,
      valPart.map((s) => s.x),
      valPart.map((s) => s.y),
      onProgress
    );

    const actual = test.map((s) => s.y);
    const predicted = test.map((s) => argmax(this.forward(s.x).probs));

    return {
      metrics: computeClassificationMetrics(actual, predicted, performance.now() - startTime, train.length),
      epochLogs,
    };
  }

  public predictProba(x: number[]): number[] {
    return this.forward(x).probs;
  }

  public predict(x: number[]): OperatingState {
    return DataPreprocessor.decodeLabel(argmax(this.forward(x).probs));
  }
}
