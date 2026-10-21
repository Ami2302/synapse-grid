import React, { useState } from 'react';
import type { ScenarioType } from '../simulation/types';
import { Database, Cpu, ArrowRight, RefreshCw } from 'lucide-react';

interface DatasetGeneratorPanelProps {
  onStartBatchGeneration: (
    transformersCount: number,
    runsPerScenario: Record<ScenarioType, number>,
    seed: number
  ) => void;
  isGenerating: boolean;
  progressPercent: number;
  currentRunInfo: string;
  generatedRecordsCount: number;
}

export const DatasetGeneratorPanel: React.FC<DatasetGeneratorPanelProps> = ({
  onStartBatchGeneration,
  isGenerating,
  progressPercent,
  currentRunInfo,
}) => {
  const [transformersCount, setTransformersCount] = useState<number>(4);
  const [seed, setSeed] = useState<number>(42);

  const [runs, setRuns] = useState<Record<ScenarioType, number>>({
    NORMAL_OPERATION: 5,
    LOAD_RAMP: 3,
    MORNING_PEAK: 3,
    EVENING_PEAK: 3,
    SUDDEN_LOAD_INCREASE: 2,
    SUSTAINED_OVERLOAD: 4,
    VOLTAGE_SAG: 2,
    THERMAL_STRESS: 3,
    INTERMITTENT_ANOMALY: 3,
    FAULT_EVENT: 4,
    RECOVERY: 2,
  });

  const handleRunsChange = (type: ScenarioType, val: number) => {
    setRuns({
      ...runs,
      [type]: Math.max(0, val),
    });
  };

  const totalRuns = Object.values(runs).reduce((a, b) => a + b, 0) * transformersCount;
  const estimatedSamples = totalRuns * 180;

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-6 flex flex-col gap-6 shadow-xl max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-grid-steel" />
            <h2 className="text-lg font-bold text-white font-mono tracking-wider">
              DIGITAL TWIN SYNTHETIC DATASET GENERATOR
            </h2>
          </div>
          <p className="text-xs text-grid-muted mt-1">
            Execute batch multi-run simulations across transformers T1–T4 with balanced scenario weighting for AI model training.
          </p>
        </div>

        <button
          onClick={() => onStartBatchGeneration(transformersCount, runs, seed)}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Cpu className="w-4 h-4 fill-current" />
          )}
          {isGenerating ? 'GENERATING BATCH DATASET...' : 'GENERATE BATCH DATASET'}
        </button>
      </div>

      <div className="bg-grid-bg p-4 rounded-xl border border-grid-border">
        <div className="text-xs font-mono text-grid-muted uppercase mb-3 font-bold">
          DATA GENERATION PIPELINE WORKFLOW
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs">
          <div className="px-3 py-2 rounded bg-grid-card border border-grid-steel/50 text-white text-center w-full sm:w-auto">
            1. DIGITAL TWIN
          </div>
          <ArrowRight className={`w-4 h-4 text-grid-muted ${isGenerating ? 'text-grid-steel animate-pulse' : ''}`} />

          <div className="px-3 py-2 rounded bg-grid-card border border-grid-steel/50 text-white text-center w-full sm:w-auto">
            2. SCENARIO ENGINE
          </div>
          <ArrowRight className={`w-4 h-4 text-grid-muted ${isGenerating ? 'text-grid-steel animate-pulse' : ''}`} />

          <div className="px-3 py-2 rounded bg-grid-card border border-grid-steel/50 text-white text-center w-full sm:w-auto">
            3. TIME-SERIES SIM
          </div>
          <ArrowRight className={`w-4 h-4 text-grid-muted ${isGenerating ? 'text-grid-steel animate-pulse' : ''}`} />

          <div className="px-3 py-2 rounded bg-grid-card border border-grid-steel/50 text-white text-center w-full sm:w-auto">
            4. DATA VALIDATION
          </div>
          <ArrowRight className={`w-4 h-4 text-grid-muted ${isGenerating ? 'text-grid-steel animate-pulse' : ''}`} />

          <div className="px-3 py-2 rounded bg-grid-card border border-grid-steel/50 text-white text-center w-full sm:w-auto">
            5. DATASET PREVIEW
          </div>
          <ArrowRight className={`w-4 h-4 text-grid-muted ${isGenerating ? 'text-grid-steel animate-pulse' : ''}`} />

          <div className="px-3 py-2 rounded bg-grid-card border border-grid-green/50 text-grid-green text-center w-full sm:w-auto font-bold">
            6. CSV / JSON EXPORT
          </div>
        </div>
      </div>

      {isGenerating && (
        <div className="bg-grid-card p-4 rounded-xl border border-grid-steel shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-grid-steel" />
              SIMULATION PIPELINE ACTIVE
            </span>
            <span className="text-white font-bold">{progressPercent}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-grid-bg overflow-hidden border border-grid-border">
            <div
              className="h-full bg-gradient-to-r from-grid-steel to-grid-teal transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-grid-muted">
            <div>Current Task: <strong className="text-white">{currentRunInfo}</strong></div>
            <div>Total Sim Runs: <strong className="text-white">{totalRuns}</strong></div>
            <div>Estimated Samples: <strong className="text-white">{estimatedSamples}</strong></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-grid-bg p-4 rounded-xl border border-grid-border space-y-3">
          <h3 className="text-xs font-mono font-bold text-white uppercase border-b border-grid-border pb-2">
            GLOBAL PARAMETERS
          </h3>

          <div>
            <label className="block text-xs font-mono text-grid-muted mb-1">
              NUMBER OF TRANSFORMERS
            </label>
            <select
              value={transformersCount}
              onChange={(e) => setTransformersCount(parseInt(e.target.value))}
              className="w-full bg-grid-card border border-grid-border rounded px-3 py-1.5 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            >
              <option value={1}>1 Transformer (T1 only)</option>
              <option value={2}>2 Transformers (T1, T2)</option>
              <option value={3}>3 Transformers (T1, T2, T3)</option>
              <option value={4}>4 Transformers (T1, T2, T3, T4)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-grid-muted mb-1">
              BASE RANDOM SEED
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
              className="w-full bg-grid-card border border-grid-border rounded px-3 py-1.5 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div className="p-3 rounded bg-grid-card border border-grid-border text-xs font-mono text-grid-muted space-y-1">
            <div>Total Simulation Runs: <strong className="text-white">{totalRuns}</strong></div>
            <div>Est. Dataset Records: <strong className="text-white">{estimatedSamples}</strong></div>
            <div>Columns: <strong className="text-white">18 Features</strong></div>
          </div>
        </div>

        <div className="md:col-span-2 bg-grid-bg p-4 rounded-xl border border-grid-border space-y-3">
          <h3 className="text-xs font-mono font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between">
            <span>SCENARIO CLASS BALANCING MATRIX</span>
            <span className="text-[10px] text-grid-muted font-normal">RUNS PER SCENARIO</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
            {Object.keys(runs).map((scKey) => {
              const type = scKey as ScenarioType;
              return (
                <div key={type} className="flex items-center justify-between p-2 rounded bg-grid-card border border-grid-border">
                  <span className="text-[11px] text-grid-muted font-bold truncate max-w-[130px]" title={type}>
                    {type.replace('_', ' ')}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={runs[type]}
                    onChange={(e) => handleRunsChange(type, parseInt(e.target.value) || 0)}
                    className="w-16 bg-grid-bg border border-grid-border rounded px-2 py-0.5 text-white font-mono text-xs text-center focus:border-grid-steel"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
