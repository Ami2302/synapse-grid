import React, { useState } from 'react';
import type { SelfHealingActionRecord, TransformerAgentState } from '../mas/types';
import type { SelfHealingResult } from '../mas/selfHealingEngine';
import { ShieldCheck, Zap, ArrowRightLeft, CheckCircle2, Play, RefreshCw, Activity, Server } from 'lucide-react';

interface SelfHealingWorkspaceProps {
  agents: Record<string, TransformerAgentState>;
  selfHealingLogs: SelfHealingActionRecord[];
  activePipelineSteps?: SelfHealingResult['pipelineSteps'];
  onSimulateOverloadEvent: (transformerId: string) => void;
  onResetGrid: () => void;
}

export const SelfHealingWorkspace: React.FC<SelfHealingWorkspaceProps> = ({
  agents,
  selfHealingLogs,
  activePipelineSteps,
  onSimulateOverloadEvent,
  onResetGrid
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('T1');
  const agentList = Object.values(agents);

  const defaultPipeline = [
    {
      stepIndex: 1,
      title: 'Overload Anomaly Detection',
      description: 'Edge AI monitors continuous load % and thermal telemetry across all transformer nodes.',
      status: 'COMPLETED' as const,
      details: 'Threshold > 85% Warning, > 115% Overload'
    },
    {
      stepIndex: 2,
      title: 'P2P Neighbor Discovery',
      description: 'Overloaded node broadcasts capacity inquiry to neighbor agents on P2P message bus.',
      status: 'COMPLETED' as const,
      details: 'Queries T1—T4 available headroom'
    },
    {
      stepIndex: 3,
      title: 'Autonomous Capacity Negotiation',
      description: 'Neighbor agents evaluate available headroom to 85% warning limit and send capacity offers.',
      status: 'COMPLETED' as const,
      details: 'Calculates MVA headroom delta'
    },
    {
      stepIndex: 4,
      title: 'Dynamic Load Transfer Execution',
      description: 'Decentralized consensus executes load transfer, balancing stress across active grid nodes.',
      status: 'COMPLETED' as const,
      details: 'Substation breaker & feeder tap update'
    },
    {
      stepIndex: 5,
      title: 'Digital Twin State Sync & Verification',
      description: 'Updated load and thermal equilibrium synchronized back to Digital Twin telemetry state.',
      status: 'COMPLETED' as const,
      details: 'Grid equilibrium restored'
    }
  ];

  const stepsToRender = activePipelineSteps && activePipelineSteps.length > 0 ? activePipelineSteps : defaultPipeline;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="text-[#5E9C76]" size={24} />
              AUTONOMOUS LOAD REDISTRIBUTION & SELF-HEALING ENGINE
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#5E9C76]/20 text-[#5E9C76] border border-[#5E9C76]/40 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5E9C76] animate-pulse"></span>
              ACTIVE MODULE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time Multi-Agent Capacity Redistribution • Emergency Overload Mitigation • Closed-Loop Digital Twin Sync
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onResetGrid}
            className="px-3 py-1.5 bg-[#172033] hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw size={14} />
            RESET GRID STATE
          </button>
        </div>
      </div>

      {/* Interactive Trigger Panel */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap size={16} className="text-[#D6A84F]" />
          LIVE EVENT SIMULATOR & CONTROL PANEL
        </h3>
        
        <div className="flex flex-col md:flex-row items-center gap-4 bg-[#0B0F14] p-4 rounded-lg border border-[#172033]">
          <div className="flex items-center gap-3 flex-1 w-full">
            <label className="text-xs text-slate-400 font-semibold uppercase whitespace-nowrap">
              Target Transformer:
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="bg-[#111827] border border-slate-700 text-sm font-bold text-slate-100 rounded px-3 py-2 focus:outline-none focus:border-[#5B7C99] flex-1"
            >
              {agentList.map((ag) => (
                <option key={ag.transformerId} value={ag.transformerId}>
                  {ag.transformerId} - {ag.name} (Current Load: {ag.currentLoadPercent}%)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onSimulateOverloadEvent(selectedTargetId)}
            className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-[#B94A48] to-[#C47A3A] hover:from-[#A33B39] hover:to-[#B36B2B] text-white text-sm font-bold rounded shadow-lg flex items-center justify-center gap-2 transition"
          >
            <Play size={16} className="fill-white" />
            SIMULATE NETWORK OVERLOAD EVENT
          </button>
        </div>
      </div>

      {/* 5-Step Pipeline Flow */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-[#5E9C76]" />
          AUTONOMOUS SELF-HEALING DECISION PIPELINE
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {stepsToRender.map((step) => (
            <div
              key={step.stepIndex}
              className="bg-[#0B0F14] border border-[#172033] rounded-lg p-3.5 flex flex-col justify-between relative"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="w-6 h-6 rounded-full bg-[#5E9C76]/20 text-[#5E9C76] font-mono text-xs font-bold flex items-center justify-center border border-[#5E9C76]/40">
                    {step.stepIndex}
                  </span>
                  <CheckCircle2 size={16} className="text-[#5E9C76]" />
                </div>
                <h4 className="text-xs font-bold text-slate-100 mb-1">{step.title}</h4>
                <p className="text-[11px] text-slate-400 leading-tight mb-2">{step.description}</p>
              </div>

              {step.details && (
                <div className="text-[10px] font-mono text-[#5B7C99] bg-[#111827] px-2 py-1 rounded border border-[#172033]">
                  {step.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Grid Load Distribution Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server size={16} className="text-[#5B7C99]" />
          CURRENT GRID LOAD DISTRIBUTION & HEADROOM
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {agentList.map((ag) => (
            <div key={ag.agentId} className="bg-[#111827] border border-[#172033] rounded-lg p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-200 text-sm">{ag.transformerId}</span>
                <span className={`text-xs font-mono font-bold ${
                  ag.currentLoadPercent >= 100 ? 'text-[#B94A48]' :
                  ag.currentLoadPercent >= 85 ? 'text-[#D6A84F]' : 'text-[#5E9C76]'
                }`}>
                  {ag.currentLoadPercent}% Load
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${
                    ag.currentLoadPercent >= 100 ? 'bg-[#B94A48]' :
                    ag.currentLoadPercent >= 85 ? 'bg-[#D6A84F]' : 'bg-[#5E9C76]'
                  }`}
                  style={{ width: `${Math.min(100, ag.currentLoadPercent)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Headroom:</span>
                <span className="font-mono text-[#D6A84F]">+{ag.availableCapacityMVA} MVA</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Self-Healing Execution Log Table */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-[#5B7C99]" />
          SELF-HEALING ACTION AUDIT LOG
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B0F14] text-slate-400 uppercase font-mono text-[11px] border-b border-[#172033]">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Event Type</th>
                <th className="p-2.5">Affected Node</th>
                <th className="p-2.5">Support Node</th>
                <th className="p-2.5">Action Executed</th>
                <th className="p-2.5">Load (Before → After)</th>
                <th className="p-2.5">Temp (Before → After)</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172033]">
              {selfHealingLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                    No self-healing events recorded yet. Click "SIMULATE NETWORK OVERLOAD EVENT" to execute autonomous load redistribution.
                  </td>
                </tr>
              ) : (
                selfHealingLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 font-mono">
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-2.5 text-[#D6A84F] font-semibold">{log.eventType}</td>
                    <td className="p-2.5 text-[#B94A48] font-bold">{log.affectedAgentId}</td>
                    <td className="p-2.5 text-[#5E9C76] font-bold">{log.supportAgentId}</td>
                    <td className="p-2.5 text-slate-200 max-w-xs truncate font-sans">{log.actionTaken}</td>
                    <td className="p-2.5">
                      <span className="text-[#B94A48]">{log.loadBeforePercent}%</span> → <span className="text-[#5E9C76] font-bold">{log.loadAfterPercent}%</span>
                    </td>
                    <td className="p-2.5">
                      <span className="text-slate-400">{log.tempBeforeC}°C</span> → <span className="text-slate-200 font-bold">{log.tempAfterC}°C</span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 text-[10px] rounded bg-[#5E9C76]/20 text-[#5E9C76] border border-[#5E9C76]/30 font-semibold">
                        {log.resultStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
