import React from 'react';
import { Boxes, LayoutDashboard, Activity, Sliders, Database, Layers, Brain, Cpu, ShieldCheck } from 'lucide-react';
import type { OperatingState } from '../simulation/types';

export type ActiveTab =
  | 'grid-twin'
  | 'overview'
  | 'digital-twin'
  | 'scenario-builder'
  | 'dataset-generator'
  | 'data-preview'
  | 'soft-computing'
  | 'multi-agent'
  | 'self-healing';

interface HeaderProps {
  simulationActive: boolean;
  simulationTime: number;
  activeState: OperatingState;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  datasetCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  simulationActive,
  simulationTime,
  activeState,
  activeTab,
  setActiveTab,
  datasetCount,
}) => {
  const formatClock = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const getStatusBadge = () => {
    if (activeState === 'OVERLOAD' || activeState === 'FAULT') {
      return (
        <span className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#B94A48]/20 border border-[#B94A48] text-[#B94A48] text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-[#B94A48] animate-pulse"></span>
          CRITICAL EVENT
        </span>
      );
    }
    if (simulationActive) {
      return (
        <span className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#5B7C99]/20 border border-[#5B7C99] text-white text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-[#5B7C99] animate-ping"></span>
          SIMULATION RUNNING
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#5E9C76]/20 border border-[#5E9C76]/40 text-[#5E9C76] text-xs font-mono font-bold">
        <span className="w-2 h-2 rounded-full bg-[#5E9C76]"></span>
        PLATFORM ONLINE
      </span>
    );
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'grid-twin', label: '3D Grid Twin', icon: <Boxes size={14} /> },
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
    { id: 'digital-twin', label: 'Twin Control', icon: <Activity size={14} /> },
    { id: 'scenario-builder', label: 'Scenarios', icon: <Sliders size={14} /> },
    { id: 'dataset-generator', label: 'Dataset', icon: <Database size={14} /> },
    { id: 'data-preview', label: 'Data Quality', icon: <Layers size={14} />, badge: datasetCount },
    { id: 'soft-computing', label: 'Soft Computing / AI', icon: <Brain size={14} /> },
    { id: 'multi-agent', label: 'Multi-Agent', icon: <Cpu size={14} /> },
    { id: 'self-healing', label: 'Self-Healing', icon: <ShieldCheck size={14} /> },
  ];

  return (
    <header className="bg-[#111827] border-b border-[#172033] px-3 py-1.5">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">
        
        {/* Brand */}
        <div className="flex items-baseline gap-2 shrink-0">
          <h1 className="text-base font-bold tracking-[0.18em] text-white font-mono">SYNAPSE GRID</h1>
          <span className="hidden 2xl:inline text-[11px] text-slate-400">Transformer digital twin · multi-agent self-healing</span>
        </div>
        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-[#0B0F14] p-1 rounded-lg border border-[#172033] overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#5B7C99]/30 text-white border border-[#5B7C99] shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#111827]'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-[#5B7C99]'}>{item.icon}</span>
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#5B7C99]/40 text-white font-mono font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Top-Right Clock & Status */}
        <div className={`flex items-center gap-2 shrink-0 ${activeTab === 'grid-twin' ? 'hidden' : ''}`}>
          <div>{getStatusBadge()}</div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0F14] border border-[#172033]">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              SIM TIME
            </span>
            <span className="font-mono text-sm font-bold text-white">
              {formatClock(simulationTime)}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
