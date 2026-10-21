import React from 'react';
import type { TransformerState, TransformerConfig } from '../simulation/types';
import { Activity, ShieldCheck, Zap, Thermometer, Gauge, Radio } from 'lucide-react';

interface LiveTwinStatePanelProps {
  state: TransformerState;
  config: TransformerConfig;
}

export const LiveTwinStatePanel: React.FC<LiveTwinStatePanelProps> = ({ state, config }) => {
  const getStateStyle = (operatingState: string) => {
    switch (operatingState) {
      case 'WARNING':
        return {
          bg: 'bg-grid-yellow/15',
          border: 'border-grid-yellow/50',
          text: 'text-grid-yellow',
        };
      case 'HIGH_STRESS':
        return {
          bg: 'bg-grid-amber/15',
          border: 'border-grid-amber/50',
          text: 'text-grid-amber',
        };
      case 'OVERLOAD':
      case 'FAULT':
        return {
          bg: 'bg-grid-red/20',
          border: 'border-grid-red',
          text: 'text-grid-red',
        };
      default:
        return {
          bg: 'bg-grid-green/15',
          border: 'border-grid-green/40',
          text: 'text-grid-green',
        };
    }
  };

  const statusStyle = getStateStyle(state.operatingState);

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-4 shadow-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-grid-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-grid-steel" />
          <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            LIVE TWIN STATE
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-grid-bg text-white font-mono border border-grid-border">
          TRANSFORMER {config.id}
        </span>
      </div>

      {/* Primary Instrumentation Grid (WARM WHITE NUMBERS) */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* LOAD % */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-border shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>LOAD</span>
            <Gauge className="w-3.5 h-3.5 text-grid-steel" />
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-white flex items-baseline justify-between">
            <span>{state.loadPercent.toFixed(1)} %</span>
            <span className={`w-2 h-2 rounded-full ${state.loadPercent >= 115 ? 'bg-grid-red' : state.loadPercent >= 85 ? 'bg-grid-yellow' : 'bg-grid-green'}`}></span>
          </div>
        </div>

        {/* TEMPERATURE */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-border shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>TEMPERATURE</span>
            <Thermometer className="w-3.5 h-3.5 text-grid-steel" />
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-white flex items-baseline justify-between">
            <span>{state.transformerTemperatureC.toFixed(1)} °C</span>
            <span className={`w-2 h-2 rounded-full ${state.transformerTemperatureC >= 90 ? 'bg-grid-red' : state.transformerTemperatureC >= 75 ? 'bg-grid-yellow' : 'bg-grid-green'}`}></span>
          </div>
        </div>

        {/* VOLTAGE */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-border shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>VOLTAGE</span>
            <Zap className="w-3.5 h-3.5 text-grid-steel" />
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-white">
            {state.voltageKV.toFixed(2)} kV
          </div>
        </div>

        {/* CURRENT */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-border shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>CURRENT</span>
            <Activity className="w-3.5 h-3.5 text-grid-steel" />
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-white">
            {state.currentA.toFixed(0)} A
          </div>
        </div>

        {/* POWER FACTOR */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-border shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>POWER FACTOR</span>
            <span className="text-[10px] text-grid-muted font-mono">cos φ</span>
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-white">
            {state.powerFactor.toFixed(2)}
          </div>
        </div>

        {/* HEALTH INDEX (MUTED GREEN) */}
        <div className="p-3 rounded-lg bg-grid-card border border-grid-green/30 shadow-sm">
          <div className="text-[10px] font-mono text-grid-muted uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>HEALTH INDEX</span>
            <ShieldCheck className="w-3.5 h-3.5 text-grid-green" />
          </div>
          <div className="text-xl font-bold font-mono font-mono-num text-grid-green">
            {state.healthIndex.toFixed(1)} %
          </div>
        </div>

      </div>

      {/* Status Banner */}
      <div className={`p-2.5 rounded-lg border text-center font-mono font-bold text-xs tracking-widest uppercase ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
        ● STATUS: {state.operatingState}
      </div>

      {/* Extended Telemetry Specs */}
      <div className="bg-grid-bg p-3 rounded-lg border border-grid-border space-y-2 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-grid-border/60 pb-1 text-grid-muted">
          <span>Rated Capacity:</span>
          <span className="text-white font-bold">{state.ratedCapacityMVA} MVA</span>
        </div>

        <div className="flex items-center justify-between border-b border-grid-border/60 pb-1 text-grid-muted">
          <span>Active Power:</span>
          <span className="text-white font-bold">{state.powerKW.toFixed(0)} kW</span>
        </div>

        <div className="flex items-center justify-between border-b border-grid-border/60 pb-1 text-grid-muted">
          <span>Ambient Temp:</span>
          <span className="text-white font-bold">{state.ambientTemperatureC} °C</span>
        </div>

        <div className="flex items-center justify-between border-b border-grid-border/60 pb-1 text-grid-muted">
          <span>Anomaly Status:</span>
          <span className={`font-bold ${state.anomaly ? 'text-grid-yellow' : 'text-grid-green'}`}>
            {state.anomaly ? '1 (DETECTED)' : '0 (NORMAL)'}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-grid-border/60 pb-1 text-grid-muted">
          <span>Overload Status:</span>
          <span className={`font-bold ${state.overload ? 'text-grid-red' : 'text-grid-green'}`}>
            {state.overload ? '1 (ACTIVE)' : '0 (NONE)'}
          </span>
        </div>

        <div className="flex items-center justify-between text-grid-muted">
          <span>Fault Injection:</span>
          <span className={`font-bold ${state.fault ? 'text-grid-red' : 'text-grid-green'}`}>
            {state.fault ? '1 (FAULT TRIP)' : '0 (CLEAR)'}
          </span>
        </div>
      </div>
    </div>
  );
};
