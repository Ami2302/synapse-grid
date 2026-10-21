/**
 * SYNAPSE GRID — PARAMETERS OF THE PROJECT-SPECIFIC MATHEMATICAL MODEL
 * ---------------------------------------------------------------------
 * Every coefficient used by src/model/synapseModel.ts lives here, with:
 *   purpose · value + unit · why this value · effect on the result · how to tune it.
 *
 * STATUS: these values are engineering choices made for this simulated four-transformer
 * twin. They are NOT fitted to, or validated against, measured transformer data.
 * The validation script (validation/customModelValidation.ts) only checks bounds,
 * stability and that decisions are physically reasonable inside the simulation.
 */
import { DEFAULT_TRANSFORMERS } from '../simulation/initialData';

export interface ParamDoc {
  symbol: string;
  value: number;
  unit: string;
  purpose: string;
  rationale: string;
  effect: string;
  tuning: string;
}

const P = (symbol: string, value: number, unit: string, purpose: string, rationale: string, effect: string, tuning: string): ParamDoc =>
  ({ symbol, value, unit, purpose, rationale, effect, tuning });

/* ------------------------------------------------------------------ */
/* A. Disturbance score D_i                                            */
/* ------------------------------------------------------------------ */
export const DISTURBANCE = {
  alpha: P('α', 2.0, '–', 'Weight of the squared load-excess term u_L²',
    'Loading is the primary driver of overload in the twin (state labels use L ≥ 115 %). A value of 2 makes D ≈ 0.48 when a unit reaches 100 % with an ONAN safe limit of 80 %, i.e. action starts before the 115 % overload label.',
    'Larger α → disturbance detected at lower loading; smaller α → later detection.',
    'Sweep α in Load-Ramp runs and choose the smallest value for which D crosses D_act before the twin labels OVERLOAD.'),
  beta: P('β', 2.5, '–', 'Weight of the squared temperature-excess term u_T²',
    'Temperature carries the slow, cumulative part of the risk and controls when recovery can be confirmed; it is weighted slightly above load so a hot unit is not declared recovered just because its load dropped.',
    'Larger β → longer recovery confirmation after a transfer.',
    'Run the overload→transfer scenario and pick β so that recovery is confirmed when θ falls a few kelvin above T_safe.'),
  gamma: P('γ', 0.8, '–', 'Weight of the voltage-deviation term u_V',
    'Voltage sags in the twin (−5 % to −15 %) are secondary disturbances; γ = 0.8 makes a 10 % sag alone give D ≈ 0.79, i.e. a warning/action on its own.',
    'Larger γ → more sensitive to sags.',
    'Use Voltage-Sag scenario runs; γ should make the sag window D ≥ D_warn.'),
  delta: P('δ', 1.0, '–', 'Weight of the current-consistency term u_I',
    'u_I flags current that is not explained by the loading (sag or fault current). Unit weight keeps it comparable to the other terms.',
    'Larger δ → faster reaction to fault currents.',
    'Fault-Event runs: δ should push D above D_crit during the fault window.'),
  kappa: P('κ', 1.5, '–', 'Weight of the load × temperature synergy term u_L·u_T',
    'An overload on an already hot transformer is worse than either condition alone (ageing accelerates with both). The cross term adds risk only when both are present.',
    'Larger κ → stronger penalty for simultaneous load and thermal excess.',
    'Compare a cold and a pre-heated overload with equal load; κ sets how much earlier the hot case escalates.'),
  vDeadband: P('d_V', 0.03, 'p.u.', 'Voltage-deviation dead-band',
    'The twin drops voltage by 2.5 % at rated load by design; deviations within 3 % are normal regulation, not a disturbance.',
    'Larger d_V → ignores bigger deviations.',
    'Set just above the largest deviation seen in Normal-Operation runs.'),
  vScale: P('ε_V', 0.05, 'p.u.', 'Voltage-deviation scale beyond the dead-band',
    'A further 5 % deviation (8 % total) gives u_V = 1, a full-weight voltage disturbance.',
    'Smaller ε_V → u_V grows faster.',
    'Match to the statutory voltage band used by the utility (±5 % to ±10 %).'),
  iDeadband: P('d_I', 0.05, '–', 'Dead-band of the current-consistency ratio',
    'With noise and the small load-dependent voltage drop the ratio (I/I_r)/(L/100) stays within 5 % of 1 in normal operation.',
    'Larger d_I → ignores bigger current mismatches.',
    'Set above the 99th percentile of the ratio in Normal-Operation data.'),
  iScale: P('σ_I', 0.25, '–', 'Scale of the current-consistency excess',
    'A current 30 % above what the load explains gives u_I = 1.',
    'Smaller σ_I → u_I grows faster.',
    'Fault-Event data: choose so fault windows give u_I ≫ 1.'),
};

/* ------------------------------------------------------------------ */
/* Transformer-specific operating references                           */
/* ------------------------------------------------------------------ */
export const COMMON = {
  loadCritical: P('L_crit', 115, '%', 'Load at which the twin labels OVERLOAD', 'Taken from the twin labelling rule (Eq. 8 of the paper).', 'Normalises u_L.', 'Fixed by the labelling rule.'),
  tempCritical: P('T_crit', 105, '°C', 'Temperature at which the twin labels OVERLOAD', 'Taken from the twin labelling rule.', 'Normalises u_T.', 'Fixed by the labelling rule.'),
  nominalVoltage: P('V_n', 11, 'kV', 'Nominal primary voltage', 'All four units are 11/0.415 kV.', 'Reference for u_V.', '–'),
};

/** Safe loading by cooling class: forced cooling removes heat faster, so it tolerates more sustained load. */
export const SAFE_LOAD_BY_COOLING: Record<string, number> = { ONAN: 80, ONAF: 85, OFAF: 90 };

/** Twin thermal constants (same as physicsEngine.ts). */
const DT0 = 15, DTR = 45, NEXP = 1.8;

export interface TransformerReference {
  id: string;
  ratedMVA: number;
  coolingType: string;
  ambientC: number;
  thermalTimeConstantMin: number;
  safeLoadPercent: number;   // L_safe,i
  safeTempC: number;         // T_safe,i  (steady-state temperature at L_safe,i — derived, not chosen)
  ratedCurrentA: number;     // I_r,i
}

export function buildReference(id: string): TransformerReference {
  const t = DEFAULT_TRANSFORMERS[id];
  const Ls = SAFE_LOAD_BY_COOLING[t.coolingType] ?? 85;
  return {
    id,
    ratedMVA: t.ratedCapacityMVA,
    coolingType: t.coolingType,
    ambientC: t.ambientTempC,
    thermalTimeConstantMin: t.thermalTimeConstantMinutes,
    safeLoadPercent: Ls,
    safeTempC: Number((t.ambientTempC + DT0 + DTR * Math.pow(Ls / 100, NEXP)).toFixed(2)),
    ratedCurrentA: Number(((t.ratedCapacityMVA * 1000) / (Math.sqrt(3) * t.primaryVoltageKV)).toFixed(1)),
  };
}
export const REFERENCES: Record<string, TransformerReference> = Object.fromEntries(
  Object.keys(DEFAULT_TRANSFORMERS).map((id) => [id, buildReference(id)])
);
export const steadyTempAt = (id: string, loadPercent: number) =>
  REFERENCES[id].ambientC + DT0 + DTR * Math.pow(Math.max(0, loadPercent) / 100, NEXP);

/* ------------------------------------------------------------------ */
/* B. Health score H_i                                                 */
/* ------------------------------------------------------------------ */
export const HEALTH = {
  lambdaW: P('λ_W', 1 / 1800, '1/s', 'Rate at which accumulated abnormal exposure W_i lowers health',
    '30 min of full-severity abnormal operation (D = 1) reduces the permanent part of H to e⁻¹ ≈ 37 %.',
    'Larger λ_W → faster permanent decline.',
    'Choose so that the Sustained-Overload scenario (300 s at D ≈ 1) costs a few percent of health.'),
  psi: P('ψ', 0.02, 'per event', 'Permanent penalty per self-healing event N_i',
    'Each event that needs coordinated relief leaves a 2 % mark (recovery history).',
    'Larger ψ → repeated events count more.',
    'Set from how many events per year a utility tolerates before inspection.'),
  omega: P('ω', 0.40, '–', 'Maximum recoverable derating from short-term stress S_i',
    'Up to 40 % of health can be temporarily lost while the unit is stressed and is regained as it cools.',
    'Larger ω → health dips more during an event.',
    'Tune visually against the thermal recovery time of the twin.'),
  lambdaS: P('λ_S', 1 / 120, '1/s', 'Sensitivity of the recoverable part to stress S_i',
    '120 s·D² of stress gives 63 % of the maximum recoverable derating.',
    'Larger λ_S → stress shows up faster.',
    'As for ω.'),
  halfLife: P('t_½', 300, 's', 'Half-life of the short-term stress memory S_i',
    'Matches the order of the twin thermal time constants (τ_s = 180–300 steps).',
    'Longer t_½ → slower recovery of H.',
    'Set close to the median τ_s of the four units.'),
  dExposure: P('D_warn', 0.15, '–', 'Only D above this value counts as abnormal exposure W_i',
    'Same threshold as warning mode, so normal fluctuations do not age the score.', '–', '–'),
};

/* ------------------------------------------------------------------ */
/* C. Multi-agent coordination score C_ij                               */
/* ------------------------------------------------------------------ */
export const COORDINATION = {
  wCapacity: P('w_c', 0.45, '–', 'Weight of capacity coverage c_j', 'The first purpose of a supporter is to absorb the excess power.', 'Larger → prefers big-headroom units.', 'Rank stability check across T1–T4 overload cases.'),
  wHealth: P('w_h', 0.25, '–', 'Weight of supporter health H_j/100', 'A degraded unit should not be loaded further.', 'Larger → prefers healthy units.', 'As above.'),
  wRisk: P('w_r', 0.20, '–', 'Weight of overload risk ρ_j', 'Penalises supporters that would end close to their own safe limit.', 'Larger → spreads load over more supporters.', 'Increase if supporters end in WARNING after transfers.'),
  wDisturb: P('w_d', 0.10, '–', 'Weight of supporter disturbance D_j', 'A supporter already disturbed should help last.', '–', '–'),
  riskExponent: P('η', 4, '–', 'Steepness of the risk curve (L_j′/L_safe,j)^η', 'Risk stays small at moderate post-transfer loading and rises sharply near L_safe.', 'Larger η → risk only near the limit.', '–'),
  minHealth: P('H_min', 60, '%', 'Minimum health for a unit to be allowed to support', 'Below 60 the unit is treated as degraded.', 'Higher → fewer eligible supporters.', '–'),
  minScore: P('C_min', 0.20, '–', 'Minimum coordination score for eligibility', 'Excludes supporters with negligible net benefit.', '–', '–'),
  minHeadroomMVA: P('H_cap,min', 0.05, 'MVA', 'Smallest headroom worth negotiating', 'Avoids splitting transfers into negligible parts.', '–', '–'),
};

/* ------------------------------------------------------------------ */
/* D. Self-healing decision logic                                       */
/* ------------------------------------------------------------------ */
export const DECISION = {
  dWarn: P('D_warn', 0.15, '–', 'Enter warning mode', 'About 90 % loading on an ONAN unit.', '–', 'Lower → earlier warnings.'),
  dAct: P('D_act', 0.45, '–', 'Start coordinated self-healing', 'About 100 % loading on an ONAN unit, before the 115 % overload label.', '–', 'Lower → earlier action, more transfers.'),
  dRecover: P('D_rec', 0.10, '–', 'Below this value a unit counts as recovered', 'Below the warning threshold with margin (hysteresis).', '–', '–'),
  dCritical: P('D_crit', 0.85, '–', 'Critical disturbance', 'Combined with low health it triggers isolation.', '–', '–'),
  hIsolate: P('H_iso', 30, '%', 'Health below which a critical unit is flagged for isolation', 'Do not keep stressing a badly degraded unit.', '–', '–'),
  minCoverage: P('ζ', 0.25, '–', 'Minimum fraction of the required relief that supporters must offer', 'Below 25 % coverage a transfer is not worth it; flag instead.', '–', '–'),
  confirmSteps: P('M', 10, 's', 'Consecutive seconds with D < D_rec needed to confirm recovery', 'Prevents declaring recovery on a single noisy sample.', '–', '–'),
  maxRecoverySteps: P('T_rec,max', 1200, 's', 'Time allowed for recovery before escalation', 'About four times the largest τ_s.', '–', '–'),
  escalationSteps: P('T_esc', 30, 's', 'Escalate to isolation if D stays ≥ D_act this long after a transfer',
    'Partial relief that leaves the unit overloaded must not be tolerated for long; 30 s is short compared with the thermal time constants, so the unit is still cool when the flag is raised.',
    'Shorter → faster escalation after insufficient relief.', 'Must exceed τ_c plus the twin load-settling time (~5 s).'),
  commLatencySteps: P('τ_c', 2, 's', 'Simulated message latency per coordination stage', 'Makes each stage (alert, offers, decision) visible and gives agents time to respond.', '–', '–'),
};

export const LIMITS = {
  loadMargin: P('m_L', 5, '%', 'Margin for the twin\'s normal load swing',
    'The Normal-Operation profile varies load by ±5 % (sinusoid); targets and supporter limits keep this margin so units do not cross a threshold on the next swing.',
    'Larger m_L → more relief requested, less load accepted by each supporter.',
    'Set to the amplitude of normal load variation observed in the dataset.'),
  warnLoad: P('L_warn', 85, '%', 'Load at which the twin labels WARNING',
    'Supporters are never planned above the twin\'s own warning threshold, even if their cooling class would allow more.',
    'Caps the headroom of ONAF/OFAF units.', 'Fixed by the labelling rule.'),
};
/** Planned loading limit of a supporter j:  L_lim,j = min(L_safe,j, L_warn) − m_L  */
export const supporterLimit = (id: string) => Math.min(REFERENCES[id].safeLoadPercent, LIMITS.warnLoad.value) - LIMITS.loadMargin.value;
/** Load the relieved unit i is brought back to:  L_tgt,i = L_safe,i − m_L */
export const reliefTarget = (id: string) => REFERENCES[id].safeLoadPercent - LIMITS.loadMargin.value;

export const ALL_PARAMETER_GROUPS: Array<{ title: string; params: Record<string, ParamDoc> }> = [
  { title: 'A. Disturbance score', params: DISTURBANCE },
  { title: 'References', params: COMMON },
  { title: 'B. Health score', params: HEALTH },
  { title: 'C. Coordination score', params: COORDINATION },
  { title: 'D. Decision logic', params: DECISION },
  { title: 'Transfer limits', params: LIMITS },
];
