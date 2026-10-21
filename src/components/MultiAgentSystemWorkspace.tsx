import React, { useState } from 'react';
import type { TransformerAgentState, AgentMessage } from '../mas/types';
import { Cpu, ShieldCheck, Zap, Activity, MessageSquare, ArrowRightLeft, Server } from 'lucide-react';

interface MultiAgentSystemWorkspaceProps {
  agents: Record<string, TransformerAgentState>;
  messages: AgentMessage[];
  onTriggerSelfHealing?: (agentId: string) => void;
}

export const MultiAgentSystemWorkspace: React.FC<MultiAgentSystemWorkspaceProps> = ({
  agents,
  messages,
  onTriggerSelfHealing
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | 'ALL'>('ALL');
  const [filterMessageType, setFilterMessageType] = useState<string>('ALL');

  const agentList = Object.values(agents);

  // Calculate totals
  const totalHeadroomMVA = agentList.reduce((acc, ag) => acc + ag.availableCapacityMVA, 0);
  const activeAgentsCount = agentList.filter((ag) => ag.status !== 'CRITICAL').length;
  const criticalAgentsCount = agentList.filter((ag) => ag.status === 'CRITICAL' || ag.operatingState === 'OVERLOAD').length;

  const filteredMessages = messages.filter((msg) => {
    const agentMatch = selectedAgentId === 'ALL' || msg.sourceAgentId.includes(selectedAgentId) || msg.destAgentId.includes(selectedAgentId);
    const typeMatch = filterMessageType === 'ALL' || msg.messageType === filterMessageType;
    return agentMatch && typeMatch;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'NORMAL_MONITORING':
        return 'bg-[#5E9C76]/20 text-[#5E9C76] border-[#5E9C76]/40';
      case 'PROVIDE_LOAD_SUPPORT':
        return 'bg-[#5B7C99]/20 text-[#5B7C99] border-[#5B7C99]/40';
      case 'COOLING_ACTIVATION':
        return 'bg-[#D6A84F]/20 text-[#D6A84F] border-[#D6A84F]/40';
      case 'REQUEST_CAPACITY_SUPPORT':
      case 'EMERGENCY_SHEDDING':
        return 'bg-[#B94A48]/20 text-[#B94A48] border-[#B94A48]/40';
      default:
        return 'bg-[#5B7C99]/20 text-[#5B7C99] border-[#5B7C99]/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#5E9C76]/20 text-[#5E9C76] border border-[#5E9C76]/40">ONLINE</span>;
      case 'COMMUNICATING':
      case 'REALLOCATING':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#D6A84F]/20 text-[#D6A84F] border border-[#D6A84F]/40 animate-pulse">REALLOCATING</span>;
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#B94A48]/20 text-[#B94A48] border border-[#B94A48]/40 animate-pulse">CRITICAL</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-700 text-slate-300">UNKNOWN</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="text-[#5B7C99]" size={24} />
              MULTI-AGENT EDGE INTELLIGENCE SYSTEM
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#5E9C76]/20 text-[#5E9C76] border border-[#5E9C76]/40 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5E9C76] animate-pulse"></span>
              ACTIVE MODULE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Decentralized Edge Agent Network (T1–T4) • Autonomous P2P Capacity Negotiation & Risk Monitoring
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>ACTIVE TRANSFORMER AGENTS</span>
            <Server size={16} className="text-[#5B7C99]" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {activeAgentsCount} <span className="text-sm font-normal text-slate-400">/ {agentList.length} Online</span>
          </div>
          <div className="text-xs text-[#5E9C76] mt-1 flex items-center gap-1">
            <ShieldCheck size={12} /> Edge AI Nodes Operational
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>GRID HEADROOM CAPACITY</span>
            <Zap size={16} className="text-[#D6A84F]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#D6A84F]">
            {totalHeadroomMVA.toFixed(2)} <span className="text-sm font-normal text-slate-400">MVA</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Available headroom below 85% limit
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>P2P MESSAGE BUS</span>
            <MessageSquare size={16} className="text-[#5B7C99]" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {messages.length} <span className="text-sm font-normal text-slate-400">Messages</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Active peer-to-peer telemetry bus
          </div>
        </div>

        <div className="bg-[#111827] border border-[#172033] rounded-lg p-4">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
            <span>MAS HEALTH & RISK</span>
            <Activity size={16} className={criticalAgentsCount > 0 ? "text-[#B94A48]" : "text-[#5E9C76]"} />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {criticalAgentsCount > 0 ? (
              <span className="text-[#B94A48]">{criticalAgentsCount} Overloaded</span>
            ) : (
              <span className="text-[#5E9C76]">STABLE</span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Decentralized consensus active
          </div>
        </div>
      </div>

      {/* Edge Agent Cards Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server size={16} className="text-[#5B7C99]" />
          DECENTRALIZED TRANSFORMER AGENTS (T1 — T4)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agentList.map((agent) => {
            const isOverloaded = agent.currentLoadPercent >= 100;
            return (
              <div
                key={agent.agentId}
                className={`bg-[#111827] border rounded-lg p-4 flex flex-col justify-between transition-all ${
                  isOverloaded
                    ? 'border-[#B94A48]/60 bg-gradient-to-b from-[#B94A48]/10 to-transparent'
                    : 'border-[#172033] hover:border-[#5B7C99]/50'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs font-mono text-[#5B7C99] font-bold">{agent.agentId}</div>
                      <div className="text-base font-bold text-slate-100">{agent.name}</div>
                      <div className="text-[11px] text-slate-400">{agent.substation}</div>
                    </div>
                    {getStatusBadge(agent.status)}
                  </div>

                  {/* Rating & Capacity */}
                  <div className="bg-[#0B0F14] rounded p-2 text-xs mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rated Capacity:</span>
                      <span className="font-mono text-slate-200">{agent.ratedCapacityMVA} MVA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Headroom (to 85%):</span>
                      <span className="font-mono text-[#D6A84F] font-semibold">
                        +{agent.availableCapacityMVA} MVA ({agent.availableCapacityPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Load Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Current Load:</span>
                      <span className={`font-mono font-bold ${
                        agent.currentLoadPercent >= 115 ? 'text-[#B94A48]' :
                        agent.currentLoadPercent >= 100 ? 'text-[#C47A3A]' :
                        agent.currentLoadPercent >= 85 ? 'text-[#D6A84F]' : 'text-[#5E9C76]'
                      }`}>
                        {agent.currentLoadPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          agent.currentLoadPercent >= 115 ? 'bg-[#B94A48]' :
                          agent.currentLoadPercent >= 100 ? 'bg-[#C47A3A]' :
                          agent.currentLoadPercent >= 85 ? 'bg-[#D6A84F]' : 'bg-[#5E9C76]'
                        }`}
                        style={{ width: `${Math.min(100, agent.currentLoadPercent)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* AI Telemetry Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-[#0B0F14] p-2 rounded">
                      <div className="text-[10px] text-slate-400">AI RISK SCORE</div>
                      <div className={`font-mono font-bold text-sm ${
                        agent.riskScore >= 70 ? 'text-[#B94A48]' :
                        agent.riskScore >= 40 ? 'text-[#D6A84F]' : 'text-[#5E9C76]'
                      }`}>
                        {agent.riskScore}/100
                      </div>
                    </div>
                    <div className="bg-[#0B0F14] p-2 rounded">
                      <div className="text-[10px] text-slate-400">PREDICTED TEMP</div>
                      <div className="font-mono font-bold text-sm text-slate-200">
                        {agent.predictedTempC}°C
                      </div>
                    </div>
                    <div className="bg-[#0B0F14] p-2 rounded col-span-2">
                      <div className="text-[10px] text-slate-400">HYBRID AI PREDICTED STATE</div>
                      {agent.predictedState ? (
                        <div className="flex items-center justify-between">
                          <span className={`font-mono font-bold text-sm ${
                            agent.predictedState === 'OVERLOAD' || agent.predictedState === 'FAULT' ? 'text-[#B94A48]' :
                            agent.predictedState === 'HIGH_STRESS' ? 'text-[#C47A3A]' :
                            agent.predictedState === 'WARNING' ? 'text-[#D6A84F]' : 'text-[#5E9C76]'
                          }`}>
                            {agent.predictedState.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            conf {((agent.predictionConfidence ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] text-slate-500">NOT EVALUATED — run Hybrid model</div>
                      )}
                    </div>
                  </div>

                  {/* Recommended Action */}
                  <div className="mb-3">
                    <div className="text-[10px] text-slate-400 mb-1">RECOMMENDED AGENT ACTION</div>
                    <div className={`px-2.5 py-1 text-xs font-semibold rounded border text-center ${getActionBadgeColor(agent.recommendedAction)}`}>
                      {agent.recommendedAction.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* Self Healing Trigger button if critical */}
                {isOverloaded && onTriggerSelfHealing && (
                  <button
                    onClick={() => onTriggerSelfHealing(agent.transformerId)}
                    className="w-full mt-2 py-1.5 px-3 bg-[#B94A48] hover:bg-[#A33B39] text-white text-xs font-semibold rounded transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <ArrowRightLeft size={14} />
                    TRIGGER SELF-HEALING
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* P2P Agent Message Bus Table */}
      <div className="bg-[#111827] border border-[#172033] rounded-lg p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MessageSquare size={16} className="text-[#5B7C99]" />
              REAL-TIME PEER-TO-PEER (P2P) AGENT MESSAGE BUS
            </h3>
            <p className="text-xs text-slate-400">Live decentralization logs & capacity negotiation events</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-[#0B0F14] border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#5B7C99]"
            >
              <option value="ALL">All Agents</option>
              <option value="T1">T1 Agent</option>
              <option value="T2">T2 Agent</option>
              <option value="T3">T3 Agent</option>
              <option value="T4">T4 Agent</option>
            </select>

            <select
              value={filterMessageType}
              onChange={(e) => setFilterMessageType(e.target.value)}
              className="bg-[#0B0F14] border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#5B7C99]"
            >
              <option value="ALL">All Message Types</option>
              <option value="ALERT_BROADCAST">ALERT_BROADCAST</option>
              <option value="CAPACITY_INQUIRY">CAPACITY_INQUIRY</option>
              <option value="CAPACITY_OFFER">CAPACITY_OFFER</option>
              <option value="CONSENSUS_REACHED">CONSENSUS_REACHED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B0F14] text-slate-400 uppercase font-mono text-[11px] border-b border-[#172033]">
              <tr>
                <th className="p-2.5">Time</th>
                <th className="p-2.5">Source Agent</th>
                <th className="p-2.5">Destination</th>
                <th className="p-2.5">Message Type</th>
                <th className="p-2.5">Risk Score</th>
                <th className="p-2.5">Payload Content</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172033]">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                    No P2P agent messages recorded. Trigger a simulation or self-healing event to generate messages.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-800/40 font-mono">
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">{msg.timestamp}</td>
                    <td className="p-2.5 text-[#5B7C99] font-bold">{msg.sourceAgentId}</td>
                    <td className="p-2.5 text-slate-300">{msg.destAgentId}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        msg.messageType === 'ALERT_BROADCAST' ? 'bg-[#B94A48]/20 text-[#B94A48]' :
                        msg.messageType === 'CAPACITY_OFFER' ? 'bg-[#5E9C76]/20 text-[#5E9C76]' :
                        msg.messageType === 'CONSENSUS_REACHED' ? 'bg-[#D6A84F]/20 text-[#D6A84F]' :
                        'bg-[#5B7C99]/20 text-[#5B7C99]'
                      }`}>
                        {msg.messageType}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={msg.riskScore >= 70 ? 'text-[#B94A48] font-bold' : 'text-slate-300'}>
                        {msg.riskScore}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-200 max-w-md truncate font-sans text-xs" title={msg.payloadMessage}>
                      {msg.payloadMessage}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 text-[10px] rounded bg-[#5E9C76]/20 text-[#5E9C76] border border-[#5E9C76]/30">
                        {msg.status}
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
