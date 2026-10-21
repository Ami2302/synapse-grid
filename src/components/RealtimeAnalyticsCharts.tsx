import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine
} from 'recharts';
import type { TransformerState } from '../simulation/types';
import { LineChart as ChartIcon, RotateCcw } from 'lucide-react';

interface RealtimeAnalyticsChartsProps {
  history: TransformerState[];
  onResetHistory: () => void;
}

export const RealtimeAnalyticsCharts: React.FC<RealtimeAnalyticsChartsProps> = ({
  history,
  onResetHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'load' | 'temp' | 'electrical' | 'health'>('all');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-grid-card border border-grid-border p-2.5 rounded-lg shadow-xl font-mono text-xs space-y-1">
          <div className="text-grid-muted border-b border-grid-border pb-1 text-[10px]">
            TIME STEP: <strong className="text-white">{label}</strong>
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <strong className="text-white">{entry.value} {entry.unit}</strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const chartData = history.slice(-120);

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-4 shadow-md">
      {/* Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-grid-border pb-3">
        <div className="flex items-center gap-2">
          <ChartIcon className="w-4 h-4 text-grid-steel" />
          <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            REAL-TIME TELEMETRY ANALYTICS
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-grid-bg p-1 rounded-lg border border-grid-border text-xs font-mono">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded ${activeTab === 'all' ? 'bg-grid-steel/30 text-white border border-grid-steel' : 'text-grid-muted'}`}
            >
              ALL (7 CHARTS)
            </button>
            <button
              onClick={() => setActiveTab('load')}
              className={`px-2.5 py-1 rounded ${activeTab === 'load' ? 'bg-grid-steel/30 text-white border border-grid-steel' : 'text-grid-muted'}`}
            >
              LOAD %
            </button>
            <button
              onClick={() => setActiveTab('temp')}
              className={`px-2.5 py-1 rounded ${activeTab === 'temp' ? 'bg-grid-steel/30 text-white border border-grid-steel' : 'text-grid-muted'}`}
            >
              TEMP °C
            </button>
            <button
              onClick={() => setActiveTab('electrical')}
              className={`px-2.5 py-1 rounded ${activeTab === 'electrical' ? 'bg-grid-steel/30 text-white border border-grid-steel' : 'text-grid-muted'}`}
            >
              V / I / P
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`px-2.5 py-1 rounded ${activeTab === 'health' ? 'bg-grid-steel/30 text-white border border-grid-steel' : 'text-grid-muted'}`}
            >
              HEALTH
            </button>
          </div>

          <button
            onClick={onResetHistory}
            className="p-1.5 rounded-lg bg-grid-bg border border-grid-border text-grid-muted hover:text-white"
            title="Clear Chart Buffer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7 Restrained Engineering Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. LOAD % vs TIME (Steel Blue) */}
        {(activeTab === 'all' || activeTab === 'load') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">1. LOAD % vs TIME</span>
              <span className="text-[10px] text-grid-muted">WARN: 85% | OVERLOAD: 115%</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis domain={[0, 160]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={85} stroke="#D6A84F" strokeDasharray="3 3" label={{ value: 'Warning', fill: '#D6A84F', fontSize: 9 }} />
                  <ReferenceLine y={115} stroke="#B94A48" strokeDasharray="3 3" label={{ value: 'Overload', fill: '#B94A48', fontSize: 9 }} />
                  <Line type="monotone" dataKey="loadPercent" name="Load Utilization" unit="%" stroke="#5B7C99" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. TRANSFORMER TEMPERATURE vs TIME (Warm Amber) */}
        {(activeTab === 'all' || activeTab === 'temp') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">2. TRANSFORMER TEMP (°C)</span>
              <span className="text-[10px] text-grid-muted">WARN: 75°C | LIMIT: 105°C</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis domain={[20, 120]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={75} stroke="#D6A84F" strokeDasharray="3 3" />
                  <ReferenceLine y={105} stroke="#B94A48" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="transformerTemperatureC" name="Temp" unit="°C" stroke="#C47A3A" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 3. VOLTAGE vs TIME (Muted Teal) */}
        {(activeTab === 'all' || activeTab === 'electrical') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">3. PRIMARY VOLTAGE (kV)</span>
              <span className="text-[10px] text-grid-muted">NOMINAL: 11.00 kV</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis domain={[8, 12]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={11.0} stroke="#4F8F8B" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="voltageKV" name="Voltage" unit="kV" stroke="#4F8F8B" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. CURRENT vs TIME (Soft Gray/Blue) */}
        {(activeTab === 'all' || activeTab === 'electrical') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">4. LOAD CURRENT (A)</span>
              <span className="text-[10px] text-grid-muted">3-PHASE AMPERAGE</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="currentA" name="Current" unit="A" stroke="#829ab1" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 5. ACTIVE POWER vs TIME (Slate Purple/Blue) */}
        {(activeTab === 'all' || activeTab === 'electrical') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">5. ACTIVE POWER (kW)</span>
              <span className="text-[10px] text-grid-muted">REAL DEMAND</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="powerKW" name="Power" unit="kW" stroke="#7c73a8" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 6. POWER FACTOR vs TIME (Warm Golden Yellow) */}
        {(activeTab === 'all' || activeTab === 'electrical') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">6. POWER FACTOR (cos φ)</span>
              <span className="text-[10px] text-grid-muted">EFFICIENCY</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis domain={[0.5, 1.0]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0.90} stroke="#D6A84F" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="powerFactor" name="Power Factor" unit="" stroke="#D6A84F" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 7. HEALTH INDEX vs TIME (Muted Green) */}
        {(activeTab === 'all' || activeTab === 'health') && (
          <div className="bg-grid-card p-3 rounded-lg border border-grid-border">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="font-bold text-white">7. HEALTH INDEX (%)</span>
              <span className="text-[10px] text-grid-muted">INSULATION AGING</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3547" opacity={0.6} />
                  <XAxis dataKey="timestamp" stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <YAxis domain={[50, 100]} stroke="#9299A8" tick={{ fontSize: 10, fill: '#9299A8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="healthIndex" name="Health Index" unit="%" stroke="#5E9C76" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
