import React from 'react';
import { Play, Pause, RotateCcw, Download, Zap, Settings, Cpu } from 'lucide-react';
import type { TransformerConfig, ScenarioConfig, ScenarioType } from '../simulation/types';
import { DEFAULT_SCENARIO_CONFIGS } from '../simulation/initialData';

interface SimulationControlsProps {
  selectedTransformerId: string;
  setSelectedTransformerId: (id: string) => void;
  transformerConfig: TransformerConfig;
  setTransformerConfig: (config: TransformerConfig) => void;
  scenarioConfig: ScenarioConfig;
  setScenarioConfig: (config: ScenarioConfig) => void;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onGenerateDataset: () => void;
  onExportCSV: () => void;
  onInjectFault: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  selectedTransformerId,
  setSelectedTransformerId,
  transformerConfig,
  setTransformerConfig,
  scenarioConfig,
  setScenarioConfig,
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onReset,
  onGenerateDataset,
  onExportCSV,
  onInjectFault,
}) => {
  const handleTransformerChange = (field: keyof TransformerConfig, val: number) => {
    setTransformerConfig({
      ...transformerConfig,
      [field]: val,
    });
  };

  const handleScenarioChange = (field: keyof ScenarioConfig, val: number | boolean) => {
    setScenarioConfig({
      ...scenarioConfig,
      [field]: val,
    });
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-4 shadow-md">
      <div className="flex items-center justify-between border-b border-grid-border pb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-grid-steel" />
          <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            SIMULATION CONTROL
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-grid-bg text-grid-muted font-mono border border-grid-border">
          SCADA ENGINE
        </span>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="block text-grid-muted font-mono text-[11px] mb-1">
            TRANSFORMER ID
          </label>
          <select
            value={selectedTransformerId}
            onChange={(e) => setSelectedTransformerId(e.target.value)}
            className="w-full bg-grid-card border border-grid-border rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:border-grid-steel focus:outline-none transition-colors"
          >
            <option value="T1">T1 — Feeder Alpha (10 MVA)</option>
            <option value="T2">T2 — Feeder Beta (12.5 MVA)</option>
            <option value="T3">T3 — Feeder Gamma (7.5 MVA)</option>
            <option value="T4">T4 — Feeder Delta (15.0 MVA)</option>
          </select>
        </div>

        <div>
          <label className="block text-grid-muted font-mono text-[11px] mb-1">
            ACTIVE SCENARIO SELECTION
          </label>
          <select
            value={scenarioConfig.scenarioType}
            onChange={(e) => {
              const scType = e.target.value as ScenarioType;
              const preset = DEFAULT_SCENARIO_CONFIGS[scType];
              if (preset) {
                setScenarioConfig({ ...preset });
              }
            }}
            className="w-full bg-grid-card border border-grid-border rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:border-grid-steel focus:outline-none transition-colors"
          >
            <option value="NORMAL_OPERATION">🟢 Normal Operation Baseline</option>
            <option value="LOAD_RAMP">🔵 Linear Load Ramp</option>
            <option value="MORNING_PEAK">🔵 Morning Peak Demand Surge</option>
            <option value="EVENING_PEAK">🔵 Evening Residential Peak</option>
            <option value="SUDDEN_LOAD_INCREASE">🟡 Step Load Increase</option>
            <option value="SUSTAINED_OVERLOAD">🔴 Sustained Overload (&gt;120%)</option>
            <option value="VOLTAGE_SAG">🟡 Grid Voltage Sag (-15%)</option>
            <option value="THERMAL_STRESS">🟠 Extreme Ambient Thermal Stress (42°C)</option>
            <option value="INTERMITTENT_ANOMALY">🟡 Intermittent Anomalies</option>
            <option value="FAULT_EVENT">🔴 Phase Fault Trip Injection</option>
            <option value="RECOVERY">🟢 Post-Fault Recovery</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              RATED CAPACITY (MVA)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={transformerConfig.ratedCapacityMVA}
              onChange={(e) => handleTransformerChange('ratedCapacityMVA', parseFloat(e.target.value) || 1)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              PRIMARY VOLTAGE (kV)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="132"
              value={transformerConfig.primaryVoltageKV}
              onChange={(e) => handleTransformerChange('primaryVoltageKV', parseFloat(e.target.value) || 11)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              SECONDARY VOLTAGE (kV)
            </label>
            <input
              type="number"
              step="0.005"
              min="0.1"
              max="33"
              value={transformerConfig.secondaryVoltageKV}
              onChange={(e) => handleTransformerChange('secondaryVoltageKV', parseFloat(e.target.value) || 0.415)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              INITIAL LOAD %
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="180"
              value={scenarioConfig.initialLoadPercent}
              onChange={(e) => handleScenarioChange('initialLoadPercent', parseFloat(e.target.value) || 50)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              POWER FACTOR
            </label>
            <input
              type="number"
              step="0.01"
              min="0.5"
              max="1.0"
              value={scenarioConfig.powerFactor}
              onChange={(e) => handleScenarioChange('powerFactor', parseFloat(e.target.value) || 0.95)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              AMBIENT TEMP (°C)
            </label>
            <input
              type="number"
              step="1"
              min="-10"
              max="60"
              value={scenarioConfig.ambientTempC}
              onChange={(e) => handleScenarioChange('ambientTempC', parseFloat(e.target.value) || 28)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              SIM DURATION (s)
            </label>
            <input
              type="number"
              step="10"
              min="10"
              max="3600"
              value={scenarioConfig.durationSeconds}
              onChange={(e) => handleScenarioChange('durationSeconds', parseInt(e.target.value) || 180)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-grid-muted text-[10px] font-mono mb-1">
              SAMPLING INTERVAL (s)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="60"
              value={scenarioConfig.samplingIntervalSeconds}
              onChange={(e) => handleScenarioChange('samplingIntervalSeconds', parseInt(e.target.value) || 1)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-grid-muted text-[10px] font-mono mb-1">
            RANDOM SEED (REPRODUCIBILITY)
          </label>
          <input
            type="number"
            step="1"
            value={scenarioConfig.randomSeed}
            onChange={(e) => handleScenarioChange('randomSeed', parseInt(e.target.value) || 42)}
            className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-grid-border">
        {/* Main Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {!isRunning || isPaused ? (
            <button
              onClick={isRunning ? onResume : onStart}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-grid-steel text-white font-mono text-xs font-bold hover:bg-grid-steel/80 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isPaused ? 'RESUME' : 'START SIMULATION'}
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-grid-yellow/20 border border-grid-yellow text-grid-yellow font-mono text-xs font-bold hover:bg-grid-yellow/30 transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              PAUSE
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-grid-card border border-grid-border text-grid-muted font-mono text-xs hover:text-white hover:border-grid-steel transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET
          </button>
        </div>

        {/* Controlled Fault Injection (Controlled Deep Red) */}
        <button
          onClick={onInjectFault}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-grid-red/20 border border-grid-red text-grid-red font-mono text-xs font-bold hover:bg-grid-red/30 transition-all"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          INJECT OVERLOAD / FAULT
        </button>

        {/* Dataset Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onGenerateDataset}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-grid-card border border-grid-steel/50 text-white font-mono text-[11px] hover:bg-grid-steel/20 transition-all"
          >
            <Cpu className="w-3.5 h-3.5 text-grid-steel" />
            GEN DATASET
          </button>

          <button
            onClick={onExportCSV}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-grid-green/15 border border-grid-green/60 text-grid-green font-mono text-[11px] font-bold hover:bg-grid-green/25 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT CSV
          </button>
        </div>
      </div>
    </div>
  );
};
