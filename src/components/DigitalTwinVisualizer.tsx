import React from 'react';
import type { TransformerState, TransformerConfig } from '../simulation/types';
import { ShieldCheck, Activity, Thermometer, Gauge } from 'lucide-react';

interface DigitalTwinVisualizerProps {
  state: TransformerState;
  config: TransformerConfig;
}

export const DigitalTwinVisualizer: React.FC<DigitalTwinVisualizerProps> = ({ state, config }) => {
  const { operatingState, loadPercent, transformerTemperatureC, healthIndex, voltageKV, currentA, powerKW } = state;

  const getStateTheme = (st: string) => {
    switch (st) {
      case 'WARNING':
        return {
          stroke: '#D6A84F', // Golden yellow
          bg: 'bg-grid-yellow/15',
          border: 'border-grid-yellow/50',
          text: 'text-grid-yellow',
        };
      case 'HIGH_STRESS':
        return {
          stroke: '#C47A3A', // Amber
          bg: 'bg-grid-amber/15',
          border: 'border-grid-amber/50',
          text: 'text-grid-amber',
        };
      case 'OVERLOAD':
      case 'FAULT':
      case 'CRITICAL':
        return {
          stroke: '#B94A48', // Deep red
          bg: 'bg-grid-red/15',
          border: 'border-grid-red',
          text: 'text-grid-red',
        };
      default:
        return {
          stroke: '#4F8F8B', // Muted Teal / Steel
          bg: 'bg-grid-green/15',
          border: 'border-grid-green/40',
          text: 'text-grid-green',
        };
    }
  };

  const styleTheme = getStateTheme(operatingState);

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-4 shadow-md relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-grid-border pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-grid-steel" />
          <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            DIGITAL TWIN SCHEMATIC — {config.id} ({config.name})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-grid-muted font-mono">
            COOLING: <strong className="text-white">{config.coolingType}</strong>
          </span>
          <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${styleTheme.bg} ${styleTheme.border} ${styleTheme.text}`}>
            ● {operatingState}
          </span>
        </div>
      </div>

      {/* Engineering Schematic Representation */}
      <div className="relative z-10 flex flex-col items-center justify-center py-2 min-h-[360px]">
        
        {/* SVG Engineering Flow Lines Diagram */}
        <svg className="w-full h-[320px] max-w-[850px]" viewBox="0 0 850 320" fill="none">
          
          {/* Grid Input Bus (Left) */}
          <line x1="20" y1="160" x2="160" y2="160" stroke="#2A3547" strokeWidth="6" />
          <line x1="20" y1="160" x2="160" y2="160" stroke={styleTheme.stroke} strokeWidth="3" className="animate-electric-flow" />

          {/* Load Output Bus (Right) */}
          <line x1="690" y1="160" x2="830" y2="160" stroke="#2A3547" strokeWidth="6" />
          <line x1="690" y1="160" x2="830" y2="160" stroke={styleTheme.stroke} strokeWidth="3" className="animate-electric-flow" />

          {/* Primary High Voltage Bushings */}
          <path d="M 160 160 L 220 160 L 260 110" stroke={styleTheme.stroke} strokeWidth="3" fill="none" strokeDasharray="5 5" className="animate-electric-flow" />
          <rect x="210" y="145" width="20" height="30" rx="3" fill="#1C2636" stroke="#5B7C99" strokeWidth="1.5" />

          {/* Secondary Low Voltage Bushings */}
          <path d="M 590 110 L 630 160 L 690 160" stroke={styleTheme.stroke} strokeWidth="3" fill="none" strokeDasharray="5 5" className="animate-electric-flow" />
          <rect x="620" y="145" width="20" height="30" rx="3" fill="#1C2636" stroke="#5B7C99" strokeWidth="1.5" />

          {/* TRANSFORMER MAIN TANK ENCLOSURE (DARK STEEL BODY) */}
          <rect
            x="260"
            y="50"
            width="330"
            height="220"
            rx="10"
            fill="#172033"
            stroke={styleTheme.stroke}
            strokeWidth={operatingState === 'OVERLOAD' || operatingState === 'FAULT' ? "3" : "2"}
            className="transition-all duration-300"
          />

          {/* Tank Oil Level / Structure */}
          <line x1="275" y1="80" x2="575" y2="80" stroke="#2A3547" strokeWidth="2" strokeDasharray="4 4" />
          <text x="280" y="72" fill="#9299A8" fontSize="10" fontFamily="monospace">OIL TANK (ONAN / ONAF)</text>

          {/* Cooling Radiator Fins (Gray / Steel) */}
          <g stroke="#374151" strokeWidth="2" fill="#1C2636">
            <rect x="235" y="80" width="20" height="150" rx="4" />
            <line x1="235" y1="110" x2="255" y2="110" />
            <line x1="235" y1="140" x2="255" y2="140" />
            <line x1="235" y1="170" x2="255" y2="170" />
            <line x1="235" y1="200" x2="255" y2="200" />

            <rect x="595" y="80" width="20" height="150" rx="4" />
            <line x1="595" y1="110" x2="615" y2="110" />
            <line x1="595" y1="140" x2="615" y2="140" />
            <line x1="595" y1="170" x2="615" y2="170" />
            <line x1="595" y1="200" x2="615" y2="200" />
          </g>

          {/* MAGNETIC LAMINATED STEEL CORE */}
          <rect x="340" y="100" width="170" height="130" rx="6" fill="#1C2636" stroke="#4B5563" strokeWidth="2" />
          <rect x="380" y="120" width="90" height="90" rx="4" fill="#111827" stroke="#2A3547" strokeWidth="2" />

          {/* Primary Winding Coils (Steel Blue / Teal) */}
          <g stroke="#5B7C99" strokeWidth="3" fill="none">
            <circle cx="340" cy="130" r="16" />
            <circle cx="340" cy="165" r="16" />
            <circle cx="340" cy="200" r="16" />
          </g>

          {/* Secondary Winding Coils (Teal / Steel) */}
          <g stroke="#4F8F8B" strokeWidth="3" fill="none">
            <circle cx="510" cy="130" r="16" />
            <circle cx="510" cy="165" r="16" />
            <circle cx="510" cy="200" r="16" />
          </g>

          {/* Magnetic Flux Lines */}
          <path
            d="M 365 110 L 485 110 L 485 220 L 365 220 Z"
            stroke="#5B7C99"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
            opacity="0.5"
            className="animate-electric-flow"
          />

          {/* Thermal Hotspot Indicator (Red inside core when overheated) */}
          {transformerTemperatureC > 80 && (
            <circle
              cx="425"
              cy="165"
              r={Math.min(45, (transformerTemperatureC - 70) * 1.2)}
              fill="#B94A48"
              opacity={Math.min(0.4, (transformerTemperatureC - 75) * 0.012)}
            />
          )}

          {/* Diagram Text Labels */}
          <text x="315" y="255" fill="#9299A8" fontSize="11" fontFamily="monospace">PRIMARY 11 kV</text>
          <text x="475" y="255" fill="#9299A8" fontSize="11" fontFamily="monospace">SECONDARY 0.415 kV</text>
          <text x="400" y="168" fill="#E7E9ED" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            MAGNETIC CORE
          </text>
        </svg>

        {/* Floating Telemetry Callout Cards (WARM WHITE NUMBERS) */}
        <div className="absolute left-2 top-8 bg-grid-card border border-grid-border p-2.5 rounded-lg text-xs font-mono space-y-1 shadow-md">
          <div className="text-[10px] text-grid-muted uppercase tracking-wider font-bold">GRID INPUT</div>
          <div className="text-grid-muted flex items-center justify-between gap-3">
            <span>Voltage:</span>
            <strong className="text-white">{voltageKV.toFixed(2)} kV</strong>
          </div>
          <div className="text-grid-muted flex items-center justify-between gap-3">
            <span>Rating:</span>
            <strong className="text-white">{config.ratedCapacityMVA} MVA</strong>
          </div>
        </div>

        <div className="absolute right-2 top-8 bg-grid-card border border-grid-border p-2.5 rounded-lg text-xs font-mono space-y-1 shadow-md">
          <div className="text-[10px] text-grid-muted uppercase tracking-wider font-bold">FEEDER OUTPUT</div>
          <div className="text-grid-muted flex items-center justify-between gap-3">
            <span>Current:</span>
            <strong className="text-white">{currentA.toFixed(0)} A</strong>
          </div>
          <div className="text-grid-muted flex items-center justify-between gap-3">
            <span>Active Power:</span>
            <strong className="text-white">{powerKW.toFixed(0)} kW</strong>
          </div>
        </div>

        {/* Live Instrumentation Cards Bottom */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[650px] mt-2">
          
          <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-3 shadow-sm">
            <Gauge className="w-5 h-5 text-grid-steel" />
            <div>
              <div className="text-[10px] font-mono text-grid-muted uppercase">LOAD UTILIZATION</div>
              <div className="text-base font-bold font-mono text-white">
                {loadPercent.toFixed(1)} %
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-3 shadow-sm">
            <Thermometer className="w-5 h-5 text-grid-steel" />
            <div>
              <div className="text-[10px] font-mono text-grid-muted uppercase">HOT-SPOT TEMP</div>
              <div className="text-base font-bold font-mono text-white">
                {transformerTemperatureC.toFixed(1)} °C
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-grid-card border border-grid-border flex items-center gap-3 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-grid-green" />
            <div>
              <div className="text-[10px] font-mono text-grid-muted uppercase">HEALTH INDEX</div>
              <div className="text-base font-bold font-mono text-grid-green">
                {healthIndex.toFixed(1)} %
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
