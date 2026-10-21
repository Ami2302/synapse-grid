import type { TransformerAgentState, AgentMessage, SelfHealingActionRecord } from './types';
import type { MultiAgentEngine } from './agentEngine';
import type { TransformerState, TransformerConfig, OperatingState } from '../simulation/types';
import { FuzzyLogicEngine } from '../ml/fuzzyEngine';

export interface SelfHealingResult {
  logs: SelfHealingActionRecord[];
  messages: AgentMessage[];
  updatedStates: Record<string, Partial<TransformerState>>;
  pipelineSteps: {
    stepIndex: number;
    title: string;
    description: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING';
    details?: string;
  }[];
  /** Numeric summary of the event (used for reporting / export). */
  summary: SelfHealingSummary;
}

/** Optional overrides used by the 3D grid twin (custom coordination model). Defaults reproduce the paper. */
export interface SelfHealingOptions {
  targetLoadPercent?: number;
  headroomLimitPercent?: (id: string) => number;
  rankSupporters?: (c: Array<{ ag: TransformerAgentState; headroomMVA: number }>) => Array<{ ag: TransformerAgentState; headroomMVA: number }>;
}

export interface SelfHealingSummary {
  affectedId: string;
  requiredMVA: number;
  transferredMVA: number;
  transfers: Array<{ supportId: string; mva: number }>;
  before: Record<string, { loadPercent: number; tempC: number; state: OperatingState }>;
  after: Record<string, { loadPercent: number; tempC: number; tempSteadyC: number; state: OperatingState }>;
  outcome: 'RECOVERED' | 'STABILIZED' | 'IN_PROGRESS';
}

/* ---- Constants shared with the Digital Twin physics engine (physicsEngine.ts) ---- */
export const TARGET_LOAD_PERCENT = 80; // load the affected transformer is brought down to
export const HEADROOM_LIMIT_PERCENT = 85; // supporters may be loaded up to the warning threshold
const DELTA_T_NO_LOAD = 15.0; // K
const DELTA_T_RATED = 45.0; // K
const LOAD_EXPONENT = 1.8;
export const SETTLE_STEPS = 60; // twin steps (1 s each) simulated after the transfer

/** Eq. (5): steady-state temperature at a given load (no fault, stress factor 1). */
export function steadyStateTemp(loadPercent: number, ambientC: number): number {
  return ambientC + DELTA_T_NO_LOAD + DELTA_T_RATED * Math.pow(loadPercent / 100, LOAD_EXPONENT);
}

/** Eq. (6) iterated n steps in closed form: θ_n = θ_ss + (θ_0 − θ_ss)(1 − 1/τ_s)^n, τ_s = 6·T_th. */
export function settleTemp(theta0: number, loadPercent: number, ambientC: number, thermalTimeConstantMin: number, n: number): number {
  const tauS = Math.max(1, (thermalTimeConstantMin * 60) / 10);
  const ss = steadyStateTemp(loadPercent, ambientC);
  return ss + (theta0 - ss) * Math.pow(1 - 1 / tauS, n);
}

/** Eq. (8): operating-state labelling rule of the Digital Twin (no fault, no sag). */
export function labelState(loadPercent: number, tempC: number): OperatingState {
  if (loadPercent >= 115 || tempC >= 105) return 'OVERLOAD';
  if (loadPercent >= 100 || tempC >= 90) return 'HIGH_STRESS';
  if (loadPercent >= 85 || tempC >= 75) return 'WARNING';
  return 'NORMAL';
}

const r1 = (v: number) => Number(v.toFixed(1));
const r2 = (v: number) => Number(v.toFixed(2));

export class SelfHealingEngine {
  /**
   * MVA-consistent self-healing (Eq. 11):
   *   H_j  = S_j/100 · max(0, 85 − L_j)               headroom of supporter j [MVA]
   *   ΔS   = min(S_1/100 · (L_1 − 80), Σ H_j)          power to move [MVA]
   *   L_1' = L_1 − 100·ΔS/S_1 ,  L_j' = L_j + 100·ΔS_j/S_j
   * Post-transfer temperatures follow the twin's first-order thermal model for SETTLE_STEPS steps,
   * and the outcome is decided by the labelling rule (Eq. 8) on the new state.
   */
  public static executeSelfHealing(
    overloadedId: string,
    agents: Record<string, TransformerAgentState>,
    agentEngine: MultiAgentEngine,
    transformers?: Record<string, TransformerConfig>,
    options?: SelfHealingOptions
  ): SelfHealingResult {
    const affected = agents[overloadedId];
    const emptySummary: SelfHealingSummary = {
      affectedId: overloadedId, requiredMVA: 0, transferredMVA: 0, transfers: [], before: {}, after: {}, outcome: 'IN_PROGRESS',
    };
    if (!affected) {
      return { logs: [], messages: [], updatedStates: {}, pipelineSteps: [], summary: emptySummary };
    }

    const cfg = (id: string) => transformers?.[id];
    const ambient = (id: string) => cfg(id)?.ambientTempC ?? 28;
    const tth = (id: string) => cfg(id)?.thermalTimeConstantMinutes ?? 45;

    const timestamp = new Date().toISOString().substring(11, 19);
    const messages: AgentMessage[] = [];
    const logs: SelfHealingActionRecord[] = [];
    const updatedStates: Record<string, Partial<TransformerState>> = {};

    const S1 = affected.ratedCapacityMVA;
    const L1 = affected.currentLoadPercent;
    const target = options?.targetLoadPercent ?? TARGET_LOAD_PERCENT;
    const limitOf = (id: string) => options?.headroomLimitPercent?.(id) ?? HEADROOM_LIMIT_PERCENT;
    const requiredMVA = Math.max(0, (S1 / 100) * (L1 - target));

    // Step 1: alert
    messages.push(agentEngine.addMessage({
      timestamp,
      sourceAgentId: affected.agentId,
      destAgentId: 'NETWORK_BUS',
      messageType: 'ALERT_BROADCAST',
      riskScore: affected.riskScore,
      payloadMessage: `ALERT: ${affected.transformerId} at ${r1(L1)}% load, ${r1(affected.transformerTempC)}°C, risk ${affected.riskScore}/100. Needs ${r2(requiredMVA)} MVA relief to reach ${target}%.`,
      status: 'SENT',
    }));

    // Step 2: headroom of neighbours in MVA
    const baseCandidates = Object.values(agents)
      .filter((ag) => ag.transformerId !== overloadedId)
      .map((ag) => ({ ag, headroomMVA: (ag.ratedCapacityMVA / 100) * Math.max(0, limitOf(ag.transformerId) - ag.currentLoadPercent) }))
      .filter((c) => c.headroomMVA > 0.01)
      .sort((a, b) => b.headroomMVA - a.headroomMVA);
    const candidates = options?.rankSupporters ? options.rankSupporters(baseCandidates) : baseCandidates;

    messages.push(agentEngine.addMessage({
      timestamp,
      sourceAgentId: affected.agentId,
      destAgentId: 'NETWORK_BUS',
      messageType: 'CAPACITY_INQUIRY',
      riskScore: affected.riskScore,
      payloadMessage: `Capacity inquiry: requesting ${r2(requiredMVA)} MVA. ${candidates.length} eligible neighbour(s).`,
      status: 'DELIVERED',
    }));

    // Step 3: greedy MVA allocation
    let remaining = requiredMVA;
    const transfers: Array<{ supportId: string; mva: number }> = [];
    for (const c of candidates) {
      if (remaining <= 1e-6) break;
      const mva = Math.min(c.headroomMVA, remaining);
      remaining -= mva;
      transfers.push({ supportId: c.ag.transformerId, mva });
      messages.push(agentEngine.addMessage({
        timestamp,
        sourceAgentId: c.ag.agentId,
        destAgentId: affected.agentId,
        messageType: 'CAPACITY_OFFER',
        riskScore: c.ag.riskScore,
        payloadMessage: `${c.ag.transformerId} offers ${r2(mva)} MVA (headroom ${r2(c.headroomMVA)} MVA at ${r1(c.ag.currentLoadPercent)}% load).`,
        status: 'DELIVERED',
      }));
    }
    const transferredMVA = requiredMVA - Math.max(0, remaining);

    // Step 4: apply transfer + thermal settling
    const before: SelfHealingSummary['before'] = {};
    const after: SelfHealingSummary['after'] = {};
    const record = (ag: TransformerAgentState) => {
      before[ag.transformerId] = { loadPercent: r1(ag.currentLoadPercent), tempC: r1(ag.transformerTempC), state: ag.operatingState };
    };
    record(affected);

    const newL1 = L1 - (100 * transferredMVA) / S1;
    const applyNew = (ag: TransformerAgentState, newLoad: number) => {
      const id = ag.transformerId;
      const theta = settleTemp(ag.transformerTempC, newLoad, ambient(id), tth(id), SETTLE_STEPS);
      const thetaSS = steadyStateTemp(newLoad, ambient(id));
      const state = labelState(newLoad, theta);
      after[id] = { loadPercent: r1(newLoad), tempC: r1(theta), tempSteadyC: r1(thetaSS), state };
      updatedStates[id] = { loadPercent: r1(newLoad), transformerTemperatureC: r1(theta), operatingState: state };
    };
    applyNew(affected, newL1);

    for (const t of transfers) {
      const sup = agents[t.supportId];
      record(sup);
      const newLoad = sup.currentLoadPercent + (100 * t.mva) / sup.ratedCapacityMVA;
      applyNew(sup, newLoad);
      messages.push(agentEngine.addMessage({
        timestamp,
        sourceAgentId: affected.agentId,
        destAgentId: sup.agentId,
        messageType: 'LOAD_TRANSFER_CONFIRM',
        riskScore: affected.riskScore,
        payloadMessage: `Transfer ${r2(t.mva)} MVA: ${affected.transformerId} → ${sup.transformerId}. ${sup.transformerId} now ${after[sup.transformerId].loadPercent}%.`,
        status: 'EXECUTED',
      }));
    }

    const a1 = after[overloadedId];
    const severity: Record<OperatingState, number> = { NORMAL: 0, RECOVERY: 0, WARNING: 1, HIGH_STRESS: 2, OVERLOAD: 3, FAULT: 4 };
    const worstSupporter = transfers.reduce((w, t) => Math.max(w, severity[after[t.supportId].state]), 0);
    const outcome: SelfHealingSummary['outcome'] =
      severity[a1.state] === 0 && worstSupporter <= 1 ? 'RECOVERED'
      : severity[a1.state] <= 1 && worstSupporter <= 1 ? 'STABILIZED'
      : 'IN_PROGRESS';

    for (const t of transfers) {
      logs.push({
        id: `ACT-${Date.now()}-${t.supportId}`,
        timestamp,
        eventType: L1 >= 115 ? 'SUSTAINED_OVERLOAD' : 'HIGH_STRESS_MITIGATION',
        affectedAgentId: affected.agentId,
        supportAgentId: agents[t.supportId].agentId,
        actionTaken: `Transferred ${r2(t.mva)} MVA from ${overloadedId} to ${t.supportId}`,
        loadBeforePercent: r1(L1),
        loadAfterPercent: a1.loadPercent,
        tempBeforeC: r1(affected.transformerTempC),
        tempAfterC: a1.tempC,
        resultStatus: outcome,
      });
    }

    const newRisk = FuzzyLogicEngine.infer(a1.loadPercent, a1.tempC, 11.0).riskScore;
    if (transfers.length > 0) {
      messages.push(agentEngine.addMessage({
        timestamp,
        sourceAgentId: 'CONSENSUS_ENGINE',
        destAgentId: 'NETWORK_BUS',
        messageType: 'CONSENSUS_REACHED',
        riskScore: newRisk,
        payloadMessage: `Consensus: ${r2(transferredMVA)} of ${r2(requiredMVA)} MVA moved. ${overloadedId} ${a1.loadPercent}% / ${a1.tempC}°C → ${a1.state}. Outcome: ${outcome}.`,
        status: 'EXECUTED',
      }));
    } else {
      messages.push(agentEngine.addMessage({
        timestamp,
        sourceAgentId: affected.agentId,
        destAgentId: 'NETWORK_BUS',
        messageType: 'ALERT_BROADCAST',
        riskScore: affected.riskScore,
        payloadMessage: `No neighbour headroom available. Emergency load shedding required at ${overloadedId}.`,
        status: 'SENT',
      }));
    }

    const pipelineSteps: SelfHealingResult['pipelineSteps'] = [
      {
        stepIndex: 1,
        title: 'Overload Detection',
        description: `${affected.agentId} at ${r1(L1)}% load, risk ${affected.riskScore}/100.`,
        status: 'COMPLETED',
        details: `Required relief: ${r2(requiredMVA)} MVA to reach ${TARGET_LOAD_PERCENT}%`,
      },
      {
        stepIndex: 2,
        title: 'Neighbour Headroom Query',
        description: `Headroom computed in MVA up to each supporter's loading limit.`,
        status: 'COMPLETED',
        details: candidates.map((c) => `${c.ag.transformerId}: ${r2(c.headroomMVA)} MVA`).join(' · ') || 'No headroom',
      },
      {
        stepIndex: 3,
        title: 'Capacity Allocation',
        description: transfers.length > 0 ? `Allocated ${r2(transferredMVA)} MVA across ${transfers.length} supporter(s).` : 'No supporter available.',
        status: transfers.length > 0 ? 'COMPLETED' : 'IN_PROGRESS',
        details: transfers.map((t) => `${t.supportId}: ${r2(t.mva)} MVA`).join(' · ') || 'Emergency shedding',
      },
      {
        stepIndex: 4,
        title: 'Load Transfer + Thermal Settling',
        description: `${overloadedId}: ${r1(L1)}% → ${a1.loadPercent}%, θ ${r1(affected.transformerTempC)} → ${a1.tempC}°C after ${SETTLE_STEPS} s (steady state ${a1.tempSteadyC}°C).`,
        status: 'COMPLETED',
      },
      {
        stepIndex: 5,
        title: 'Recovery Verification',
        description: `New state of ${overloadedId}: ${a1.state}. Outcome: ${outcome}.`,
        status: outcome === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED',
        details: `Fuzzy risk after transfer: ${newRisk}/100`,
      },
    ];

    return {
      logs,
      messages,
      updatedStates,
      pipelineSteps,
      summary: { affectedId: overloadedId, requiredMVA: r2(requiredMVA), transferredMVA: r2(transferredMVA), transfers: transfers.map((t) => ({ supportId: t.supportId, mva: r2(t.mva) })), before, after, outcome },
    };
  }
}
