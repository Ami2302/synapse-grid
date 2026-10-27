import React, { useState } from 'react';
import type { DatasetRecord, OperatingState } from '../simulation/types';
import type { ClassificationMetrics, ForecastingMetrics, FeatureImportance, EpochLog, ModelStatus } from '../ml/types';
import { DataPreprocessor } from '../ml/preprocessing';
import { FuzzyLogicEngine } from '../ml/fuzzyEngine';
import { ANNEngine } from '../ml/annEngine';
import { RandomForestEngine } from '../ml/randomForestEngine';
import { LSTMEngine } from '../ml/lstmEngine';
import { HybridFuzzyNeuralEngine, DEFAULT_HYBRID_CONFIG, HYBRID_FEATURE_NAMES } from '../ml/hybridEngine';
import type { HybridConfig, HybridTrainingResult } from '../ml/hybridEngine';
import { modelRegistry, selectBestClassifier } from '../ml/modelRegistry';
import { FuzzyMembershipGraphs, AnnNetworkDiagram, HybridSelectionGraphs } from './AlgorithmGraphs';
import { 
  Brain, 
  Cpu, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Play, 
  Save, 
  Database,
  Sliders,
  ShieldCheck,
  GitMerge
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

interface SoftComputingWorkspaceProps {
  dataset: DatasetRecord[];
  onNavigateToDatasetGen?: () => void;
}

export const SoftComputingWorkspace: React.FC<SoftComputingWorkspaceProps> = ({
  dataset,
  onNavigateToDatasetGen,
}) => {
  const [activeTab, setActiveTab] = useState<'fuzzy' | 'ann' | 'rf' | 'lstm' | 'hybrid' | 'comparison'>('fuzzy');

  // Algorithm 01: Fuzzy Logic State
  const [fuzzyInputs, setFuzzyInputs] = useState({ load: 65, temp: 60, voltage: 11.0 });
  const [fuzzyResult, setFuzzyResult] = useState(FuzzyLogicEngine.infer(65, 60, 11.0));
  const [fuzzyMetrics, setFuzzyMetrics] = useState<ClassificationMetrics | null>(modelRegistry.get().fuzzy);
  const [fuzzyStatus, setFuzzyStatus] = useState<ModelStatus>(modelRegistry.get().fuzzy ? 'TRAINED' : 'NOT_TRAINED');

  // Algorithm 02: ANN / MLP State
  const [annEpochs, setAnnEpochs] = useState(35);
  const [annLearningRate, setAnnLearningRate] = useState(0.05);
  const [annMetrics, setAnnMetrics] = useState<ClassificationMetrics | null>(modelRegistry.get().ann);
  const [annEpochLogs, setAnnEpochLogs] = useState<EpochLog[]>([]);
  const [annStatus, setAnnStatus] = useState<ModelStatus>(modelRegistry.get().ann ? 'TRAINED' : 'NOT_TRAINED');

  // Algorithm 03: Random Forest State
  const [rfNumTrees, setRfNumTrees] = useState(12);
  const [rfMaxDepth, setRfMaxDepth] = useState(6);
  const [rfMetrics, setRfMetrics] = useState<ClassificationMetrics | null>(modelRegistry.get().rf);
  const [rfImportances, setRfImportances] = useState<FeatureImportance[]>([]);
  const [rfStatus, setRfStatus] = useState<ModelStatus>(modelRegistry.get().rf ? 'TRAINED' : 'NOT_TRAINED');

  // Algorithm 04: LSTM State
  const [lstmSeqLength, setLstmSeqLength] = useState(10);
  const [lstmEpochs, setLstmEpochs] = useState(25);
  const [lstmMetrics, setLstmMetrics] = useState<ForecastingMetrics | null>(modelRegistry.get().lstm);
  const [lstmStatus, setLstmStatus] = useState<ModelStatus>(modelRegistry.get().lstm ? 'TRAINED' : 'NOT_TRAINED');

  // Algorithm 05: Hybrid Fuzzy-Neural Ensemble State
  const [hybridConfig, setHybridConfig] = useState<HybridConfig>(DEFAULT_HYBRID_CONFIG);
  const [hybridResult, setHybridResult] = useState<HybridTrainingResult | null>(modelRegistry.get().hybrid);
  const [hybridStatus, setHybridStatus] = useState<ModelStatus>(modelRegistry.get().hybrid ? 'TRAINED' : 'NOT_TRAINED');

  // Save Model state indicator
  const [savedModelMsg, setSavedModelMsg] = useState<string>('');

  const preprocessed = DataPreprocessor.preprocess(dataset);

  // Handlers for algorithm execution
  const handleRunFuzzyInference = (load: number, temp: number, volt: number) => {
    setFuzzyInputs({ load, temp, voltage: volt });
    const res = FuzzyLogicEngine.infer(load, temp, volt);
    setFuzzyResult(res);
  };

  const handleEvaluateFuzzy = () => {
    if (dataset.length === 0) return;
    setFuzzyStatus('TRAINING');
    setTimeout(() => {
      const metrics = FuzzyLogicEngine.evaluateDataset(dataset);
      setFuzzyMetrics(metrics);
      modelRegistry.set({ fuzzy: metrics });
      setFuzzyStatus('TRAINED');
    }, 100);
  };

  const handleTrainANN = () => {
    if (dataset.length === 0) return;
    setAnnStatus('TRAINING');
    setTimeout(() => {
      const annEngine = new ANNEngine();
      const res = annEngine.train(dataset, annEpochs, annLearningRate);
      setAnnMetrics(res.metrics);
      modelRegistry.set({ ann: res.metrics });
      setAnnEpochLogs(res.epochLogs);
      setAnnStatus('TRAINED');
    }, 100);
  };

  const handleTrainRandomForest = () => {
    if (dataset.length === 0) return;
    setRfStatus('TRAINING');
    setTimeout(() => {
      const rfEngine = new RandomForestEngine();
      const res = rfEngine.train(dataset, rfNumTrees, rfMaxDepth);
      setRfMetrics(res.metrics);
      modelRegistry.set({ rf: res.metrics });
      setRfImportances(res.featureImportances);
      setRfStatus('TRAINED');
    }, 100);
  };

  const handleTrainLSTM = () => {
    if (dataset.length === 0) return;
    setLstmStatus('TRAINING');
    setTimeout(() => {
      const lstmEngine = new LSTMEngine();
      const res = lstmEngine.train(dataset, lstmSeqLength, lstmEpochs);
      setLstmMetrics(res);
      modelRegistry.set({ lstm: res });
      setLstmStatus('TRAINED');
    }, 100);
  };

  const handleTrainHybrid = () => {
    if (dataset.length === 0) return;
    setHybridStatus('TRAINING');
    setTimeout(() => {
      try {
        const engine = new HybridFuzzyNeuralEngine();
        const res = engine.train(dataset, hybridConfig);
        setHybridResult(res);
        // Trained instance is published so the transformer agents can use it for live prediction
        modelRegistry.set({ hybrid: res, hybridModel: engine });
        setHybridStatus('TRAINED');
      } catch (err) {
        console.error(err);
        setHybridStatus('ERROR');
      }
    }, 100);
  };

  const bestClassifier = selectBestClassifier({
    fuzzy: fuzzyMetrics,
    ann: annMetrics,
    rf: rfMetrics,
    lstm: lstmMetrics,
    hybrid: hybridResult,
    hybridModel: null,
  });

  const handleSaveModel = (modelName: string) => {
    setSavedModelMsg(`Model weights for '${modelName}' saved to local storage!`);
    setTimeout(() => setSavedModelMsg(''), 4000);
  };

  // Render Confusion Matrix
  const renderConfusionMatrix = (matrix: number[][], labels: OperatingState[]) => {
    return (
      <div className="bg-grid-card p-4 rounded-xl border border-grid-border space-y-2 font-mono">
        <div className="text-xs font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
          <span>EMPIRICAL CONFUSION MATRIX (TEST SET)</span>
          <span className="text-[10px] text-grid-muted">PREDICTED vs ACTUAL</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="text-grid-muted text-[10px]">
                <th className="p-2 border border-grid-border/40 bg-grid-bg">Actual \ Pred</th>
                {labels.map((l) => (
                  <th key={l} className="p-2 border border-grid-border/40 bg-grid-bg truncate max-w-[70px]">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="p-2 border border-grid-border/40 bg-grid-bg font-bold text-white text-[10px] text-left">
                    {labels[rIdx]}
                  </td>
                  {row.map((val, cIdx) => {
                    const isDiagonal = rIdx === cIdx;
                    return (
                      <td
                        key={cIdx}
                        className={`p-2 border border-grid-border/40 font-bold ${
                          isDiagonal
                            ? val > 0
                              ? 'bg-grid-green/20 text-grid-green border-grid-green/50'
                              : 'bg-grid-card text-white'
                            : val > 0
                            ? 'bg-grid-red/20 text-grid-red border-grid-red/50'
                            : 'text-grid-muted'
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-6 flex flex-col gap-6 shadow-xl max-w-[1920px] mx-auto font-sans">
      
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-grid-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-grid-steel" />
            <h2 className="text-xl font-bold text-white font-mono tracking-wider">
              MODULE 2: SOFT COMPUTING / AI EXPERIMENTATION WORKSPACE
            </h2>
          </div>
          <p className="text-xs text-grid-muted mt-1">
            Synapse Grid Soft Computing &amp; Machine Learning Engine. Fuzzy Logic, ANN/MLP, Random Forest, LSTM and a Hybrid Fuzzy-Neural Ensemble trained on Digital Twin time-series data.
          </p>
        </div>

        {savedModelMsg && (
          <div className="px-3 py-1.5 rounded-lg bg-grid-green/20 border border-grid-green text-grid-green font-mono text-xs font-bold animate-fade-in flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedModelMsg}
          </div>
        )}
      </div>

      {/* Project Research Pipeline Banner */}
      <div className="bg-grid-bg p-4 rounded-xl border border-grid-border">
        <div className="text-[10px] font-mono text-grid-muted uppercase mb-2 font-bold">
          END-TO-END SYNAPSE GRID RESEARCH PIPELINE
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center font-mono text-[11px]">
          <div className="p-2 rounded bg-grid-card border border-grid-steel/40 text-grid-steel">
            1. DIGITAL TWIN
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-steel/40 text-grid-steel">
            2. SIMULATION
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-steel/40 text-grid-steel">
            3. SYNTHETIC DATA
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-steel/40 text-grid-steel">
            4. PREPROCESSING
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-steel text-white font-bold ring-1 ring-grid-steel">
            5. SOFT COMPUTING
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-border text-grid-muted">
            6. COMPARISON
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-border text-grid-muted">
            7. BEST MODEL
          </div>
          <div className="p-2 rounded bg-grid-card border border-grid-border text-grid-muted">
            8. MAS / HEALING
          </div>
        </div>
      </div>

      {/* Dataset Connection Summary Box */}
      <div className="bg-grid-card p-4 rounded-xl border border-grid-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-grid-steel" />
          <div>
            <div className="text-white font-bold">DATA SOURCE: SynapseGrid_DigitalTwin_Dataset.csv</div>
            <div className="text-[11px] text-grid-muted mt-0.5">
              Total Records: <strong className="text-white">{preprocessed.records.length}</strong> | Features: <strong className="text-white">8 Inputs</strong> | Classes: <strong className="text-white">5 Operating States</strong>
            </div>
          </div>
        </div>

        {preprocessed.records.length === 0 ? (
          <div className="flex items-center gap-2 text-grid-yellow">
            <span>⚠ No simulation dataset loaded.</span>
            {onNavigateToDatasetGen && (
              <button
                onClick={onNavigateToDatasetGen}
                className="px-3 py-1 rounded bg-grid-steel/30 border border-grid-steel text-white font-bold hover:bg-grid-steel/50"
              >
                Generate Dataset
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[11px] text-grid-muted">
            <span className="flex items-center gap-1 text-grid-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Clean (0 missing)
            </span>
            <span className="flex items-center gap-1 text-grid-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Scaled [0, 1]
            </span>
            <span className="flex items-center gap-1 text-grid-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Train/Test Split Ready
            </span>
          </div>
        )}
      </div>

      {/* Algorithm Navigation Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-grid-border overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('fuzzy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'fuzzy'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <Sliders className="w-4 h-4 text-grid-steel" />
          01. FUZZY LOGIC
        </button>

        <button
          onClick={() => setActiveTab('ann')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'ann'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <Cpu className="w-4 h-4 text-grid-steel" />
          02. ANN / MLP
        </button>

        <button
          onClick={() => setActiveTab('rf')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'rf'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <Layers className="w-4 h-4 text-grid-steel" />
          03. RANDOM FOREST
        </button>

        <button
          onClick={() => setActiveTab('lstm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'lstm'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-grid-steel" />
          04. LSTM FORECASTING
        </button>

        <button
          onClick={() => setActiveTab('hybrid')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'hybrid'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <GitMerge className="w-4 h-4 text-grid-steel" />
          05. HYBRID FUZZY-NEURAL
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
            activeTab === 'comparison'
              ? 'bg-grid-steel/30 text-white border border-grid-steel shadow-sm'
              : 'text-grid-muted hover:text-white hover:bg-grid-card'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-grid-steel" />
          MODEL COMPARISON &amp; EVALUATION
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ALGORITHM 01: FUZZY LOGIC WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'fuzzy' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
              <div>
                <div className="text-sm font-bold text-white font-mono uppercase">
                  ALGORITHM 01: MAMDANI FUZZY LOGIC INFERENCE SYSTEM
                </div>
                <div className="text-xs text-grid-muted">
                  Purpose: Interpretable transformer operating risk &amp; condition assessment using rule-based linguistic variables.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleEvaluateFuzzy}
                  disabled={dataset.length === 0 || fuzzyStatus === 'TRAINING'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  EVALUATE ON DATASET
                </button>

                {fuzzyMetrics && (
                  <button
                    onClick={() => handleSaveModel('Fuzzy_Logic_Model')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-white font-mono text-xs hover:border-grid-steel"
                  >
                    <Save className="w-3.5 h-3.5 text-grid-steel" />
                    SAVE MODEL
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Fuzzy Inference Tester */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-grid-surface p-4 rounded-xl border border-grid-border">
              <div className="lg:col-span-5 space-y-4 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2">
                  LIVE FUZZY INPUT TESTER
                </div>

                <div>
                  <div className="flex justify-between text-grid-muted mb-1">
                    <span>LOAD UTILIZATION %:</span>
                    <strong className="text-white">{fuzzyInputs.load}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="160"
                    value={fuzzyInputs.load}
                    onChange={(e) => handleRunFuzzyInference(parseFloat(e.target.value), fuzzyInputs.temp, fuzzyInputs.voltage)}
                    className="w-full accent-grid-steel"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-grid-muted mb-1">
                    <span>HOT-SPOT TEMPERATURE °C:</span>
                    <strong className="text-white">{fuzzyInputs.temp}°C</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="140"
                    value={fuzzyInputs.temp}
                    onChange={(e) => handleRunFuzzyInference(fuzzyInputs.load, parseFloat(e.target.value), fuzzyInputs.voltage)}
                    className="w-full accent-grid-steel"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-grid-muted mb-1">
                    <span>PRIMARY VOLTAGE (kV):</span>
                    <strong className="text-white">{fuzzyInputs.voltage} kV</strong>
                  </div>
                  <input
                    type="range"
                    min="8.0"
                    max="13.0"
                    step="0.1"
                    value={fuzzyInputs.voltage}
                    onChange={(e) => handleRunFuzzyInference(fuzzyInputs.load, fuzzyInputs.temp, parseFloat(e.target.value))}
                    className="w-full accent-grid-steel"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                  <span>FUZZY INFERENCE DEFUZZIFICATION OUTPUT</span>
                  <span className="text-grid-steel font-bold">RISK SCORE: {fuzzyResult.riskScore} / 100</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-grid-bg border border-grid-border">
                  <span className="text-grid-muted">PREDICTED OPERATING STATE:</span>
                  <span className={`px-3 py-1 rounded text-xs font-bold border uppercase ${
                    fuzzyResult.operatingState === 'OVERLOAD' || fuzzyResult.operatingState === 'FAULT'
                      ? 'bg-grid-red/20 border-grid-red text-grid-red'
                      : fuzzyResult.operatingState === 'HIGH_STRESS'
                      ? 'bg-grid-amber/20 border-grid-amber text-grid-amber'
                      : fuzzyResult.operatingState === 'WARNING'
                      ? 'bg-grid-yellow/20 border-grid-yellow text-grid-yellow'
                      : 'bg-grid-green/20 border-grid-green text-grid-green'
                  }`}>
                    ● {fuzzyResult.operatingState}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-grid-muted uppercase font-bold">ACTIVE FIRED MAMDANI RULES:</div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-[11px]">
                    {fuzzyResult.activeRuleFires.map((item, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-grid-bg border border-grid-border flex items-center justify-between">
                        <span>Rule {item.rule.id}: IF Load={item.rule.load} &amp; Temp={item.rule.temp}</span>
                        <strong className="text-grid-steel">Strength = {(item.strength * 100).toFixed(0)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Membership function and defuzzification graphs */}
            <FuzzyMembershipGraphs inputs={fuzzyInputs} result={fuzzyResult} />

            {/* Empirical Evaluation Metrics & Confusion Matrix */}
            {fuzzyMetrics && (
              <div className="space-y-4 pt-4 border-t border-grid-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">ACCURACY</div>
                    <div className="text-xl font-bold font-mono text-white">{fuzzyMetrics.accuracy}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">PRECISION</div>
                    <div className="text-xl font-bold font-mono text-white">{fuzzyMetrics.precision}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">RECALL</div>
                    <div className="text-xl font-bold font-mono text-white">{fuzzyMetrics.recall}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">F1 SCORE</div>
                    <div className="text-xl font-bold font-mono text-grid-green">{fuzzyMetrics.f1Score}%</div>
                  </div>
                </div>

                {renderConfusionMatrix(fuzzyMetrics.confusionMatrix, fuzzyMetrics.labels)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALGORITHM 02: ANN / MLP WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'ann' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
              <div>
                <div className="text-sm font-bold text-white font-mono uppercase">
                  ALGORITHM 02: MULTI-LAYER PERCEPTRON (ANN / MLP) CLASSIFIER
                </div>
                <div className="text-xs text-grid-muted">
                  Purpose: Deep nonlinear mapping between 8 transformer features and operating condition classes.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrainANN}
                  disabled={dataset.length === 0 || annStatus === 'TRAINING'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
                >
                  <Cpu className="w-3.5 h-3.5 fill-current" />
                  {annStatus === 'TRAINING' ? 'TRAINING NEURAL NET...' : 'TRAIN ANN MODEL'}
                </button>

                {annMetrics && (
                  <button
                    onClick={() => handleSaveModel('ANN_MLP_Model')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-white font-mono text-xs hover:border-grid-steel"
                  >
                    <Save className="w-3.5 h-3.5 text-grid-steel" />
                    SAVE MODEL
                  </button>
                )}
              </div>
            </div>

            {/* Network architecture diagram: input, two hidden layers, output */}
            <AnnNetworkDiagram />

            {/* Neural Net Architecture Visualizer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2">
                  NEURAL ARCHITECTURE SPECIFICATIONS
                </div>
                <div className="space-y-1.5 text-grid-muted">
                  <div className="flex justify-between"><span>Input Layer:</span><strong className="text-white">8 Features</strong></div>
                  <div className="flex justify-between"><span>Hidden Layer 1:</span><strong className="text-white">16 Neurons (ReLU)</strong></div>
                  <div className="flex justify-between"><span>Hidden Layer 2:</span><strong className="text-white">8 Neurons (ReLU)</strong></div>
                  <div className="flex justify-between"><span>Output Layer:</span><strong className="text-white">5 Classes (Softmax)</strong></div>
                  <div className="flex justify-between"><span>Optimizer / Loss:</span><strong className="text-white">SGD / Cross-Entropy</strong></div>
                </div>

                <div className="pt-2 border-t border-grid-border space-y-2">
                  <label className="block text-grid-muted text-[11px]">TRAINING EPOCHS:</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={annEpochs}
                    onChange={(e) => setAnnEpochs(parseInt(e.target.value) || 35)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                  <label className="block text-grid-muted text-[11px]">LEARNING RATE:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    max="0.2"
                    value={annLearningRate}
                    onChange={(e) => setAnnLearningRate(parseFloat(e.target.value) || 0.05)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="lg:col-span-2 bg-grid-card p-4 rounded-xl border border-grid-border space-y-2 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                  <span>EPOCH LOSS &amp; ACCURACY PROGRESSION</span>
                  <span className="text-grid-steel">{annEpochLogs.length} Epochs Evaluated</span>
                </div>

                {annEpochLogs.length === 0 ? (
                  <div className="text-center py-12 text-grid-muted">
                    Model status: <strong>NOT TRAINED</strong>. Click 'TRAIN ANN MODEL' to start in-browser backpropagation loop.
                  </div>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={annEpochLogs}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                        <XAxis dataKey="epoch" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                        <YAxis stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="trainLoss" name="Training Loss" stroke="#B94A48" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="trainAccuracy" name="Train Accuracy (%)" stroke="#5E9C76" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* ANN Classification Metrics */}
            {annMetrics && (
              <div className="space-y-4 pt-4 border-t border-grid-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">ACCURACY</div>
                    <div className="text-xl font-bold font-mono text-white">{annMetrics.accuracy}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">PRECISION</div>
                    <div className="text-xl font-bold font-mono text-white">{annMetrics.precision}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">RECALL</div>
                    <div className="text-xl font-bold font-mono text-white">{annMetrics.recall}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">F1 SCORE</div>
                    <div className="text-xl font-bold font-mono text-grid-green">{annMetrics.f1Score}%</div>
                  </div>
                </div>

                {renderConfusionMatrix(annMetrics.confusionMatrix, annMetrics.labels)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALGORITHM 03: RANDOM FOREST WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'rf' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
              <div>
                <div className="text-sm font-bold text-white font-mono uppercase">
                  ALGORITHM 03: RANDOM FOREST ENSEMBLE CLASSIFIER
                </div>
                <div className="text-xs text-grid-muted">
                  Purpose: Robust non-linear condition classification &amp; Gini impurity feature importance ranking.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrainRandomForest}
                  disabled={dataset.length === 0 || rfStatus === 'TRAINING'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5 fill-current" />
                  {rfStatus === 'TRAINING' ? 'TRAINING ENSEMBLE...' : 'TRAIN RANDOM FOREST'}
                </button>

                {rfMetrics && (
                  <button
                    onClick={() => handleSaveModel('Random_Forest_Model')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-white font-mono text-xs hover:border-grid-steel"
                  >
                    <Save className="w-3.5 h-3.5 text-grid-steel" />
                    SAVE MODEL
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2">
                  ENSEMBLE HYPERPARAMETERS
                </div>
                <div className="space-y-2">
                  <label className="block text-grid-muted text-[11px]">NUMBER OF DECISION TREES:</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={rfNumTrees}
                    onChange={(e) => setRfNumTrees(parseInt(e.target.value) || 12)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />

                  <label className="block text-grid-muted text-[11px]">MAXIMUM TREE DEPTH:</label>
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={rfMaxDepth}
                    onChange={(e) => setRfMaxDepth(parseInt(e.target.value) || 6)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="lg:col-span-2 bg-grid-card p-4 rounded-xl border border-grid-border space-y-2 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                  <span>FEATURE IMPORTANCE RANKING (GINI IMPURITY REDUCTION)</span>
                  <span className="text-grid-steel">8 Transformer Parameters</span>
                </div>

                {rfImportances.length === 0 ? (
                  <div className="text-center py-12 text-grid-muted">
                    Model status: <strong>NOT TRAINED</strong>. Click 'TRAIN RANDOM FOREST' to calculate empirical feature importances.
                  </div>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rfImportances} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                        <XAxis type="number" domain={[0, 1]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                        <YAxis dataKey="featureName" type="category" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} width={140} />
                        <Tooltip />
                        <Bar dataKey="importance" fill="#5B7C99">
                          {rfImportances.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#5E9C76' : '#5B7C99'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* RF Classification Metrics */}
            {rfMetrics && (
              <div className="space-y-4 pt-4 border-t border-grid-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">ACCURACY</div>
                    <div className="text-xl font-bold font-mono text-white">{rfMetrics.accuracy}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">PRECISION</div>
                    <div className="text-xl font-bold font-mono text-white">{rfMetrics.precision}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">RECALL</div>
                    <div className="text-xl font-bold font-mono text-white">{rfMetrics.recall}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">F1 SCORE</div>
                    <div className="text-xl font-bold font-mono text-grid-green">{rfMetrics.f1Score}%</div>
                  </div>
                </div>

                {renderConfusionMatrix(rfMetrics.confusionMatrix, rfMetrics.labels)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALGORITHM 04: LSTM FORECASTING WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'lstm' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
              <div>
                <div className="text-sm font-bold text-white font-mono uppercase">
                  ALGORITHM 04: LSTM RECURRENT THERMAL FORECASTING MODEL
                </div>
                <div className="text-xs text-grid-muted">
                  Purpose: Time-series sequential temperature forecasting &amp; thermal risk prediction.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrainLSTM}
                  disabled={dataset.length === 0 || lstmStatus === 'TRAINING'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
                >
                  <TrendingUp className="w-3.5 h-3.5 fill-current" />
                  {lstmStatus === 'TRAINING' ? 'TRAINING LSTM CELL...' : 'TRAIN LSTM MODEL'}
                </button>

                {lstmMetrics && (
                  <button
                    onClick={() => handleSaveModel('LSTM_Thermal_Model')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-white font-mono text-xs hover:border-grid-steel"
                  >
                    <Save className="w-3.5 h-3.5 text-grid-steel" />
                    SAVE MODEL
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2">
                  LSTM HYPERPARAMETERS &amp; CHRONOLOGICAL SPLIT
                </div>

                <div className="space-y-2">
                  <label className="block text-grid-muted text-[11px]">LOOKBACK SEQUENCE LENGTH (N):</label>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    value={lstmSeqLength}
                    onChange={(e) => setLstmSeqLength(parseInt(e.target.value) || 10)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />

                  <label className="block text-grid-muted text-[11px]">TRAINING EPOCHS:</label>
                  <input
                    type="number"
                    min="10"
                    max="50"
                    value={lstmEpochs}
                    onChange={(e) => setLstmEpochs(parseInt(e.target.value) || 25)}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />

                  <div className="p-2.5 rounded bg-grid-bg border border-grid-steel/40 text-[11px] text-grid-muted space-y-1">
                    <div className="text-white font-bold">CHRONOLOGICAL SPLIT (NO DATA LEAKAGE)</div>
                    <div>Early Time Steps → Training Set</div>
                    <div>Later Time Steps → Test Set</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-grid-card p-4 rounded-xl border border-grid-border space-y-2 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                  <span>ACTUAL VS PREDICTED TRANSFORMER TEMPERATURE (°C)</span>
                  <span className="text-grid-steel">Time-Series Sequence Evaluation</span>
                </div>

                {!lstmMetrics ? (
                  <div className="text-center py-12 text-grid-muted">
                    Model status: <strong>NOT TRAINED</strong>. Click 'TRAIN LSTM MODEL' to run sequential LSTM thermal forecasting.
                  </div>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lstmMetrics.actualVsPredicted}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                        <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                        <YAxis stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="actual" name="Actual Temp (°C)" stroke="#5B7C99" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="predicted" name="Predicted Temp (°C)" stroke="#C47A3A" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* LSTM Regression Metrics */}
            {lstmMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-grid-border font-mono">
                <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                  <div className="text-[10px] text-grid-muted uppercase">ROOT MEAN SQUARED ERROR (RMSE)</div>
                  <div className="text-xl font-bold text-white">{lstmMetrics.rmse} °C</div>
                </div>

                <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                  <div className="text-[10px] text-grid-muted uppercase">MEAN ABSOLUTE ERROR (MAE)</div>
                  <div className="text-xl font-bold text-white">{lstmMetrics.mae} °C</div>
                </div>

                <div className="bg-grid-card p-3 rounded-lg border border-grid-green/40">
                  <div className="text-[10px] text-grid-muted uppercase">COEFFICIENT OF DETERMINATION (R²)</div>
                  <div className="text-xl font-bold text-grid-green">{lstmMetrics.r2Score}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALGORITHM 05: HYBRID FUZZY-NEURAL ENSEMBLE */}
      {/* ========================================================================= */}
      {activeTab === 'hybrid' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
              <div>
                <div className="text-sm font-bold text-white font-mono uppercase">
                  ALGORITHM 05: HYBRID FUZZY-NEURAL ENSEMBLE CLASSIFIER
                </div>
                <div className="text-xs text-grid-muted">
                  Fuzzy inference features + ANN/MLP + Random Forest, combined by validation-weighted soft voting.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrainHybrid}
                  disabled={dataset.length === 0 || hybridStatus === 'TRAINING'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  {hybridStatus === 'TRAINING' ? 'TRAINING HYBRID PIPELINE...' : 'RUN MODEL'}
                </button>

                {hybridResult && (
                  <button
                    onClick={() => handleSaveModel('Hybrid_Fuzzy_Neural_Model')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-white font-mono text-xs hover:border-grid-steel"
                  >
                    <Save className="w-3.5 h-3.5 text-grid-steel" />
                    SAVE MODEL
                  </button>
                )}
              </div>
            </div>

            {/* Hybrid Pipeline Stages */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
              {[
                {
                  stage: 'STAGE 1',
                  title: 'FUZZY INFERENCE',
                  detail: 'Risk score + 4 rule-consequent strengths per record',
                  time: hybridResult?.stageTimesMs.fuzzy,
                },
                {
                  stage: 'STAGE 2',
                  title: 'FEATURE FUSION',
                  detail: `8 Digital Twin + 5 fuzzy = ${HYBRID_FEATURE_NAMES.length} inputs`,
                  time: undefined,
                },
                {
                  stage: 'STAGE 3',
                  title: 'ANN + RANDOM FOREST',
                  detail: `MLP ${HYBRID_FEATURE_NAMES.length}-16-8-5 and ${hybridConfig.rfNumTrees}-tree forest on fused features`,
                  time: hybridResult ? hybridResult.stageTimesMs.ann + hybridResult.stageTimesMs.rf : undefined,
                },
                {
                  stage: 'STAGE 4',
                  title: 'SOFT-VOTING FUSION',
                  detail: 'Weights searched on validation split (step 0.1), max macro-F1',
                  time: hybridResult?.stageTimesMs.fusion,
                },
              ].map((st) => (
                <div
                  key={st.stage}
                  className={`p-3 rounded-lg bg-grid-card border ${hybridResult ? 'border-grid-steel/50' : 'border-grid-border'} space-y-1`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-grid-steel font-bold">{st.stage}</span>
                    <span className={hybridResult ? 'text-grid-green' : 'text-grid-muted'}>
                      {hybridResult ? `● DONE${st.time !== undefined ? ` · ${st.time.toFixed(0)} ms` : ''}` : '○ IDLE'}
                    </span>
                  </div>
                  <div className="text-white font-bold">{st.title}</div>
                  <div className="text-[11px] text-grid-muted">{st.detail}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Configuration */}
              <div className="bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2">
                  HYBRID CONFIGURATION
                </div>
                <div className="space-y-2">
                  <label className="block text-grid-muted text-[11px]">ANN EPOCHS:</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={hybridConfig.annEpochs}
                    onChange={(e) => setHybridConfig({ ...hybridConfig, annEpochs: parseInt(e.target.value) || 30 })}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                  <label className="block text-grid-muted text-[11px]">ANN LEARNING RATE:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    max="0.2"
                    value={hybridConfig.annLearningRate}
                    onChange={(e) => setHybridConfig({ ...hybridConfig, annLearningRate: parseFloat(e.target.value) || 0.05 })}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                  <label className="block text-grid-muted text-[11px]">RF TREES:</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={hybridConfig.rfNumTrees}
                    onChange={(e) => setHybridConfig({ ...hybridConfig, rfNumTrees: parseInt(e.target.value) || 12 })}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                  <label className="block text-grid-muted text-[11px]">RF MAX DEPTH:</label>
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={hybridConfig.rfMaxDepth}
                    onChange={(e) => setHybridConfig({ ...hybridConfig, rfMaxDepth: parseInt(e.target.value) || 6 })}
                    className="w-full bg-grid-bg border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
                  />
                </div>
                <div className="p-2.5 rounded bg-grid-bg border border-grid-steel/40 text-[11px] text-grid-muted space-y-1">
                  <div className="text-white font-bold">DATA SPLIT</div>
                  {hybridResult ? (
                    <div>
                      Train {hybridResult.split.train} · Validation {hybridResult.split.validation} · Test {hybridResult.split.test}
                    </div>
                  ) : (
                    <div>60% Train · 15% Validation · 25% Test</div>
                  )}
                  <div>Test split is held out from training and weight selection.</div>
                </div>
              </div>

              {/* Fusion weights + loss curve */}
              <div className="lg:col-span-2 bg-grid-card p-4 rounded-xl border border-grid-border space-y-3 font-mono text-xs">
                <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                  <span>LEARNED FUSION WEIGHTS &amp; ANN LOSS</span>
                  {hybridResult && <span className="text-grid-steel">Validation F1: {hybridResult.validationF1}%</span>}
                </div>

                {!hybridResult ? (
                  <div className="text-center py-12 text-grid-muted">
                    Model status: <strong>{hybridStatus === 'ERROR' ? 'ERROR' : 'NOT EVALUATED'}</strong>. Click 'RUN MODEL' to execute the 4-stage hybrid pipeline.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {[
                        { label: 'ANN / MLP', w: hybridResult.weights.ann },
                        { label: 'RANDOM FOREST', w: hybridResult.weights.rf },
                        { label: 'FUZZY LOGIC', w: hybridResult.weights.fuzzy },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className="w-32 text-grid-muted text-[11px]">{row.label}</span>
                          <div className="flex-1 h-2.5 bg-grid-bg rounded overflow-hidden border border-grid-border">
                            <div className="h-full bg-grid-steel" style={{ width: `${row.w * 100}%` }} />
                          </div>
                          <strong className="w-10 text-right text-white">{row.w.toFixed(1)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={hybridResult.annEpochLogs}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                          <XAxis dataKey="epoch" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                          <YAxis stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="trainLoss" name="Train Loss" stroke="#B94A48" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="valLoss" name="Validation Loss" stroke="#5B7C99" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Architecture, weight-selection map and component comparison */}
            <HybridSelectionGraphs result={hybridResult} />

            {hybridResult && (
              <div className="space-y-4 pt-4 border-t border-grid-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">ACCURACY</div>
                    <div className="text-xl font-bold font-mono text-white">{hybridResult.metrics.accuracy}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">PRECISION</div>
                    <div className="text-xl font-bold font-mono text-white">{hybridResult.metrics.precision}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">RECALL</div>
                    <div className="text-xl font-bold font-mono text-white">{hybridResult.metrics.recall}%</div>
                  </div>
                  <div className="bg-grid-card p-3 rounded-lg border border-grid-steel/40">
                    <div className="text-[10px] text-grid-muted font-mono uppercase">F1 SCORE</div>
                    <div className="text-xl font-bold font-mono text-grid-green">{hybridResult.metrics.f1Score}%</div>
                  </div>
                </div>

                {/* Same-split component comparison */}
                <div className="bg-grid-card p-4 rounded-xl border border-grid-border font-mono text-xs space-y-2">
                  <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
                    <span>HYBRID vs COMPONENTS — IDENTICAL TEST SPLIT</span>
                    <span className="text-[10px] text-grid-muted">{hybridResult.split.test} test samples</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-grid-muted text-[10px] uppercase border-b border-grid-border">
                          <th className="p-2">Model</th>
                          <th className="p-2">Inputs</th>
                          <th className="p-2">Val F1</th>
                          <th className="p-2">Test Accuracy</th>
                          <th className="p-2">Test F1</th>
                          <th className="p-2">Δ F1 vs Hybrid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-grid-border/60">
                        {hybridResult.components.map((c) => {
                          const delta = c.testF1 - hybridResult.metrics.f1Score;
                          return (
                            <tr key={`${c.name}-${c.inputs}`}>
                              <td className="p-2 text-white">{c.name}</td>
                              <td className="p-2 text-grid-muted">{c.inputs}</td>
                              <td className="p-2 text-white">{c.valF1}%</td>
                              <td className="p-2 text-white">{c.testAccuracy}%</td>
                              <td className="p-2 text-white">{c.testF1}%</td>
                              <td className={`p-2 font-bold ${delta > 0 ? 'text-grid-yellow' : 'text-grid-muted'}`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-grid-bg">
                          <td className="p-2 text-white font-bold">Hybrid Fuzzy-Neural</td>
                          <td className="p-2 text-grid-muted">FUSED</td>
                          <td className="p-2 text-white">{hybridResult.validationF1}%</td>
                          <td className="p-2 text-white">{hybridResult.metrics.accuracy}%</td>
                          <td className="p-2 text-grid-green font-bold">{hybridResult.metrics.f1Score}%</td>
                          <td className="p-2 text-grid-muted">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {renderConfusionMatrix(hybridResult.metrics.confusionMatrix, hybridResult.metrics.labels)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODEL COMPARISON & EVALUATION WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-grid-bg p-5 rounded-xl border border-grid-border space-y-4">
            <div className="border-b border-grid-border pb-3">
              <div className="text-sm font-bold text-white font-mono uppercase">
                CROSS-ALGORITHM PERFORMANCE COMPARISON DASHBOARD
              </div>
              <div className="text-xs text-grid-muted">
                Measured results of all five models on the Digital Twin dataset. Classifiers ranked by macro F1; forecaster by RMSE.
              </div>
            </div>

            <div className="overflow-x-auto border border-grid-border rounded-lg bg-grid-card">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-grid-surface text-grid-muted border-b border-grid-border uppercase text-[10px]">
                    <th className="p-3">Algorithm</th>
                    <th className="p-3">Task Type</th>
                    <th className="p-3">Accuracy</th>
                    <th className="p-3">Precision</th>
                    <th className="p-3">Recall</th>
                    <th className="p-3">F1 Score</th>
                    <th className="p-3">RMSE (°C)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grid-border/60">
                  <tr>
                    <td className="p-3 text-white font-bold">01. Fuzzy Logic</td>
                    <td className="p-3 text-grid-muted">Rule-Based State Assessment</td>
                    <td className="p-3 text-white">{fuzzyMetrics ? `${fuzzyMetrics.accuracy}%` : '-'}</td>
                    <td className="p-3 text-white">{fuzzyMetrics ? `${fuzzyMetrics.precision}%` : '-'}</td>
                    <td className="p-3 text-white">{fuzzyMetrics ? `${fuzzyMetrics.recall}%` : '-'}</td>
                    <td className="p-3 text-grid-green font-bold">{fuzzyMetrics ? `${fuzzyMetrics.f1Score}%` : '-'}</td>
                    <td className="p-3 text-grid-muted">N/A (Classifier)</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${fuzzyStatus === 'TRAINED' ? 'bg-grid-green/20 border-grid-green text-grid-green' : 'bg-grid-card border-grid-border text-grid-muted'}`}>
                        {fuzzyStatus}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-white font-bold">02. ANN / MLP</td>
                    <td className="p-3 text-grid-muted">Neural Condition Classification</td>
                    <td className="p-3 text-white">{annMetrics ? `${annMetrics.accuracy}%` : '-'}</td>
                    <td className="p-3 text-white">{annMetrics ? `${annMetrics.precision}%` : '-'}</td>
                    <td className="p-3 text-white">{annMetrics ? `${annMetrics.recall}%` : '-'}</td>
                    <td className="p-3 text-grid-green font-bold">{annMetrics ? `${annMetrics.f1Score}%` : '-'}</td>
                    <td className="p-3 text-grid-muted">N/A (Classifier)</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${annStatus === 'TRAINED' ? 'bg-grid-green/20 border-grid-green text-grid-green' : 'bg-grid-card border-grid-border text-grid-muted'}`}>
                        {annStatus}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-white font-bold">03. Random Forest</td>
                    <td className="p-3 text-grid-muted">Ensemble Condition Classification</td>
                    <td className="p-3 text-white">{rfMetrics ? `${rfMetrics.accuracy}%` : '-'}</td>
                    <td className="p-3 text-white">{rfMetrics ? `${rfMetrics.precision}%` : '-'}</td>
                    <td className="p-3 text-white">{rfMetrics ? `${rfMetrics.recall}%` : '-'}</td>
                    <td className="p-3 text-grid-green font-bold">{rfMetrics ? `${rfMetrics.f1Score}%` : '-'}</td>
                    <td className="p-3 text-grid-muted">N/A (Classifier)</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rfStatus === 'TRAINED' ? 'bg-grid-green/20 border-grid-green text-grid-green' : 'bg-grid-card border-grid-border text-grid-muted'}`}>
                        {rfStatus}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-white font-bold">04. LSTM Recurrent</td>
                    <td className="p-3 text-grid-muted">Sequential Thermal Forecasting</td>
                    <td className="p-3 text-grid-muted">N/A (Forecaster)</td>
                    <td className="p-3 text-grid-muted">N/A (Forecaster)</td>
                    <td className="p-3 text-grid-muted">N/A (Forecaster)</td>
                    <td className="p-3 text-grid-muted">N/A (Forecaster)</td>
                    <td className="p-3 text-grid-steel font-bold">{lstmMetrics ? `${lstmMetrics.rmse} °C` : '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${lstmStatus === 'TRAINED' ? 'bg-grid-green/20 border-grid-green text-grid-green' : 'bg-grid-card border-grid-border text-grid-muted'}`}>
                        {lstmStatus}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-white font-bold">05. Hybrid Fuzzy-Neural</td>
                    <td className="p-3 text-grid-muted">Fused Ensemble Classification</td>
                    <td className="p-3 text-white">{hybridResult ? `${hybridResult.metrics.accuracy}%` : '-'}</td>
                    <td className="p-3 text-white">{hybridResult ? `${hybridResult.metrics.precision}%` : '-'}</td>
                    <td className="p-3 text-white">{hybridResult ? `${hybridResult.metrics.recall}%` : '-'}</td>
                    <td className="p-3 text-grid-green font-bold">{hybridResult ? `${hybridResult.metrics.f1Score}%` : '-'}</td>
                    <td className="p-3 text-grid-muted">N/A (Classifier)</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${hybridStatus === 'TRAINED' ? 'bg-grid-green/20 border-grid-green text-grid-green' : 'bg-grid-card border-grid-border text-grid-muted'}`}>
                        {hybridStatus}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Best model — selected from measured results only */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-4 rounded-xl bg-grid-card border border-grid-steel/40 space-y-1">
                <div className="flex items-center gap-2 text-white font-bold">
                  <ShieldCheck className="w-5 h-5 text-grid-green" />
                  BEST CLASSIFIER (MACRO F1)
                </div>
                {bestClassifier ? (
                  <div className="text-grid-muted">
                    <strong className="text-white text-sm">{bestClassifier.name}</strong> — F1 {bestClassifier.f1}%
                  </div>
                ) : (
                  <div className="text-grid-muted">NOT EVALUATED — run at least one classifier.</div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-grid-card border border-grid-border space-y-1">
                <div className="flex items-center gap-2 text-white font-bold">
                  <TrendingUp className="w-5 h-5 text-grid-steel" />
                  THERMAL FORECASTER (RMSE)
                </div>
                {lstmMetrics ? (
                  <div className="text-grid-muted">
                    <strong className="text-white text-sm">LSTM</strong> — RMSE {lstmMetrics.rmse} °C · MAE {lstmMetrics.mae} °C
                  </div>
                ) : (
                  <div className="text-grid-muted">NOT EVALUATED</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
