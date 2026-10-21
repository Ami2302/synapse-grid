import React from 'react';
import type { TransformerState, OperatingState } from '../simulation/types';
import { Network, Zap, CheckCircle2, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

interface MultiTransformerGridProps {
  transformersStates: Record<string, TransformerState>;
  selectedTransformerId: string;
  onSelectTransformer: (id: string) => void;
}

export const MultiTransformerGrid: React.FC<MultiTransformerGridProps> = ({
  transformersStates,
  selectedTransformerId,
  onSelectTransformer,
}) => {
  const ids = ['T1', 'T2', 'T3', 'T4'];

  const getStateBadge = (state: OperatingState) => {
    switch (state) {
      case 'WARNING':
        return {
          bg: 'bg-grid-yellow/15',
          border: 'border-grid-yellow/50',
          text: 'text-grid-yellow',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-grid-yellow" />,
        };
      case 'HIGH_STRESS':
        return {
          bg: 'bg-grid-amber/15',
          border: 'border-grid-amber/50',
          text: 'text-grid-amber',
          icon: <Flame className="w-3.5 h-3.5 text-grid-amber" />,
        };
      case 'OVERLOAD':
      case 'FAULT':
        return {
          bg: 'bg-grid-red/20',
          border: 'border-grid-red',
          text: 'text-grid-red',
          icon: <AlertOctagon className="w-3.5 h-3.5 text-grid-red" />,
        };
      default:
        return {
          bg: 'bg-grid-green/15',
          border: 'border-grid-green/40',
          text: 'text-grid-green',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-grid-green" />,
        };
    }
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-3 shadow-md">
      <div className="flex items-center justify-between border-b border-grid-border pb-2.5">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-grid-steel" />
          <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            DISTRIBUTION NETWORK GRID TOPOLOGY
          </h3>
        </div>
        <span className="text-[10px] font-mono text-grid-muted">
          SUBSTATION FEEDERS (T1–T4)
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-3">
        {/* Main Grid Node */}
        <div className="flex md:flex-col items-center justify-center p-3 rounded-lg bg-grid-card border border-grid-steel/40 text-center min-w-[110px]">
          <Zap className="w-5 h-5 text-grid-steel mb-1" />
          <div className="text-xs font-bold text-white font-mono">PRIMARY GRID</div>
          <div className="text-[10px] text-grid-steel font-mono">11 kV BUS</div>
        </div>

        {/* Transformer Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {ids.map((id) => {
            const st = transformersStates[id];
            if (!st) return null;
            const isSelected = selectedTransformerId === id;
            const badge = getStateBadge(st.operatingState);

            return (
              <div
                key={id}
                onClick={() => onSelectTransformer(id)}
                className={`p-3 rounded-lg bg-grid-card border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-grid-steel shadow-md ring-1 ring-grid-steel/50'
                    : 'border-grid-border hover:border-grid-dim'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-grid-steel"></div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white font-mono">
                    TRANSFORMER {id}
                  </span>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.bg} ${badge.border} ${badge.text}`}
                  >
                    {badge.icon}
                    {st.operatingState}
                  </span>
                </div>

                <div className="space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between text-grid-muted">
                    <span>Load:</span>
                    <strong className="text-white font-bold">
                      {st.loadPercent.toFixed(0)} %
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-grid-muted">
                    <span>Temp:</span>
                    <strong className="text-white font-bold">
                      {st.transformerTemperatureC.toFixed(1)} °C
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-grid-muted">
                    <span>Health:</span>
                    <strong className="text-grid-green font-bold">
                      {st.healthIndex.toFixed(0)} %
                    </strong>
                  </div>
                </div>

                <div className="mt-2 text-[10px] font-mono text-right text-grid-muted">
                  {isSelected ? '● ACTIVE TWIN' : 'Click to inspect'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
