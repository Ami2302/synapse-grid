import React from 'react';
import type { ScenarioConfig, ScenarioType } from '../simulation/types';
import { DEFAULT_SCENARIO_CONFIGS } from '../simulation/initialData';
import { Sliders, Zap } from 'lucide-react';

interface ScenarioBuilderProps {
  config: ScenarioConfig;
  onChangeConfig: (newConfig: ScenarioConfig) => void;
  onApplyAndRun: (config: ScenarioConfig) => void;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({
  config,
  onChangeConfig,
  onApplyAndRun,
}) => {
  const scenarioKeys = Object.keys(DEFAULT_SCENARIO_CONFIGS) as ScenarioType[];

  const handleSelectPreset = (type: ScenarioType) => {
    const preset = DEFAULT_SCENARIO_CONFIGS[type];
    if (preset) {
      onChangeConfig({ ...preset });
    }
  };

  const handleChange = (field: keyof ScenarioConfig, val: any) => {
    onChangeConfig({
      ...config,
      [field]: val,
    });
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-6 flex flex-col gap-6 shadow-xl max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-grid-steel" />
            <h2 className="text-lg font-bold text-white font-mono tracking-wider">
              DIGITAL TWIN SCENARIO BUILDER
            </h2>
          </div>
          <p className="text-xs text-grid-muted mt-1">
            Configure dynamic physical load profiles, thermal stress factors, voltage sags, and fault injection vectors.
          </p>
        </div>

        <button
          onClick={() => onApplyAndRun(config)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-grid-steel text-white font-mono font-bold text-xs hover:bg-grid-steel/80 transition-all shadow-sm"
        >
          <Zap className="w-4 h-4 fill-current" />
          LOAD & RUN SCENARIO
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-mono text-white font-bold uppercase tracking-wider">
          PRESET SCENARIO PROFILES
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {scenarioKeys.map((type) => {
            const sc = DEFAULT_SCENARIO_CONFIGS[type];
            const isSelected = config.scenarioType === type;
            return (
              <button
                key={type}
                onClick={() => handleSelectPreset(type)}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-grid-elevated border-grid-steel shadow-md ring-1 ring-grid-steel'
                    : 'bg-grid-card border-grid-border hover:border-grid-dim text-grid-muted'
                }`}
              >
                <div className="text-[11px] font-mono font-bold text-white mb-1 line-clamp-1">
                  {sc.name}
                </div>
                <div className="text-[10px] font-mono text-grid-muted line-clamp-2">
                  {sc.description}
                </div>
                <span className="mt-2 text-[9px] font-mono text-grid-steel uppercase tracking-wider font-bold">
                  {isSelected ? '✓ ACTIVE' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-grid-bg p-5 rounded-xl border border-grid-border">
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-grid-steel uppercase tracking-wider border-b border-grid-border pb-2">
            1. LOAD CURVE & TIMING
          </h3>

          <div>
            <label className="block text-xs font-mono text-grid-muted mb-1">SCENARIO NAME</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-grid-card border border-grid-border rounded px-3 py-1.5 text-white font-mono text-xs focus:border-grid-steel focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">INITIAL LOAD %</label>
              <input
                type="number"
                value={config.initialLoadPercent}
                onChange={(e) => handleChange('initialLoadPercent', parseFloat(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">PEAK LOAD %</label>
              <input
                type="number"
                value={config.peakLoadPercent}
                onChange={(e) => handleChange('peakLoadPercent', parseFloat(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">RAMP TIME (s)</label>
              <input
                type="number"
                value={config.rampTimeSeconds}
                onChange={(e) => handleChange('rampTimeSeconds', parseInt(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">DURATION (s)</label>
              <input
                type="number"
                value={config.durationSeconds}
                onChange={(e) => handleChange('durationSeconds', parseInt(e.target.value) || 180)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-grid-amber uppercase tracking-wider border-b border-grid-border pb-2">
            2. AMBIENT & ELECTRICAL STRESS
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">AMBIENT TEMP (°C)</label>
              <input
                type="number"
                value={config.ambientTempC}
                onChange={(e) => handleChange('ambientTempC', parseFloat(e.target.value) || 28)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">VOLTAGE VAR (%)</label>
              <input
                type="number"
                value={config.voltageVariationPercent}
                onChange={(e) => handleChange('voltageVariationPercent', parseFloat(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">POWER FACTOR</label>
              <input
                type="number"
                step="0.01"
                value={config.powerFactor}
                onChange={(e) => handleChange('powerFactor', parseFloat(e.target.value) || 0.95)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">THERMAL STRESS</label>
              <input
                type="number"
                step="0.1"
                value={config.thermalStressFactor}
                onChange={(e) => handleChange('thermalStressFactor', parseFloat(e.target.value) || 1.0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-grid-muted mb-1">RECOVERY TIME (s)</label>
            <input
              type="number"
              value={config.recoveryTimeSeconds}
              onChange={(e) => handleChange('recoveryTimeSeconds', parseInt(e.target.value) || 0)}
              className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-grid-red uppercase tracking-wider border-b border-grid-border pb-2 flex items-center justify-between">
            <span>3. FAULT INJECTION</span>
            <span className="text-[10px] font-normal text-grid-muted">SYNTHETIC ANOMALIES</span>
          </h3>

          <div className="flex items-center justify-between bg-grid-card p-2.5 rounded border border-grid-border">
            <span className="text-xs font-mono text-white">Enable Fault Injection:</span>
            <input
              type="checkbox"
              checked={config.faultInjection}
              onChange={(e) => handleChange('faultInjection', e.target.checked)}
              className="w-4 h-4 accent-grid-red rounded cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">FAULT START (s)</label>
              <input
                type="number"
                disabled={!config.faultInjection}
                value={config.faultStartTimeSeconds}
                onChange={(e) => handleChange('faultStartTimeSeconds', parseInt(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">FAULT DURATION (s)</label>
              <input
                type="number"
                disabled={!config.faultInjection}
                value={config.faultDurationSeconds}
                onChange={(e) => handleChange('faultDurationSeconds', parseInt(e.target.value) || 0)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">FAULT SEVERITY (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                disabled={!config.faultInjection}
                value={config.faultSeverity}
                onChange={(e) => handleChange('faultSeverity', parseInt(e.target.value) || 1)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-grid-muted mb-1">RANDOM SEED</label>
              <input
                type="number"
                value={config.randomSeed}
                onChange={(e) => handleChange('randomSeed', parseInt(e.target.value) || 42)}
                className="w-full bg-grid-card border border-grid-border rounded px-2.5 py-1 text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
