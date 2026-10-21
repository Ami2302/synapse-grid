import React from 'react';
import type { TransformerState, TransformerConfig } from '../simulation/types';
import type { TransformerAgentState, AgentMessage, SelfHealingActionRecord } from '../mas/types';
import type { ActiveTab } from './Header';
import { useModelRegistry, selectBestClassifier } from '../ml/modelRegistry';
import { Cpu, ShieldCheck, Network, ArrowRight, MessageSquare, Play, Server } from 'lucide-react';

interface SystemOverviewDashboardProps {
  currentConfig: TransformerConfig;
  currentState: TransformerState;
  agents: Record<string, TransformerAgentState>;
  messages: AgentMessage[];
  selfHealingLogs: SelfHealingActionRecord[];
  onNavigateTab: (tabId: ActiveTab) => void;
  onSimulateOverload: (transformerId: string) => void;
}

export const SystemOverviewDashboard: React.FC<SystemOverviewDashboardProps> = ({
  currentConfig,
  currentState,
  agents,
  messages,
  selfHealingLogs,
  onNavigateTab,
  onSimulateOverload
}) => {
  const agentList = Object.values(agents);
  const recentMessages = messages.slice(0, 5);
  const models = useModelRegistry();
  const best = selectBestClassifier(models);

  // Only measured values are shown; anything not yet run is NOT EVALUATED
  const benchmarkRows: Array<{ name: string; value: string | null }> = [
    { name: 'Hybrid Fuzzy-Neural', value: models.hybrid ? `F1 ${models.hybrid.metrics.f1Score}%` : null },
    { name: 'Random Forest', value: models.rf ? `F1 ${models.rf.f1Score}%` : null },
    { name: 'Artificial Neural Net', value: models.ann ? `F1 ${models.ann.f1Score}%` : null },
    { name: 'Fuzzy Logic Risk', value: models.fuzzy ? `F1 ${models.fuzzy.f1Score}%` : null },
    { name: 'LSTM Temperature', value: models.lstm ? `RMSE ${models.lstm.rmse}°C` : null },
  ];

  // Pipeline flow items
  const pipelineModules: { title: string; subtitle: string; tabId: ActiveTab }[] = [
    { title: 'DIGITAL TWIN', subtitle: '3D WebGL Telemetry', tabId: 'digital-twin' },
    { title: 'SYNTHETIC DATA', subtitle: 'Physics Simulation', tabId: 'dataset-generator' },
    { title: 'PREPROCESSING', subtitle: 'Data Cleaning & Prep', tabId: 'data-preview' },
    { title: 'SOFT COMPUTING', subtitle: 'Fuzzy / Neural / RF / LSTM / Hybrid', tabId: 'soft-computing' },
    { title: 'EDGE AGENTS', subtitle: 'Decentralized MAS T1–T4', tabId: 'multi-agent' },
    { title: 'SELF-HEALING', subtitle: 'Autonomous Load Transfer', tabId: 'self-healing' }
  ];

  return (
    <div className="space-y-6">
      {/* Compact action row */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onSimulateOverload('T1')}
          className="px-3 py-1.5 bg-[#B94A48] hover:bg-[#A33B39] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
        >
          <Play size={12} className="fill-white" />
          Simulate T1 overload
        </button>
        <button
          onClick={() => onNavigateTab('grid-twin')}
          className="px-3 py-1.5 bg-[#5B7C99] hover:bg-[#4A6B88] text-white text-xs font-semibold rounded transition"
        >
          Open 3D grid twin
        </button>
      </div>

      {/* End-to-End Architecture Flow Diagram */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Network size={16} className="text-[#5B7C99]" />
          END-TO-END SYSTEM ARCHITECTURE & DATA FLOW
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 relative">
          {pipelineModules.map((mod, idx) => (
            <div
              key={mod.title}
              onClick={() => onNavigateTab(mod.tabId)}
              className="bg-[#0B0F14] border border-[#172033] hover:border-[#5B7C99] rounded p-3 cursor-pointer transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-[#5B7C99]">M0{idx + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5E9C76]"></span>
                </div>
                <div className="text-xs font-bold text-slate-100 group-hover:text-[#5B7C99] transition">
                  {mod.title}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{mod.subtitle}</div>
              </div>
              <div className="text-[10px] font-mono text-[#5E9C76] mt-2 flex items-center gap-1">
                ● ACTIVE
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 4 Key Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>DIGITAL TWIN STATE</span>
            <Server size={16} className="text-[#5B7C99]" />
          </div>
          <div className="text-xl font-bold text-slate-100">
            {currentConfig.name} ({currentConfig.ratedCapacityMVA} MVA)
          </div>
          <div className="text-xs text-[#5E9C76] mt-1 font-mono">
            Load: {currentState.loadPercent}% • Temp: {currentState.transformerTemperatureC}°C
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>SOFT COMPUTING AI</span>
            <Cpu size={16} className="text-[#5E9C76]" />
          </div>
          <div className="text-xl font-bold text-slate-100">
            {best ? best.name : 'NOT EVALUATED'}
          </div>
          <div className="text-xs text-[#5E9C76] mt-1 font-mono">
            {best ? `Best F1: ${best.f1}%` : 'Run models in Soft Computing / AI'} • Fuzzy Risk: {agentList[0]?.riskScore ?? '-'}/100
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>MULTI-AGENT SYSTEM</span>
            <Network size={16} className="text-[#5B7C99]" />
          </div>
          <div className="text-xl font-bold text-slate-100">
            4 Edge Nodes Online
          </div>
          <div className="text-xs text-[#5B7C99] mt-1 font-mono">
            P2P Bus: {messages.length} Messages Logged
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>SELF-HEALING ENGINE</span>
            <ShieldCheck size={16} className="text-[#5E9C76]" />
          </div>
          <div className="text-xl font-bold text-[#5E9C76]">
            GRID EQUILIBRIUM
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            {selfHealingLogs.length} Load Redistribution(s) Executed
          </div>
        </div>
      </div>

      {/* Network Topology Map & Live AI Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topology Map (2 cols) */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#172033] rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Network size={16} className="text-[#5B7C99]" />
                SMART DISTRIBUTION NETWORK TOPOLOGY (P2P AGENT BUS)
              </h3>
              <p className="text-xs text-slate-400">Inter-transformer agent communication & capacity headroom</p>
            </div>
            <button
              onClick={() => onNavigateTab('multi-agent')}
              className="text-xs text-[#5B7C99] hover:underline font-semibold flex items-center gap-1"
            >
              View Full MAS Workspace <ArrowRight size={14} />
            </button>
          </div>

          {/* Interactive Topology Cards */}
          <div className="grid grid-cols-2 gap-4 bg-[#0B0F14] p-4 rounded-lg border border-[#172033] relative">
            {agentList.map((agent) => (
              <div
                key={agent.agentId}
                className={`p-3.5 rounded border transition ${
                  agent.currentLoadPercent >= 100
                    ? 'bg-[#B94A48]/10 border-[#B94A48]'
                    : agent.currentLoadPercent >= 85
                    ? 'bg-[#D6A84F]/10 border-[#D6A84F]'
                    : 'bg-[#111827] border-[#172033]'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#5B7C99]">{agent.agentId}</span>
                    <h4 className="text-sm font-bold text-slate-100">{agent.name}</h4>
                    <span className="text-[10px] text-slate-400">{agent.substation}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                    agent.operatingState === 'OVERLOAD' ? 'bg-[#B94A48] text-white' :
                    agent.operatingState === 'WARNING' ? 'bg-[#D6A84F] text-black' : 'bg-[#5E9C76]/20 text-[#5E9C76]'
                  }`}>
                    {agent.operatingState}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Load:</span>
                    <span className="font-bold text-slate-200">{agent.currentLoadPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        agent.currentLoadPercent >= 100 ? 'bg-[#B94A48]' :
                        agent.currentLoadPercent >= 85 ? 'bg-[#D6A84F]' : 'bg-[#5E9C76]'
                      }`}
                      style={{ width: `${Math.min(100, agent.currentLoadPercent)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Headroom:</span>
                    <span className="text-[#D6A84F]">+{agent.availableCapacityMVA} MVA</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI & Telemetry Feeds (1 col) */}
        <div className="space-y-6">
          {/* AI Summary Card */}
          <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Cpu size={16} className="text-[#5E9C76]" />
              AI MODEL PERFORMANCE
            </h3>
            <div className="space-y-2 text-xs">
              {benchmarkRows.map((row) => (
                <div key={row.name} className="flex justify-between items-center p-2 bg-[#0B0F14] rounded">
                  <span className="font-semibold text-slate-300">{row.name}</span>
                  {row.value ? (
                    <span className={`font-mono ${best && row.name === best.name ? 'font-bold text-[#5E9C76]' : 'text-slate-300'}`}>
                      {row.value}{best && row.name === best.name ? ' (Best)' : ''}
                    </span>
                  ) : (
                    <span className="font-mono text-slate-500">NOT EVALUATED</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigateTab('soft-computing')}
              className="w-full mt-3 py-1.5 bg-[#172033] hover:bg-slate-700 text-[#5B7C99] text-xs font-semibold rounded border border-[#172033] flex items-center justify-center gap-1 transition"
            >
              Open AI Experiment Workspace <ArrowRight size={12} />
            </button>
          </div>

          {/* Recent P2P Bus Stream */}
          <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-[#5B7C99]" />
              RECENT P2P MESSAGES
            </h3>
            <div className="space-y-2 text-xs">
              {recentMessages.length === 0 ? (
                <p className="text-slate-500 italic text-center py-2">No messages logged yet.</p>
              ) : (
                recentMessages.map((msg) => (
                  <div key={msg.id} className="p-2 bg-[#0B0F14] rounded font-mono text-[11px]">
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span className="text-[#5B7C99] font-bold">{msg.sourceAgentId}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs truncate">{msg.payloadMessage}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
