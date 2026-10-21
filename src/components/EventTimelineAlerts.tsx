import React from 'react';
import type { SimulationEventLog, OperatingState } from '../simulation/types';
import { AlertTriangle, AlertOctagon, CheckCircle2, Flame, Clock } from 'lucide-react';

interface EventTimelineAlertsProps {
  logs: SimulationEventLog[];
  activeState: OperatingState;
  onClearLogs: () => void;
}

export const EventTimelineAlerts: React.FC<EventTimelineAlertsProps> = ({
  logs,
  activeState,
  onClearLogs,
}) => {
  const renderAlertBanner = () => {
    switch (activeState) {
      case 'FAULT':
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-red/20 border border-grid-red text-grid-red shadow-sm">
            <AlertOctagon className="w-5 h-5 fill-current shrink-0" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                ⛔ FAULT EVENT DETECTED — EMERGENCY TRIP ACTIVE
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                Substation protective breaker trigger. Thermal runaway & overcurrent fault.
              </div>
            </div>
          </div>
        );
      case 'OVERLOAD':
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-red/20 border border-grid-red text-grid-red shadow-sm">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                ⛔ OVERLOAD CONDITION DETECTED
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                Transformer loading exceeds 115% rated MVA capacity. Hot-spot degradation imminent.
              </div>
            </div>
          </div>
        );
      case 'HIGH_STRESS':
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-amber/15 border border-grid-amber/50 text-grid-amber">
            <Flame className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                ⚠ HIGH THERMAL STRESS
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                Oil & winding temperature approaching rated thermal threshold (≥90°C).
              </div>
            </div>
          </div>
        );
      case 'WARNING':
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-yellow/15 border border-grid-yellow/50 text-grid-yellow">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                ⚠ APPROACHING OPERATING LIMIT
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                Loading exceeds 85% rated MVA capacity. Elevated grid demand monitored.
              </div>
            </div>
          </div>
        );
      case 'RECOVERY':
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-steel/20 border border-grid-steel text-white">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-grid-steel" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                🔄 POST-FAULT RECOVERY IN PROGRESS
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                Loading reduced. Forced cooling active. Thermal dissipation restoring stability.
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-grid-green/10 border border-grid-green/30 text-grid-green">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-grid-green" />
            <div>
              <div className="font-mono font-bold text-xs uppercase tracking-wider">
                SYSTEM STABLE — NORMAL OPERATING STATE
              </div>
              <div className="text-[11px] opacity-90 font-mono">
                All electrical and thermal telemetry within nominal IEEE/IEC limits.
              </div>
            </div>
          </div>
        );
    }
  };

  const getLogBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-grid-red/20 text-grid-red border-grid-red/80';
      case 'caution':
        return 'bg-grid-amber/20 text-grid-amber border-grid-amber/80';
      case 'warning':
        return 'bg-grid-yellow/20 text-grid-yellow border-grid-yellow/80';
      case 'recovery':
        return 'bg-grid-steel/20 text-white border-grid-steel/80';
      default:
        return 'bg-grid-green/15 text-grid-green border-grid-green/30';
    }
  };

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-4 flex flex-col gap-4 shadow-md">
      {renderAlertBanner()}

      <div className="flex items-center justify-between border-b border-grid-border pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-grid-steel" />
          <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            REAL-TIME EVENT TIMELINE
          </h3>
        </div>
        <button
          onClick={onClearLogs}
          className="text-[10px] text-grid-muted font-mono hover:text-white transition-colors"
        >
          Clear Log Buffer
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
        {logs.length === 0 ? (
          <div className="text-center py-6 text-grid-muted text-xs">
            No simulation events logged yet. Start simulation to observe telemetry events.
          </div>
        ) : (
          logs.slice(0, 50).map((log) => (
            <div
              key={log.id}
              className="flex items-start justify-between gap-3 p-2 rounded bg-grid-card border border-grid-border/60 hover:border-grid-border transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-grid-muted text-[11px] font-mono shrink-0 mt-0.5">
                  {log.timestamp}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${getLogBadge(log.severity)}`}>
                  {log.severity}
                </span>
                <span className="text-white font-medium text-[11px] leading-tight">
                  {log.message}
                </span>
              </div>
              <span className="text-[10px] text-grid-muted font-mono shrink-0">
                {log.transformerId}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
