/**
 * SYNAPSE GRID — PROJECT-SPECIFIC MATHEMATICAL MODEL (proposed, simulation-verified only)
 *
 * (A) Disturbance score     D_i = 1 − exp(−E_i),
 *                           E_i = α u_L² + β u_T² + γ u_V + δ u_I + κ u_L u_T
 * (B) Health score          H_i = 100 · exp(−λ_W W_i − ψ N_i) · [1 − ω (1 − exp(−λ_S S_i))]
 *                           W_i ← W_i + D_i Δt · 1[D_i > D_warn]           (irreversible exposure)
 *                           S_i ← S_i · 2^(−Δt/t½) + D_i² Δt               (recoverable stress memory)
 * (C) Coordination score    C_ij = A_ij · 1[H_j ≥ H_min] · (w_c c_j + w_h H_j/100 − w_r ρ_j − w_d D_j)
 *                           c_j = min(1, Cap_j/ΔS_req),  Cap_j = S_j (L_lim,j − L_j)⁺/100,  L_lim,j = min(L_safe,j, 85) − m_L
 *                           ρ_j = max((L_j′/L_safe,j)^η, u_T,j),  L_j′ = L_j + 100 min(Cap_j, ΔS_req)/S_j
 * (D) Decision rule         see decide() below.
 * Parameters: src/model/synapseModelParams.ts
 */
import { DISTURBANCE as A, COMMON, HEALTH as B, COORDINATION as C, DECISION as D, REFERENCES, supporterLimit, reliefTarget } from './synapseModelParams';

export interface Measurement {
  id: string;
  loadPercent: number;
  tempC: number;
  voltageKV: number;
  currentA: number;
}

export interface DisturbanceBreakdown {
  uL: number; uT: number; uV: number; uI: number;
  termL: number; termT: number; termV: number; termI: number; termLT: number;
  E: number; D: number;
  ref: { Lsafe: number; Tsafe: number; Ir: number };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const finite = (x: number, fallback = 0) => (Number.isFinite(x) ? x : fallback);

/** (A) Disturbance score with every intermediate term (for the Mathematical Model panel). */
export function disturbanceScore(m: Measurement): DisturbanceBreakdown {
  const r = REFERENCES[m.id];
  const Lc = COMMON.loadCritical.value, Tc = COMMON.tempCritical.value, Vn = COMMON.nominalVoltage.value;
  const uL = Math.max(0, (m.loadPercent - r.safeLoadPercent) / (Lc - r.safeLoadPercent));
  const uT = Math.max(0, (m.tempC - r.safeTempC) / (Tc - r.safeTempC));
  const dv = Math.abs(m.voltageKV - Vn) / Vn;
  const uV = Math.pow(Math.max(0, dv - A.vDeadband.value) / A.vScale.value, 2);
  // current-consistency: current per unit of loading, relative to the rated current
  const loadFrac = Math.max(0.05, m.loadPercent / 100);
  const ratio = m.currentA / r.ratedCurrentA / loadFrac;
  const uI = Math.max(0, ratio - 1 - A.iDeadband.value) / A.iScale.value;
  const termL = A.alpha.value * uL * uL;
  const termT = A.beta.value * uT * uT;
  const termV = A.gamma.value * uV;
  const termI = A.delta.value * uI;
  const termLT = A.kappa.value * uL * uT;
  const E = finite(termL + termT + termV + termI + termLT);
  const Dv = clamp(1 - Math.exp(-E), 0, 1);
  return { uL, uT, uV, uI, termL, termT, termV, termI, termLT, E, D: Dv, ref: { Lsafe: r.safeLoadPercent, Tsafe: r.safeTempC, Ir: r.ratedCurrentA } };
}

/** (B) Health state carried per transformer. */
export interface HealthState { W: number; S: number; N: number; H: number }
export const initialHealth = (): HealthState => ({ W: 0, S: 0, N: 0, H: 100 });

export function healthValue(h: Pick<HealthState, 'W' | 'S' | 'N'>): number {
  const permanent = Math.exp(-B.lambdaW.value * h.W - B.psi.value * h.N);
  const recoverable = 1 - B.omega.value * (1 - Math.exp(-B.lambdaS.value * h.S));
  return clamp(100 * permanent * recoverable, 0, 100);
}

/** Advance the health state by one step of Δt seconds with disturbance D. */
export function updateHealth(h: HealthState, Dv: number, dt = 1): HealthState {
  const W = h.W + (Dv > B.dExposure.value ? Dv * dt : 0);
  const S = h.S * Math.pow(2, -dt / B.halfLife.value) + Dv * Dv * dt;
  const next = { W, S, N: h.N, H: 0 };
  next.H = healthValue(next);
  return next;
}

/** (C) Coordination score of supporter j for affected transformer i. */
export interface SupporterInput {
  id: string;
  loadPercent: number;
  tempC: number;
  D: number;
  H: number;
  linkAvailable: boolean;
}
export interface CoordinationScore {
  id: string;
  A: number; capMVA: number; c: number; Lafter: number; rho: number; healthOk: boolean;
  score: number; eligible: boolean; reason: string;
}

export function coordinationScore(s: SupporterInput, requiredMVA: number): CoordinationScore {
  const r = REFERENCES[s.id];
  const A_ij = s.linkAvailable ? 1 : 0;
  const capMVA = (r.ratedMVA * Math.max(0, supporterLimit(s.id) - s.loadPercent)) / 100;
  const c = requiredMVA > 0 ? Math.min(1, capMVA / requiredMVA) : 0;
  const Lafter = s.loadPercent + (100 * Math.min(capMVA, requiredMVA)) / r.ratedMVA;
  const uT = Math.max(0, (s.tempC - r.safeTempC) / (COMMON.tempCritical.value - r.safeTempC));
  const rho = Math.max(Math.pow(Lafter / r.safeLoadPercent, C.riskExponent.value), uT);
  const healthOk = s.H >= C.minHealth.value;
  const raw = C.wCapacity.value * c + C.wHealth.value * (s.H / 100) - C.wRisk.value * rho - C.wDisturb.value * s.D;
  const score = A_ij * (healthOk ? 1 : 0) * raw;
  let reason = 'eligible';
  if (!A_ij) reason = 'communication link down';
  else if (!healthOk) reason = `health ${s.H.toFixed(0)} < ${C.minHealth.value}`;
  else if (capMVA < C.minHeadroomMVA.value) reason = 'no headroom below its limit L_lim';
  else if (score < C.minScore.value) reason = `score ${score.toFixed(2)} < C_min`;
  const eligible = reason === 'eligible';
  return { id: s.id, A: A_ij, capMVA, c, Lafter, rho, healthOk, score, eligible, reason };
}

/** (D) Decision rule. */
export type SelfHealingAction =
  | 'NORMAL_OPERATION'
  | 'WARNING_MODE'
  | 'REDISTRIBUTE_LOAD'
  | 'FLAG_ISOLATION'
  | 'RECOVERY_MODE'
  | 'RECOVERED';

export interface DecisionInput {
  D: number;
  H: number;
  requiredMVA: number;
  eligibleCapacityMVA: number;
  anyLinkAvailable: boolean;
}
export interface Decision { action: SelfHealingAction; reason: string }

export function decide(x: DecisionInput): Decision {
  if (x.D < D.dWarn.value) return { action: 'NORMAL_OPERATION', reason: `D = ${x.D.toFixed(2)} < D_warn` };
  if (x.D < D.dAct.value) return { action: 'WARNING_MODE', reason: `D_warn ≤ D = ${x.D.toFixed(2)} < D_act` };
  if (x.D >= D.dCritical.value && x.H < D.hIsolate.value)
    return { action: 'FLAG_ISOLATION', reason: `critical D = ${x.D.toFixed(2)} with low health H = ${x.H.toFixed(0)}` };
  if (!x.anyLinkAvailable) return { action: 'FLAG_ISOLATION', reason: 'no communication link available' };
  const coverage = x.requiredMVA > 0 ? x.eligibleCapacityMVA / x.requiredMVA : 0;
  if (coverage >= D.minCoverage.value)
    return { action: 'REDISTRIBUTE_LOAD', reason: `eligible capacity covers ${(Math.min(1, coverage) * 100).toFixed(0)} % of ${x.requiredMVA.toFixed(2)} MVA` };
  return { action: 'FLAG_ISOLATION', reason: `coverage ${(coverage * 100).toFixed(0)} % < ζ = ${(D.minCoverage.value * 100).toFixed(0)} %` };
}

/** Required relief to bring transformer i back to its safe loading (MVA). */
export function requiredRelief(id: string, loadPercent: number): number {
  const r = REFERENCES[id];
  return Math.max(0, (r.ratedMVA * (loadPercent - reliefTarget(id))) / 100);
}
