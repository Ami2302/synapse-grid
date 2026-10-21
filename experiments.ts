/**
 * Synapse Grid — reproducible experiment runner (Node, via `npx tsx experiments.ts`).
 * Uses the same engines as the dashboard. Math.random is replaced by a seeded PRNG
 * per repeat so every number in the paper can be regenerated exactly.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { DatasetEngine } from './src/simulation/datasetEngine';
import { PhysicsSimulationEngine, createPRNG } from './src/simulation/physicsEngine';
import { DEFAULT_TRANSFORMERS, DEFAULT_SCENARIO_CONFIGS } from './src/simulation/initialData';
import type { ScenarioType, TransformerState } from './src/simulation/types';
import { FuzzyLogicEngine } from './src/ml/fuzzyEngine';
import { ANNEngine } from './src/ml/annEngine';
import { RandomForestEngine } from './src/ml/randomForestEngine';
import { LSTMEngine } from './src/ml/lstmEngine';
import { HybridFuzzyNeuralEngine, DEFAULT_HYBRID_CONFIG } from './src/ml/hybridEngine';
import { modelRegistry } from './src/ml/modelRegistry';
import { DataPreprocessor } from './src/ml/preprocessing';
import { MultiAgentEngine } from './src/mas/agentEngine';
import { SelfHealingEngine, settleTemp, steadyStateTemp } from './src/mas/selfHealingEngine';

const OUT = process.argv[2] ?? './results';
mkdirSync(OUT, { recursive: true });
const SEEDS = [1, 2, 3, 4, 5];
const nativeRandom = Math.random;
const seedRandom = (s: number) => { Math.random = createPRNG(s); };

// ---------- 1. Dataset: identical to the dashboard defaults ----------
const RUNS: Record<ScenarioType, number> = {
  NORMAL_OPERATION: 5, LOAD_RAMP: 3, MORNING_PEAK: 3, EVENING_PEAK: 3, SUDDEN_LOAD_INCREASE: 2,
  SUSTAINED_OVERLOAD: 4, VOLTAGE_SAG: 2, THERMAL_STRESS: 3, INTERMITTENT_ANOMALY: 3, FAULT_EVENT: 4, RECOVERY: 2,
};
const t0 = performance.now();
const dataset = DatasetEngine.generateBatchDataset(
  Object.values(DEFAULT_TRANSFORMERS),
  (Object.keys(RUNS) as ScenarioType[]).map((s) => ({ scenarioType: s, runsCount: RUNS[s] })),
  42
);
const genMs = performance.now() - t0;
const quality = DatasetEngine.analyzeDatasetQuality(dataset);
console.log(`dataset ${dataset.length} records in ${genMs.toFixed(0)} ms`, quality.classDistribution);

// ---------- 2. Models, 5 seeded repeats ----------
type Row = Record<string, number>;
const rows: Record<string, Row[]> = { fuzzy: [], ann: [], rf: [], hybrid: [], lstm: [] };
const hybridDetails: unknown[] = [];
let showcase: { hybridCM: number[][]; lstmSeries: unknown; rfImportances: unknown; annLogs: unknown } | null = null;

const fz = FuzzyLogicEngine.evaluateDataset(dataset);
rows.fuzzy.push({ accuracy: fz.accuracy, precision: fz.precision, recall: fz.recall, f1: fz.f1Score, ms: fz.trainingTimeMs });

for (const seed of SEEDS) {
  seedRandom(seed * 1000 + 7);
  const ann = new ANNEngine().train(dataset, 35, 0.05);
  rows.ann.push({ seed, accuracy: ann.metrics.accuracy, precision: ann.metrics.precision, recall: ann.metrics.recall, f1: ann.metrics.f1Score, ms: ann.metrics.trainingTimeMs });

  seedRandom(seed * 1000 + 11);
  const rf = new RandomForestEngine().train(dataset, 12, 6);
  rows.rf.push({ seed, accuracy: rf.metrics.accuracy, precision: rf.metrics.precision, recall: rf.metrics.recall, f1: rf.metrics.f1Score, ms: rf.metrics.trainingTimeMs });

  seedRandom(seed * 1000 + 13);
  const hybrid = new HybridFuzzyNeuralEngine();
  const hr = hybrid.train(dataset, DEFAULT_HYBRID_CONFIG);
  rows.hybrid.push({ seed, accuracy: hr.metrics.accuracy, precision: hr.metrics.precision, recall: hr.metrics.recall, f1: hr.metrics.f1Score, ms: hr.metrics.trainingTimeMs, wA: hr.weights.ann, wR: hr.weights.rf, wF: hr.weights.fuzzy, valF1: hr.validationF1 });
  hybridDetails.push({ seed, weights: hr.weights, components: hr.components, split: hr.split, stageTimesMs: hr.stageTimesMs, confusionMatrix: hr.metrics.confusionMatrix });

  seedRandom(seed * 1000 + 17);
  const lstm = new LSTMEngine().train(dataset, 10, 25, 0.01);
  rows.lstm.push({ seed, rmse: lstm.rmse, mae: lstm.mae, r2: lstm.r2Score, ms: lstm.trainingTimeMs, nTest: lstm.testSamplesCount });

  if (seed === SEEDS[0]) {
    modelRegistry.set({ hybridModel: hybrid, hybrid: hr });
    showcase = { hybridCM: hr.metrics.confusionMatrix, lstmSeries: lstm.actualVsPredicted, rfImportances: rf.featureImportances, annLogs: ann.epochLogs };
  }
  console.log(`seed ${seed}: ANN ${ann.metrics.f1Score} | RF ${rf.metrics.f1Score} | HYB ${hr.metrics.f1Score} w=${JSON.stringify(hr.weights)} | LSTM rmse ${lstm.rmse}`);
}
Math.random = nativeRandom;

const stats = (arr: number[]) => {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, arr.length - 1));
  return { mean: Number(m.toFixed(2)), std: Number(sd.toFixed(2)) };
};
const summary: Record<string, Record<string, { mean: number; std: number }>> = {};
for (const [k, rs] of Object.entries(rows)) {
  summary[k] = {};
  for (const key of Object.keys(rs[0])) if (key !== 'seed') summary[k][key] = stats(rs.map((r) => r[key]));
}
// component scores averaged across seeds
const compNames = (hybridDetails[0] as any).components.map((c: any) => `${c.name} [${c.inputs}]`);
const componentSummary = compNames.map((n: string, i: number) => ({
  name: n,
  testF1: stats(hybridDetails.map((d: any) => d.components[i].testF1)),
  testAcc: stats(hybridDetails.map((d: any) => d.components[i].testAccuracy)),
}));

// ---------- 2b. Persistence baseline on the identical LSTM test windows (θ̂[k+1] = θ[k]) ----------
const win = DataPreprocessor.createSlidingWindows(dataset, 10);
const split = DataPreprocessor.chronologicalSplit(win.map((w, i) => i), 0.25);
const recs = DataPreprocessor.preprocess(dataset).records;
let se = 0, ae = 0, crossRun = 0;
for (const i of split.test) {
  const prev = recs[i + 9].transformer_temperature_C, tgt = recs[i + 10].transformer_temperature_C;
  se += (prev - tgt) ** 2; ae += Math.abs(prev - tgt);
  if (recs[i].simulation_run_id !== recs[i + 10].simulation_run_id) crossRun++;
}
const persistence = { rmse: Number(Math.sqrt(se / split.test.length).toFixed(3)), mae: Number((ae / split.test.length).toFixed(3)), nTest: split.test.length, windowsCrossingRuns: crossRun, testScenarios: [...new Set(split.test.map((i) => recs[i + 10].scenario))] };
console.log('persistence', persistence);

// ---------- 3. Thermal response: T1, sustained overload, 300 s ----------
const phys = new PhysicsSimulationEngine(42);
const thermal = phys.runSimulationScenario(DEFAULT_TRANSFORMERS.T1, DEFAULT_SCENARIO_CONFIGS.SUSTAINED_OVERLOAD, 'THERMAL-T1');
const thermalSeries = thermal.map((s) => ({ t: s.stepIndex, load: s.loadPercent, temp: s.transformerTemperatureC, hi: s.healthIndex, state: s.operatingState }));

// ---------- 4. Self-healing event, reproducing the dashboard (all at Normal t=0, T1 → 118.5 % / 84.5 °C) ----------
const phys2 = new PhysicsSimulationEngine(42);
const states: Record<string, TransformerState> = {};
for (const id of Object.keys(DEFAULT_TRANSFORMERS)) states[id] = phys2.step(0, DEFAULT_TRANSFORMERS[id], DEFAULT_SCENARIO_CONFIGS.NORMAL_OPERATION, null, 'INIT');
states.T1 = { ...states.T1, loadPercent: 118.5, transformerTemperatureC: 84.5, operatingState: 'OVERLOAD' };
const mas = new MultiAgentEngine(DEFAULT_TRANSFORMERS, states);

// decision latency: one full agent update (fuzzy + hybrid inference for 4 agents)
const lat: number[] = [];
for (let i = 0; i < 200; i++) { const a = performance.now(); mas.updateAgents(DEFAULT_TRANSFORMERS, states); lat.push(performance.now() - a); }
lat.sort((a, b) => a - b);
const agentsBefore = mas.updateAgents(DEFAULT_TRANSFORMERS, states);
const h0 = performance.now();
const heal = SelfHealingEngine.executeSelfHealing('T1', agentsBefore, mas, DEFAULT_TRANSFORMERS);
const healMs = performance.now() - h0;

// T1 temperature trajectory after transfer (closed form of Eq. 6) for 900 s, with and without healing
const T1 = DEFAULT_TRANSFORMERS.T1;
const trajectory = Array.from({ length: 901 }, (_, n) => ({
  t: n,
  healed: Number(settleTemp(84.5, heal.summary.after.T1.loadPercent, T1.ambientTempC, T1.thermalTimeConstantMinutes, n).toFixed(2)),
  noAction: Number(settleTemp(84.5, 118.5, T1.ambientTempC, T1.thermalTimeConstantMinutes, n).toFixed(2)),
}));
const below75 = trajectory.find((p) => p.healed < 75)?.t ?? null;
const noActionAbove105 = trajectory.find((p) => p.noAction >= 105)?.t ?? null;

const agentsSnapshot = Object.fromEntries(Object.entries(agentsBefore).map(([id, a]) => [id, {
  load: a.currentLoadPercent, temp: a.transformerTempC, risk: a.riskScore, state: a.operatingState,
  predicted: a.predictedState, conf: a.predictionConfidence, action: a.recommendedAction, headroomMVA: a.availableCapacityMVA,
}]));

const out = {
  generatedAt: new Date().toISOString(),
  dataset: { records: dataset.length, runs: 34 * 4, genMs: Number(genMs.toFixed(0)), classDistribution: quality.classDistribution, quality },
  seeds: SEEDS,
  rows, summary, componentSummary, hybridDetails, showcase,
  thermal: { scenario: DEFAULT_SCENARIO_CONFIGS.SUSTAINED_OVERLOAD, series: thermalSeries },
  selfHealing: {
    summary: heal.summary, steps: heal.pipelineSteps, messages: heal.messages.map((m) => ({ src: m.sourceAgentId, dst: m.destAgentId, type: m.messageType, msg: m.payloadMessage })),
    healMs: Number(healMs.toFixed(3)), trajectory, below75, noActionAbove105,
    steadyAfter: steadyStateTemp(heal.summary.after.T1.loadPercent, T1.ambientTempC),
  },
  agents: agentsSnapshot,
  persistence,
  latencyMs: { median: Number(lat[100].toFixed(3)), p95: Number(lat[190].toFixed(3)) },
};
writeFileSync(`${OUT}/results.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ summary, componentSummary, heal: heal.summary, below75, noActionAbove105, latency: out.latencyMs, agentsSnapshot }, null, 1));
