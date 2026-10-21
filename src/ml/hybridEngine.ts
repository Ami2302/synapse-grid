import type { DatasetRecord, OperatingState, TransformerState } from '../simulation/types';
import type { ClassificationMetrics, EpochLog } from './types';
import { DataPreprocessor, FEATURE_NAMES, OPERATING_STATES_ORDER } from './preprocessing';
import { FuzzyLogicEngine } from './fuzzyEngine';
import { ANNEngine } from './annEngine';
import { RandomForestEngine } from './randomForestEngine';
import { argmax, computeClassificationMetrics, macroF1 } from './metrics';

/**
 * HYBRID FUZZY–NEURAL ENSEMBLE
 *
 * Stage 1  Fuzzy inference on every record → risk score + 4 consequent firing strengths
 * Stage 2  Feature fusion: 8 normalised Digital Twin features + 5 fuzzy features = 13 inputs
 * Stage 3  Train ANN/MLP and Random Forest on the enriched (13-D) feature set
 * Stage 4  Soft-voting fusion of ANN, RF and Fuzzy class probabilities.
 *          Fusion weights are searched on a validation split (grid step 0.1),
 *          choosing the combination with the highest validation macro-F1.
 *
 * Split: 60% train / 15% validation / 25% test (shuffled). The test set is never
 * used for training or for choosing the weights.
 */

export const FUZZY_FEATURE_NAMES = [
  'fuzzy_risk_score',
  'mu_NORMAL',
  'mu_WARNING',
  'mu_HIGH_STRESS',
  'mu_OVERLOAD',
] as const;

export const HYBRID_FEATURE_NAMES = [...FEATURE_NAMES, ...FUZZY_FEATURE_NAMES];

export interface HybridConfig {
  annEpochs: number;
  annLearningRate: number;
  rfNumTrees: number;
  rfMaxDepth: number;
}

export const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  annEpochs: 30,
  annLearningRate: 0.05,
  rfNumTrees: 12,
  rfMaxDepth: 6,
};

export interface FusionWeights {
  ann: number;
  rf: number;
  fuzzy: number;
}

export interface ComponentScore {
  name: string;
  inputs: 'RULES' | 'RAW 8' | 'ENRICHED 13';
  valF1: number;  // %
  testF1: number; // %
  testAccuracy: number; // %
}

export interface HybridTrainingResult {
  metrics: ClassificationMetrics;
  weights: FusionWeights;
  validationF1: number; // % of the fused model on the validation split
  components: ComponentScore[];
  annEpochLogs: EpochLog[];
  split: { train: number; validation: number; test: number };
  stageTimesMs: { fuzzy: number; ann: number; rf: number; fusion: number };
  config: HybridConfig;
}

export interface HybridPrediction {
  operatingState: OperatingState;
  confidence: number; // 0–1
  probabilities: number[]; // per OPERATING_STATES_ORDER
  riskScore: number;
}

export class HybridFuzzyNeuralEngine {
  private ann: ANNEngine | null = null;
  private rf: RandomForestEngine | null = null;
  private weights: FusionWeights = { ann: 0.4, rf: 0.4, fuzzy: 0.2 };
  private featureMin: number[] = [];
  private featureMax: number[] = [];
  private trained = false;

  public get isTrained(): boolean {
    return this.trained;
  }

  public get fusionWeights(): FusionWeights {
    return { ...this.weights };
  }

  /** Stage 1: fuzzy feature extraction from raw (un-normalised) values. */
  private static fuzzyFeatures(loadPercent: number, tempC: number, voltageKV: number): number[] {
    const { riskScore, strengths } = FuzzyLogicEngine.consequentStrengths(loadPercent, tempC, voltageKV);
    return [riskScore / 100, ...strengths];
  }

  /** Fuzzy output turned into a 5-class probability vector (FAULT is not a fuzzy consequent). */
  private static fuzzyProba(fuzzyFeats: number[]): number[] {
    const s = [fuzzyFeats[1], fuzzyFeats[2], fuzzyFeats[3], fuzzyFeats[4], 0];
    const sum = s.reduce((a, b) => a + b, 0);
    if (sum <= 1e-9) return [0.2, 0.2, 0.2, 0.2, 0.2];
    return s.map((v) => v / sum);
  }

  private fuse(pAnn: number[], pRf: number[], pFz: number[], w: FusionWeights): number[] {
    return pAnn.map((_, k) => w.ann * pAnn[k] + w.rf * pRf[k] + w.fuzzy * pFz[k]);
  }

  public train(dataset: DatasetRecord[], config: HybridConfig = DEFAULT_HYBRID_CONFIG): HybridTrainingResult {
    const t0 = performance.now();

    // Validation → cleaning → normalisation (shared Digital Twin preprocessing)
    const { X, y, records, featureMin, featureMax } = DataPreprocessor.preprocess(dataset);
    this.featureMin = featureMin;
    this.featureMax = featureMax;

    // ---- Stage 1 + 2: fuzzy features and feature fusion ----
    const tFz = performance.now();
    const fuzzyFeats = records.map((r) =>
      HybridFuzzyNeuralEngine.fuzzyFeatures(r.load_percent, r.transformer_temperature_C, r.primary_voltage_kV)
    );
    const enriched = X.map((row, i) => [...row, ...fuzzyFeats[i]]);
    const fuzzyMs = performance.now() - tFz;

    // ---- 60 / 15 / 25 shuffled split ----
    const idx = DataPreprocessor.trainTestSplit(records.map((_, i) => i), 0.25, true);
    const testIdx = idx.test;
    const valCount = Math.max(1, Math.floor(records.length * 0.15));
    const valIdx = idx.train.slice(idx.train.length - valCount);
    const trainIdx = idx.train.slice(0, idx.train.length - valCount);

    const pick = (ids: number[]) => ({ X: ids.map((i) => enriched[i]), y: ids.map((i) => y[i]) });
    const tr = pick(trainIdx);
    const va = pick(valIdx);
    const te = pick(testIdx);

    // ---- Stage 3a: ANN on enriched features ----
    const tAnn = performance.now();
    this.ann = new ANNEngine(HYBRID_FEATURE_NAMES.length);
    const annEpochLogs = this.ann.fitArrays(tr.X, tr.y, config.annEpochs, config.annLearningRate, va.X, va.y);
    const annMs = performance.now() - tAnn;

    // ---- Stage 3b: Random Forest on enriched features ----
    const tRf = performance.now();
    this.rf = new RandomForestEngine();
    this.rf.fitArrays(tr.X, tr.y, config.rfNumTrees, config.rfMaxDepth);
    const rfMs = performance.now() - tRf;

    // ---- Stage 4: learn fusion weights on the validation split ----
    const tFu = performance.now();
    const probsFor = (rows: number[][], ids: number[]) =>
      rows.map((row, k) => ({
        ann: this.ann!.predictProba(row),
        rf: this.rf!.predictProba(row),
        fz: HybridFuzzyNeuralEngine.fuzzyProba(fuzzyFeats[ids[k]]),
      }));
    const valProbs = probsFor(va.X, valIdx);
    const testProbs = probsFor(te.X, testIdx);

    let best: FusionWeights = { ann: 1 / 3, rf: 1 / 3, fuzzy: 1 / 3 };
    let bestF1 = -1;
    for (let a = 0; a <= 10; a++) {
      for (let r = 0; r <= 10 - a; r++) {
        const w: FusionWeights = { ann: a / 10, rf: r / 10, fuzzy: (10 - a - r) / 10 };
        const preds = valProbs.map((p) => argmax(this.fuse(p.ann, p.rf, p.fz, w)));
        const f1 = macroF1(va.y, preds);
        if (f1 > bestF1 + 1e-9) {
          bestF1 = f1;
          best = w;
        }
      }
    }
    this.weights = best;
    const fusionMs = performance.now() - tFu;
    this.trained = true;

    // ---- Final evaluation on the untouched test split ----
    const fusedPred = testProbs.map((p) => argmax(this.fuse(p.ann, p.rf, p.fz, best)));
    const metrics = computeClassificationMetrics(te.y, fusedPred, performance.now() - t0, trainIdx.length);

    // Same test split, each component on its own — shows what the fusion adds
    const component = (name: string, inputs: ComponentScore['inputs'], sel: (p: (typeof testProbs)[number]) => number[], valSel: (p: (typeof valProbs)[number]) => number[]): ComponentScore => {
      const testM = computeClassificationMetrics(te.y, testProbs.map((p) => argmax(sel(p))), 0, 0);
      return {
        name,
        inputs,
        valF1: Number((macroF1(va.y, valProbs.map((p) => argmax(valSel(p)))) * 100).toFixed(2)),
        testF1: testM.f1Score,
        testAccuracy: testM.accuracy,
      };
    };

    // Baselines: same split, same hyperparameters, but only the 8 raw features (no fuzzy features).
    // Shows how much the fuzzy feature fusion (Stage 2) contributes.
    const rawRows = (ids: number[]) => ids.map((i) => X[i]);
    const annRaw = new ANNEngine(FEATURE_NAMES.length);
    annRaw.fitArrays(rawRows(trainIdx), tr.y, config.annEpochs, config.annLearningRate);
    const rfRaw = new RandomForestEngine();
    rfRaw.fitArrays(rawRows(trainIdx), tr.y, config.rfNumTrees, config.rfMaxDepth);
    const baseline = (name: string, predict: (row: number[]) => number[]): ComponentScore => {
      const vPred = rawRows(valIdx).map((r) => argmax(predict(r)));
      const tPred = rawRows(testIdx).map((r) => argmax(predict(r)));
      const testM = computeClassificationMetrics(te.y, tPred, 0, 0);
      return {
        name,
        inputs: 'RAW 8',
        valF1: Number((macroF1(va.y, vPred) * 100).toFixed(2)),
        testF1: testM.f1Score,
        testAccuracy: testM.accuracy,
      };
    };

    const components: ComponentScore[] = [
      component('Fuzzy Logic', 'RULES', (p) => p.fz, (p) => p.fz),
      baseline('ANN / MLP', (r) => annRaw.predictProba(r)),
      component('ANN / MLP', 'ENRICHED 13', (p) => p.ann, (p) => p.ann),
      baseline('Random Forest', (r) => rfRaw.predictProba(r)),
      component('Random Forest', 'ENRICHED 13', (p) => p.rf, (p) => p.rf),
    ];

    return {
      metrics,
      weights: best,
      validationF1: Number((bestF1 * 100).toFixed(2)),
      components,
      annEpochLogs,
      split: { train: trainIdx.length, validation: valIdx.length, test: testIdx.length },
      stageTimesMs: {
        fuzzy: Number(fuzzyMs.toFixed(1)),
        ann: Number(annMs.toFixed(1)),
        rf: Number(rfMs.toFixed(1)),
        fusion: Number(fusionMs.toFixed(1)),
      },
      config,
    };
  }

  /** Live inference on one Digital Twin state (used by the transformer edge agents). */
  public predictState(state: TransformerState): HybridPrediction | null {
    if (!this.trained || !this.ann || !this.rf) return null;

    const raw = [
      state.loadPercent,
      state.transformerTemperatureC,
      state.voltageKV,
      state.currentA,
      state.powerKW,
      state.powerFactor,
      state.ambientTemperatureC,
      state.healthIndex,
    ];
    const norm = raw.map((v, j) => {
      const range = this.featureMax[j] - this.featureMin[j];
      return range > 0 ? (v - this.featureMin[j]) / range : 0.5;
    });
    const fz = HybridFuzzyNeuralEngine.fuzzyFeatures(state.loadPercent, state.transformerTemperatureC, state.voltageKV);
    const row = [...norm, ...fz];

    const probs = this.fuse(this.ann.predictProba(row), this.rf.predictProba(row), HybridFuzzyNeuralEngine.fuzzyProba(fz), this.weights);
    const k = argmax(probs);
    return {
      operatingState: OPERATING_STATES_ORDER[k],
      confidence: Number(probs[k].toFixed(3)),
      probabilities: probs.map((p) => Number(p.toFixed(3))),
      riskScore: Number((fz[0] * 100).toFixed(1)),
    };
  }
}
