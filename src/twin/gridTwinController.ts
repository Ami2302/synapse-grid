/**
 * Grid twin controller — runs the four-transformer Digital Twin, the multi-agent layer,
 * the project-specific model (src/model) and the self-healing sequence step by step.
 * Pure TypeScript (no React) so the website and the validation script share one implementation.
 */
import { PhysicsSimulationEngine } from '../simulation/physicsEngine';
import { DEFAULT_TRANSFORMERS, DEFAULT_SCENARIO_CONFIGS } from '../simulation/initialData';
import type { TransformerState, ScenarioConfig } from '../simulation/types';
import { MultiAgentEngine } from '../mas/agentEngine';
import { SelfHealingEngine } from '../mas/selfHealingEngine';
import type { TransformerAgentState } from '../mas/types';
import {
  disturbanceScore, updateHealth, initialHealth, coordinationScore, decide, requiredRelief, healthValue,
  type DisturbanceBreakdown, type HealthState, type CoordinationScore, type SelfHealingAction,
} from '../model/synapseModel';
import { DECISION, REFERENCES, supporterLimit, reliefTarget } from '../model/synapseModelParams';

export const IDS = ['T1', 'T2', 'T3', 'T4'] as const;
export type TId = (typeof IDS)[number];
export const LINKS: Array<[TId, TId]> = [['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T1'], ['T1', 'T3'], ['T2', 'T4']];
export const linkKey = (a: string, b: string) => [a, b].sort().join('-');

/** Base loads for the twin demo: all four units start in normal operation with different headroom. */
export const BASE_LOAD: Record<TId, number> = { T1: 70, T2: 62, T3: 68, T4: 58 };

export type Phase = 'NORMAL' | 'DETECTED' | 'ALERTING' | 'NEGOTIATING' | 'TRANSFERRING' | 'RECOVERING' | 'RECOVERED' | 'ISOLATED';

export interface CommEvent {
  id: number;
  t: number;
  from: string;
  to: string;
  kind: 'alert' | 'offer' | 'decline' | 'transfer' | 'confirm' | 'blocked';
  label?: string;
}
export interface LogEntry {
  id: number;
  t: number;
  stage: 'DISTURBANCE' | 'DETECTION' | 'COMMUNICATION' | 'COORDINATION' | 'DECISION' | 'ACTION' | 'RECOVERY' | 'SYSTEM';
  unit: string;
  text: string;
  level: 'info' | 'warn' | 'crit' | 'ok';
}
export interface ActiveTransfer { from: string; to: string; mva: number }

export interface UnitSnapshot {
  id: string;
  state: TransformerState;
  agent: TransformerAgentState;
  dist: DisturbanceBreakdown;
  health: HealthState;
  action: SelfHealingAction;
  actionReason: string;
  offsetPercent: number;
  isolated: boolean;
}

export interface EventRecord {
  affected: string;
  startT: number;
  phase: Phase;
  requiredMVA: number;
  scores: CoordinationScore[];
  decision?: { action: SelfHealingAction; reason: string };
  transfers: ActiveTransfer[];
  before?: Record<string, { L: number; T: number; D: number }>;
  after?: Record<string, { L: number; T: number; D: number }>;
  recoveredAt?: number;
  outcome?: 'RECOVERED' | 'ISOLATED' | 'IN_PROGRESS';
  confirmCount: number;
  overCount: number;
  phaseT: number;
}

export interface TwinSnapshot {
  t: number;
  units: Record<string, UnitSnapshot>;
  links: Record<string, boolean>;
  transfers: ActiveTransfer[];
  event: EventRecord | null;
  log: LogEntry[];
  comm: CommEvent[];
}

export class GridTwinController {
  private physics: PhysicsSimulationEngine;
  private mas: MultiAgentEngine;
  private scenario: ScenarioConfig = DEFAULT_SCENARIO_CONFIGS.NORMAL_OPERATION;
  private states: Record<string, TransformerState> = {};
  private offsets: Record<string, number> = {};
  private health: Record<string, HealthState> = {};
  private dist: Record<string, DisturbanceBreakdown> = {};
  private actions: Record<string, { action: SelfHealingAction; reason: string }> = {};
  private isolated: Record<string, boolean> = {};
  private kStep = 0;
  public t = 0;
  public links: Record<string, boolean> = {};
  public transfers: ActiveTransfer[] = [];
  public event: EventRecord | null = null;
  public log: LogEntry[] = [];
  public comm: CommEvent[] = [];
  private seq = 0;

  constructor(private seed = 42, private preRollSteps = 900) {
    this.physics = new PhysicsSimulationEngine(seed);
    this.mas = new MultiAgentEngine(DEFAULT_TRANSFORMERS, {});
    this.reset();
  }

  reset() {
    this.physics.setSeed(this.seed);
    this.mas.clearMessages();
    this.kStep = 0; this.t = 0; // seq stays monotonic so the 3D view never mistakes new events for old ones
    this.states = {}; this.transfers = []; this.event = null; this.log = []; this.comm = [];
    for (const id of IDS) {
      this.offsets[id] = BASE_LOAD[id] - this.scenario.initialLoadPercent;
      this.health[id] = initialHealth();
      this.isolated[id] = false;
      this.actions[id] = { action: 'NORMAL_OPERATION', reason: '' };
    }
    for (const [a, b] of LINKS) this.links[linkKey(a, b)] = true;
    // pre-roll so temperatures start near their steady state (not shown, not logged)
    for (let i = 0; i < this.preRollSteps; i++) this.physicsStep();
    for (const id of IDS) this.health[id] = initialHealth();
    this.t = 0;
    this.evaluate(false);
    this.addLog('SYSTEM', 'ALL', 'Twin initialised: T1–T4 in normal operation, all 6 communication links up.', 'info');
  }

  /* ---------------- user actions ---------------- */
  injectDisturbance(id: string, targetLoadPercent: number) {
    const current = this.states[id].loadPercent;
    const add = targetLoadPercent - current;
    this.offsets[id] += add;
    this.isolated[id] = false;
    this.addLog('DISTURBANCE', id, `Load disturbance on ${id}: +${add.toFixed(1)} % (target ≈ ${targetLoadPercent} %). Simulated, not a physical event.`, 'crit');
  }

  setLink(a: string, b: string, up: boolean) {
    this.links[linkKey(a, b)] = up;
    this.addLog('COMMUNICATION', `${a}-${b}`, `Communication link ${a}–${b} ${up ? 'restored' : 'FAILED (simulated)'}.`, up ? 'ok' : 'warn');
  }

  /* ---------------- simulation ---------------- */
  private physicsStep() {
    this.kStep += 1;
    for (const id of IDS) {
      this.states[id] = this.physics.step(this.kStep, DEFAULT_TRANSFORMERS[id], this.scenario, this.states[id] ?? null, 'GRID-TWIN', this.offsets[id]);
    }
  }

  step() {
    this.physicsStep();
    this.t += 1;
    this.evaluate(true);
  }

  private evaluate(advanceHealth: boolean) {
    this.mas.updateAgents(DEFAULT_TRANSFORMERS, this.states);
    for (const id of IDS) {
      const s = this.states[id];
      this.dist[id] = disturbanceScore({ id, loadPercent: s.loadPercent, tempC: s.transformerTemperatureC, voltageKV: s.voltageKV, currentA: s.currentA });
      if (advanceHealth) this.health[id] = updateHealth(this.health[id], this.dist[id].D, 1);
    }
    this.runSelfHealing();
  }

  private linkUp(a: string, b: string) { return this.links[linkKey(a, b)] !== false; }

  private scoresFor(affected: string, requiredMVA: number): CoordinationScore[] {
    return IDS.filter((j) => j !== affected).map((j) => {
      const s = this.states[j];
      return coordinationScore(
        { id: j, loadPercent: s.loadPercent, tempC: s.transformerTemperatureC, D: this.dist[j].D, H: this.health[j].H, linkAvailable: this.linkUp(affected, j) && !this.isolated[j] },
        requiredMVA
      );
    }).sort((a, b) => b.score - a.score);
  }

  private runSelfHealing() {
    const lat = DECISION.commLatencySteps.value;
    // per-unit local decision (shown in the panel even without an event)
    for (const id of IDS) {
      if (this.event && this.event.affected === id) continue;
      const d = this.dist[id].D;
      const req = requiredRelief(id, this.states[id].loadPercent);
      const scores = this.scoresFor(id, req);
      const eligibleCap = scores.filter((x) => x.eligible).reduce((a, x) => a + x.capMVA, 0);
      this.actions[id] = decide({ D: d, H: this.health[id].H, requiredMVA: req, eligibleCapacityMVA: eligibleCap, anyLinkAvailable: scores.some((x) => x.A > 0) });
      if (this.isolated[id]) this.actions[id] = { action: 'FLAG_ISOLATION', reason: 'flagged earlier (simulated)' };
    }

    // start a new event when a unit's decision calls for coordinated action
    if (!this.event) {
      const cand = IDS.filter((id) => !this.isolated[id] && this.dist[id].D >= DECISION.dAct.value)
        .sort((a, b) => this.dist[b].D - this.dist[a].D)[0];
      if (cand) {
        this.event = {
          affected: cand, startT: this.t, phase: 'DETECTED', requiredMVA: requiredRelief(cand, this.states[cand].loadPercent),
          scores: [], transfers: [], confirmCount: 0, overCount: 0, phaseT: this.t,
          before: this.snapshotLTD(),
        };
        const b = this.dist[cand];
        this.actions[cand] = { action: 'WARNING_MODE', reason: 'disturbance detected, coordinating' };
        this.addLog('DETECTION', cand, `${cand} disturbance score D = ${b.D.toFixed(2)} ≥ D_act (${DECISION.dAct.value}); L = ${this.states[cand].loadPercent.toFixed(1)} %, θ = ${this.states[cand].transformerTemperatureC.toFixed(1)} °C.`, 'crit');
      }
      return;
    }

    const ev = this.event;
    const i = ev.affected;
    const since = this.t - ev.phaseT;
    switch (ev.phase) {
      case 'DETECTED':
        if (since >= lat) {
          ev.phase = 'ALERTING'; ev.phaseT = this.t;
          for (const j of IDS) if (j !== i) {
            if (this.linkUp(i, j)) this.addComm(i, j, 'alert', `D=${this.dist[i].D.toFixed(2)}`);
            else this.addComm(i, j, 'blocked', 'link down');
          }
          const up = IDS.filter((j) => j !== i && this.linkUp(i, j));
          this.addLog('COMMUNICATION', i, `${i} broadcasts ALERT to ${up.join(', ') || 'nobody'}${up.length < 3 ? ` (${3 - up.length} link(s) down)` : ''}.`, 'warn');
        }
        break;
      case 'ALERTING':
        if (since >= lat) {
          ev.phase = 'NEGOTIATING'; ev.phaseT = this.t;
          ev.requiredMVA = requiredRelief(i, this.states[i].loadPercent);
          ev.scores = this.scoresFor(i, ev.requiredMVA);
          for (const sc of ev.scores) {
            if (sc.A === 0) continue;
            this.addComm(sc.id, i, sc.eligible ? 'offer' : 'decline', sc.eligible ? `${sc.capMVA.toFixed(2)} MVA` : 'decline');
            this.addLog('COORDINATION', sc.id, `${sc.id} → ${i}: headroom ${sc.capMVA.toFixed(2)} MVA, H = ${this.health[sc.id].H.toFixed(1)}, ρ = ${sc.rho.toFixed(2)}, C = ${sc.score.toFixed(2)} (${sc.reason}).`, sc.eligible ? 'info' : 'warn');
          }
        }
        break;
      case 'NEGOTIATING':
        if (since >= lat) {
          const eligible = ev.scores.filter((x) => x.eligible);
          const cap = eligible.reduce((a, x) => a + x.capMVA, 0);
          const dec = decide({ D: this.dist[i].D, H: this.health[i].H, requiredMVA: ev.requiredMVA, eligibleCapacityMVA: cap, anyLinkAvailable: ev.scores.some((x) => x.A > 0) });
          ev.decision = dec; ev.phaseT = this.t;
          this.addLog('DECISION', i, `Decision for ${i}: ${dec.action.replace(/_/g, ' ')} — ${dec.reason}.`, dec.action === 'REDISTRIBUTE_LOAD' ? 'info' : 'crit');
          if (dec.action === 'REDISTRIBUTE_LOAD') this.executeTransfer(ev);
          else if (dec.action === 'FLAG_ISOLATION') this.flagIsolation(ev, dec.reason);
          else { ev.phase = 'RECOVERING'; }
        }
        break;
      case 'TRANSFERRING':
        if (since >= lat) {
          ev.phase = 'RECOVERING'; ev.phaseT = this.t;
          this.actions[i] = { action: 'RECOVERY_MODE', reason: 'transfer executed, waiting for D < D_rec' };
          for (const tr of ev.transfers) this.addComm(tr.from, i, 'confirm', 'executed');
          this.addLog('RECOVERY', i, `Transfer confirmed; ${i} enters recovery mode. Waiting for D < ${DECISION.dRecover.value} for ${DECISION.confirmSteps.value} s.`, 'info');
        }
        break;
      case 'RECOVERING': {
        const ok = this.dist[i].D < DECISION.dRecover.value && ev.transfers.every((tr) => this.dist[tr.from].D < DECISION.dWarn.value);
        ev.confirmCount = ok ? ev.confirmCount + 1 : 0;
        ev.overCount = this.dist[i].D >= DECISION.dAct.value ? ev.overCount + 1 : 0;
        this.actions[i] = { action: 'RECOVERY_MODE', reason: `D = ${this.dist[i].D.toFixed(2)}, θ = ${this.states[i].transformerTemperatureC.toFixed(1)} °C cooling` };
        if (ev.confirmCount >= DECISION.confirmSteps.value) {
          ev.phase = 'RECOVERED'; ev.recoveredAt = this.t; ev.outcome = 'RECOVERED'; ev.after = this.snapshotLTD();
          this.actions[i] = { action: 'RECOVERED', reason: `D < D_rec for ${DECISION.confirmSteps.value} s` };
          this.addLog('RECOVERY', i, `RECOVERED after ${this.t - ev.startT} s: L = ${this.states[i].loadPercent.toFixed(1)} %, θ = ${this.states[i].transformerTemperatureC.toFixed(1)} °C, D = ${this.dist[i].D.toFixed(2)}, H = ${this.health[i].H.toFixed(1)}.`, 'ok');
          for (const tr of ev.transfers) this.addComm(i, tr.from, 'confirm', 'recovered');
        } else if (ev.overCount >= DECISION.escalationSteps.value) {
          this.flagIsolation(ev, `D = ${this.dist[i].D.toFixed(2)} still ≥ D_act ${DECISION.escalationSteps.value} s after the transfer (insufficient relief)`);
        } else if (this.t - ev.phaseT > DECISION.maxRecoverySteps.value) {
          this.flagIsolation(ev, `not recovered within ${DECISION.maxRecoverySteps.value} s`);
        }
        break;
      }
      case 'RECOVERED':
      case 'ISOLATED':
        // keep the finished event on screen; a new disturbance starts a new one
        if (IDS.some((id) => !this.isolated[id] && this.dist[id].D >= DECISION.dAct.value)) {
          this.event = null;
        }
        break;
    }
  }

  private executeTransfer(ev: EventRecord) {
    const i = ev.affected;
    const order = ev.scores.filter((x) => x.eligible).map((x) => x.id);
    const agents = this.mas.getAgents();
    const res = SelfHealingEngine.executeSelfHealing(i, agents, this.mas, DEFAULT_TRANSFORMERS, {
      targetLoadPercent: reliefTarget(i),
      headroomLimitPercent: (id) => supporterLimit(id),
      rankSupporters: (c) => order.map((id) => c.find((x) => x.ag.transformerId === id)).filter((x): x is NonNullable<typeof x> => !!x),
    });
    ev.transfers = res.summary.transfers.map((tr) => ({ from: tr.supportId, to: i, mva: tr.mva }));
    // apply transfers to the twin in MVA (Eq. 14–15): each unit's own percentage
    for (const tr of ev.transfers) {
      this.offsets[i] -= (100 * tr.mva) / REFERENCES[i].ratedMVA;
      this.offsets[tr.from] += (100 * tr.mva) / REFERENCES[tr.from].ratedMVA;
      this.addComm(tr.from, i, 'transfer', `${tr.mva.toFixed(2)} MVA`);
      this.addLog('ACTION', tr.from, `Simulated load transfer: ${tr.mva.toFixed(2)} MVA of ${i}'s load moved to ${tr.from} (${i} −${((100 * tr.mva) / REFERENCES[i].ratedMVA).toFixed(1)} %, ${tr.from} +${((100 * tr.mva) / REFERENCES[tr.from].ratedMVA).toFixed(1)} %).`, 'info');
    }
    this.transfers = [...this.transfers, ...ev.transfers];
    this.health[i] = { ...this.health[i], N: this.health[i].N + 1 };
    this.health[i].H = healthValue(this.health[i]);
    const moved = ev.transfers.reduce((a, x) => a + x.mva, 0);
    if (moved + 1e-6 < ev.requiredMVA) this.addLog('ACTION', i, `Partial relief: ${moved.toFixed(2)} of ${ev.requiredMVA.toFixed(2)} MVA available from eligible supporters.`, 'warn');
    ev.phase = 'TRANSFERRING'; ev.phaseT = this.t;
  }

  private flagIsolation(ev: EventRecord, reason: string) {
    const i = ev.affected;
    this.isolated[i] = true;
    // simulated protective action: shed the load above the unit's safe limit (no physical switching)
    const shed = Math.max(0, this.states[i].loadPercent - reliefTarget(i));
    this.offsets[i] -= shed;
    ev.phase = 'ISOLATED'; ev.outcome = 'ISOLATED'; ev.after = this.snapshotLTD();
    this.actions[i] = { action: 'FLAG_ISOLATION', reason };
    this.addLog('ACTION', i, `${i} FLAGGED FOR ISOLATION (${reason}). Simulated load shedding of ${shed.toFixed(1)} %; no physical switch is operated.`, 'crit');
  }

  /** Clear the finished event and return the twin to base loading (transfers released). */
  restoreNormal() {
    for (const id of IDS) { this.offsets[id] = BASE_LOAD[id] - this.scenario.initialLoadPercent; this.isolated[id] = false; }
    this.transfers = []; this.event = null;
    this.addLog('SYSTEM', 'ALL', 'Operator restored base loading on all units; transfers released.', 'info');
  }

  private snapshotLTD() {
    return Object.fromEntries(IDS.map((id) => [id, { L: this.states[id].loadPercent, T: this.states[id].transformerTemperatureC, D: this.dist[id]?.D ?? 0 }]));
  }

  private addLog(stage: LogEntry['stage'], unit: string, text: string, level: LogEntry['level']) {
    this.log = [{ id: ++this.seq, t: this.t, stage, unit, text, level }, ...this.log].slice(0, 200);
  }
  private addComm(from: string, to: string, kind: CommEvent['kind'], label?: string) {
    this.comm = [...this.comm, { id: ++this.seq, t: this.t, from, to, kind, label }].slice(-60);
  }

  snapshot(): TwinSnapshot {
    const agents = this.mas.getAgents();
    const units: Record<string, UnitSnapshot> = {};
    for (const id of IDS) {
      units[id] = {
        id, state: this.states[id], agent: agents[id], dist: this.dist[id], health: this.health[id],
        action: this.event?.affected === id && this.event.decision && this.event.phase !== 'RECOVERING' && this.event.phase !== 'RECOVERED'
          ? this.event.decision.action : this.actions[id].action,
        actionReason: this.actions[id].reason,
        offsetPercent: this.offsets[id], isolated: this.isolated[id],
      };
    }
    return { t: this.t, units, links: { ...this.links }, transfers: [...this.transfers], event: this.event ? { ...this.event } : null, log: this.log, comm: this.comm };
  }

  get coordinationActive() {
    return !!this.event && ['DETECTED', 'ALERTING', 'NEGOTIATING', 'TRANSFERRING'].includes(this.event.phase);
  }
}
