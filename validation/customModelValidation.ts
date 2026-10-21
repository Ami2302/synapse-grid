/**
 * Validation of the Synapse Grid project-specific model (run: npx tsx validation/customModelValidation.ts)
 * Uses the SAME controller and equations as the website. Writes validation/results.json.
 * This is simulation verification (bounds, stability, plausibility) — not experimental validation.
 */
import { writeFileSync } from 'node:fs';
import { GridTwinController, IDS } from '../src/twin/gridTwinController';
import { disturbanceScore, healthValue, updateHealth, initialHealth, coordinationScore, decide, requiredRelief } from '../src/model/synapseModel';
import { REFERENCES, supporterLimit, reliefTarget } from '../src/model/synapseModelParams';
import { createPRNG } from '../src/simulation/physicsEngine';

const r = (x: number, d = 3) => Number(x.toFixed(d));
const out: Record<string, unknown> = { generatedAt: new Date().toISOString() };

/* ---------------- references ---------------- */
out.references = Object.fromEntries(IDS.map((id) => [id, { ...REFERENCES[id], supporterLimit: supporterLimit(id), reliefTarget: reliefTarget(id) }]));

/* ---------------- helper: run a scenario ---------------- */
function run(name: string, setup: (c: GridTwinController) => void, disturb: null | { id: string; to: number; at: number }, steps: number) {
  const c = new GridTwinController(42, 900);
  setup(c);
  const maxD: Record<string, number> = Object.fromEntries(IDS.map((id) => [id, 0]));
  const maxT: Record<string, number> = Object.fromEntries(IDS.map((id) => [id, 0]));
  const trace: Array<Record<string, number | string>> = [];
  let detectedAt: number | null = null;
  for (let k = 0; k < steps; k++) {
    if (disturb && c.t === disturb.at) c.injectDisturbance(disturb.id, disturb.to);
    c.step();
    const s = c.snapshot();
    for (const id of IDS) { maxD[id] = Math.max(maxD[id], s.units[id].dist.D); maxT[id] = Math.max(maxT[id], s.units[id].state.transformerTemperatureC); }
    if (s.event && detectedAt === null) detectedAt = s.t;
    if (k % 5 === 0) {
      const row: Record<string, number | string> = { t: s.t, phase: s.event?.phase ?? 'NONE' };
      for (const id of IDS) { row[`L_${id}`] = r(s.units[id].state.loadPercent, 1); row[`T_${id}`] = r(s.units[id].state.transformerTemperatureC, 2); row[`D_${id}`] = r(s.units[id].dist.D); row[`H_${id}`] = r(s.units[id].health.H, 2); }
      trace.push(row);
    }
    if (s.event && (s.event.phase === 'RECOVERED' || s.event.phase === 'ISOLATED') && k > (disturb?.at ?? 0) + 40) break;
  }
  const s = c.snapshot();
  const ev = s.event;
  const res = {
    name,
    steps: s.t,
    detectedAt,
    disturbanceAt: disturb?.at ?? null,
    detectionDelay: detectedAt !== null && disturb ? detectedAt - disturb.at : null,
    outcome: ev?.outcome ?? 'NO EVENT',
    timeToOutcome: ev ? (ev.recoveredAt ?? s.t) - ev.startT : null,
    requiredMVA: ev ? r(ev.requiredMVA, 2) : 0,
    decision: ev?.decision ?? null,
    scores: ev?.scores.map((x) => ({ id: x.id, A: x.A, capMVA: r(x.capMVA, 2), c: r(x.c), rho: r(x.rho), score: r(x.score), eligible: x.eligible, reason: x.reason })) ?? [],
    transfers: ev?.transfers.map((t) => ({ ...t, mva: r(t.mva, 2) })) ?? [],
    before: ev?.before, after: ev?.after ?? Object.fromEntries(IDS.map((id) => [id, { L: s.units[id].state.loadPercent, T: s.units[id].state.transformerTemperatureC, D: s.units[id].dist.D }])),
    final: Object.fromEntries(IDS.map((id) => [id, { L: r(s.units[id].state.loadPercent, 1), T: r(s.units[id].state.transformerTemperatureC, 2), D: r(s.units[id].dist.D), H: r(s.units[id].health.H, 2), state: s.units[id].state.operatingState, action: s.units[id].action }])),
    maxD: Object.fromEntries(Object.entries(maxD).map(([k, v]) => [k, r(v)])),
    maxT: Object.fromEntries(Object.entries(maxT).map(([k, v]) => [k, r(v, 2)])),
    log: s.log.slice().reverse().map((l) => `t=${l.t}s ${l.stage} ${l.unit}: ${l.text}`),
    trace,
  };
  console.log(`\n=== ${name} ===  outcome=${res.outcome} detect+${res.detectionDelay}s  t_out=${res.timeToOutcome}s  transfers=${JSON.stringify(res.transfers)}`);
  return { res, c };
}

/* S1 normal operation, 600 s */
const S1 = run('S1 Normal operation (600 s)', () => {}, null, 600).res;
/* S2 overload of T1 to 118 % */
const S2run = run('S2 Overload T1 → 118 %', () => {}, { id: 'T1', to: 118, at: 20 }, 1500);
const S2 = S2run.res;
/* S3a partial communication failure: links T1–T4 and T1–T2 down → only T3 reachable */
const S3a = run('S3a Communication failure: T1–T4 and T1–T2 down', (c) => { c.setLink('T1', 'T4', false); c.setLink('T1', 'T2', false); }, { id: 'T1', to: 118, at: 20 }, 1500).res;
/* S3b link T1–T4 down only → partial relief from T2 / T3, recovery check */
const S3b = run('S3b Communication failure: T1–T4 down', (c) => { c.setLink('T1', 'T4', false); }, { id: 'T1', to: 118, at: 20 }, 1500).res;
/* S4 recovery: after S2, restore base load and observe health recovery for 600 s */
const c4 = S2run.c;
const H_before4 = Object.fromEntries(IDS.map((id) => [id, r(c4.snapshot().units[id].health.H, 2)]));
c4.restoreNormal();
for (let k = 0; k < 600; k++) c4.step();
const S4 = { name: 'S4 Recovery after S2 (base load restored, 600 s)', H_before: H_before4, H_after: Object.fromEntries(IDS.map((id) => [id, r(c4.snapshot().units[id].health.H, 2)])), final: Object.fromEntries(IDS.map((id) => [id, { D: r(c4.snapshot().units[id].dist.D), state: c4.snapshot().units[id].state.operatingState }])) };
console.log('\n=== S4 ===', S4);
/* S5 overload of the smallest unit T3 to 135 % */
const S5 = run('S5 Overload T3 → 135 %', () => {}, { id: 'T3', to: 135, at: 20 }, 1500).res;
out.scenarios = { S1, S2, S3a, S3b, S4, S5 };

/* ---------------- bounds, stability, monotonicity ---------------- */
const rnd = createPRNG(7);
let dMin = 1, dMax = 0, nonFinite = 0, monoViolL = 0, monoViolT = 0;
const N = 20000;
for (let k = 0; k < N; k++) {
  const id = IDS[Math.floor(rnd() * 4)];
  const m = { id, loadPercent: rnd() * 250, tempC: rnd() * 250, voltageKV: rnd() * 15, currentA: rnd() * 5000 };
  const d = disturbanceScore(m).D;
  if (!Number.isFinite(d)) nonFinite++;
  dMin = Math.min(dMin, d); dMax = Math.max(dMax, d);
  const dL = disturbanceScore({ ...m, loadPercent: m.loadPercent + 1, currentA: m.currentA * (m.loadPercent + 1) / Math.max(1e-9, m.loadPercent) }).D;
  if (dL + 1e-12 < d && m.loadPercent > 5) monoViolL++;
  const dT = disturbanceScore({ ...m, tempC: m.tempC + 1 }).D;
  if (dT + 1e-12 < d) monoViolT++;
}
const extremes = [
  { id: 'T1', loadPercent: 0, tempC: 0, voltageKV: 0, currentA: 0 },
  { id: 'T2', loadPercent: 1e6, tempC: 1e6, voltageKV: 1e6, currentA: 1e9 },
  { id: 'T3', loadPercent: -50, tempC: -40, voltageKV: 11, currentA: 0 },
].map((m) => r(disturbanceScore(m).D, 6));
let hMin = 100, hMax = 0;
for (let k = 0; k < N; k++) {
  const h = healthValue({ W: rnd() * 1e5, S: rnd() * 1e5, N: Math.floor(rnd() * 500) });
  hMin = Math.min(hMin, h); hMax = Math.max(hMax, h);
}
// health trajectory under constant D (stability: monotone decline, bounded, no oscillation)
const healthCurve = [0, 0.3, 0.6, 1].map((Dv) => {
  let h = initialHealth(); const pts: number[] = [];
  for (let k = 0; k <= 3600; k++) { if (k % 600 === 0) pts.push(r(h.H, 2)); h = updateHealth(h, Dv, 1); }
  return { D: Dv, H_every_600s: pts };
});
// coordination score range
let cMin = 1, cMax = -1;
for (let k = 0; k < N; k++) {
  const id = IDS[1 + Math.floor(rnd() * 3)];
  const sc = coordinationScore({ id, loadPercent: rnd() * 120, tempC: 20 + rnd() * 100, D: rnd(), H: rnd() * 100, linkAvailable: rnd() > 0.2 }, rnd() * 6).score;
  cMin = Math.min(cMin, sc); cMax = Math.max(cMax, sc);
}
// decision table
const decisionTable = [
  { D: 0.05, H: 95, req: 0, cap: 0, link: true },
  { D: 0.30, H: 95, req: 0.5, cap: 3, link: true },
  { D: 0.91, H: 98, req: 4.4, cap: 5.2, link: true },
  { D: 0.91, H: 98, req: 4.4, cap: 0.6, link: true },
  { D: 0.91, H: 98, req: 4.4, cap: 5.2, link: false },
  { D: 0.95, H: 25, req: 4.4, cap: 5.2, link: true },
].map((x) => ({ ...x, ...decide({ D: x.D, H: x.H, requiredMVA: x.req, eligibleCapacityMVA: x.cap, anyLinkAvailable: x.link }) }));
out.checks = {
  disturbance: { samples: N, min: r(dMin, 6), max: r(dMax, 6), nonFinite, monotonicityViolations_load: monoViolL, monotonicityViolations_temperature: monoViolT, extremes },
  health: { samples: N, min: r(hMin, 4), max: r(hMax, 4), curves: healthCurve },
  coordination: { samples: N, min: r(cMin, 4), max: r(cMax, 4), theoreticalBounds: 'upper bound w_c + w_h = 0.70 (full coverage, perfect health, no risk); no fixed lower bound because ρ grows with temperature, but any C < C_min = 0.20 is ineligible' },
  decisionTable,
};
console.log('\nchecks', JSON.stringify(out.checks, null, 1));

/* ---------------- worked examples (inputs taken from S2) ---------------- */
const ex = { id: 'T1', loadPercent: 118.5, tempC: 84.5, voltageKV: 10.67, currentA: 642 };
out.workedExample = {
  disturbance: { input: ex, result: disturbanceScore(ex) },
  normal: { input: { id: 'T1', loadPercent: 70, tempC: 66.1, voltageKV: 10.81, currentA: 374 }, result: disturbanceScore({ id: 'T1', loadPercent: 70, tempC: 66.1, voltageKV: 10.81, currentA: 374 }) },
  relief: { requiredMVA_at_118_5: r(requiredRelief('T1', 118.5), 3) },
  coordination: ['T2', 'T3', 'T4'].map((id) => coordinationScore({ id, loadPercent: { T2: 62, T3: 68, T4: 58 }[id]!, tempC: { T2: 61.5, T3: 65.7, T4: 58.6 }[id]!, D: 0, H: 100, linkAvailable: true }, requiredRelief('T1', 118.5))),
  health: (() => { const h = { W: 120, S: 30, N: 1 }; return { input: h, H: r(healthValue(h), 3) }; })(),
};
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('\nworked', JSON.stringify(out.workedExample, null, 1));
