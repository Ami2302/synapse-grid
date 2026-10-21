import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Zap, Undo2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip } from 'recharts';
import { GridTwinController, IDS, LINKS, linkKey, type TwinSnapshot, type Phase } from '../twin/gridTwinController';
import { GridTwin3D, STATE_COLOR } from './GridTwin3D';
import { ALL_PARAMETER_GROUPS, DECISION, REFERENCES, DISTURBANCE as PA, HEALTH as PB, COORDINATION as PC } from '../model/synapseModelParams';
import { useModelRegistry } from '../ml/modelRegistry';

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const STAGES: Array<{ key: string; label: string }> = [
  { key: 'NORMAL', label: 'Normal' },
  { key: 'DETECTED', label: 'Fault detected' },
  { key: 'ALERTING', label: 'Alert broadcast' },
  { key: 'NEGOTIATING', label: 'Capacity offers' },
  { key: 'TRANSFERRING', label: 'Load transfer' },
  { key: 'RECOVERING', label: 'Recovering' },
  { key: 'RESULT', label: 'Result' },
];
const stageIndex = (p: Phase | null) =>
  !p ? 0 : p === 'RECOVERED' || p === 'ISOLATED' ? 6 : Math.max(0, STAGES.findIndex((s) => s.key === p));

const ACTION_COLOR: Record<string, string> = {
  NORMAL_OPERATION: '#5E9C76', WARNING_MODE: '#D6A84F', REDISTRIBUTE_LOAD: '#E3B341',
  FLAG_ISOLATION: '#C0504D', RECOVERY_MODE: '#5B8DB8', RECOVERED: '#5E9C76',
};

export const GridTwinPage: React.FC = () => {
  const ctrl = useRef<GridTwinController | null>(null);
  if (!ctrl.current) ctrl.current = new GridTwinController();
  const [snap, setSnap] = useState<TwinSnapshot>(() => ctrl.current!.snapshot());
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState('T1');
  const [target, setTarget] = useState('T1');
  const [level, setLevel] = useState(118);
  const [tab, setTab] = useState<'telemetry' | 'model'>('telemetry');
  const [hist, setHist] = useState<Record<string, Array<{ t: number; L: number; T: number; D: number }>>>({});
  const acc = useRef(0);
  useModelRegistry(); // re-render when the hybrid model is trained (agents then show predictions)

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const c = ctrl.current!;
      const eff = c.coordinationActive ? 1 : speed; // coordination stages always play in real time
      acc.current += eff / 4;
      let n = 0;
      while (acc.current >= 1 && n < 60) { c.step(); acc.current -= 1; n++; }
      if (n > 0) {
        const s = c.snapshot();
        setSnap(s);
        setHist((h) => {
          const out: typeof h = {};
          for (const id of IDS) {
            const u = s.units[id];
            out[id] = [...(h[id] ?? []), { t: s.t, L: u.state.loadPercent, T: u.state.transformerTemperatureC, D: u.dist.D }].slice(-180);
          }
          return out;
        });
      }
    }, 250);
    return () => clearInterval(iv);
  }, [running, speed]);

  const refresh = () => setSnap(ctrl.current!.snapshot());
  const onReset = () => { ctrl.current!.reset(); setHist({}); acc.current = 0; refresh(); };
  const onDisturb = () => { ctrl.current!.injectDisturbance(target, level); setSelected(target); setRunning(true); refresh(); };
  const onRestore = () => { ctrl.current!.restoreNormal(); refresh(); };
  const toggleLink = (a: string, b: string) => { const k = linkKey(a, b); ctrl.current!.setLink(a, b, !(snap.links[k] !== false)); refresh(); };

  const ev = snap.event;
  const st = stageIndex(ev?.phase ?? null);
  const clock = `${String(Math.floor(snap.t / 60)).padStart(2, '0')}:${String(snap.t % 60).padStart(2, '0')}`;
  const networkState = ev && !['RECOVERED', 'ISOLATED'].includes(ev.phase) ? (ev.phase === 'RECOVERING' ? 'RECOVERING' : 'DISTURBED')
    : IDS.some((id) => snap.units[id].dist.D >= DECISION.dWarn.value) ? 'WARNING' : 'HEALTHY';
  const netColor = { HEALTHY: '#5E9C76', WARNING: '#D6A84F', DISTURBED: '#C0504D', RECOVERING: '#5B8DB8' }[networkState];

  return (
    <div className="h-full flex flex-col gap-2 p-2 min-h-0 text-slate-200">
      {/* ---------------- control bar ---------------- */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#111827] border border-[#1f2a3a] rounded-lg px-2 py-1.5 text-xs">
        <button onClick={() => setRunning((r) => !r)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2636] hover:bg-[#25324a] border border-[#2a3547]">
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={onReset} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2636] hover:bg-[#25324a] border border-[#2a3547]"><RotateCcw size={13} /> Reset</button>
        <label className="flex items-center gap-1 text-slate-400">Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-[#0b0f14] border border-[#2a3547] rounded px-1 py-0.5 text-slate-200">
            {[1, 5, 20].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <span className="w-px h-5 bg-[#2a3547]" />
        <label className="flex items-center gap-1 text-slate-400">Disturb
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-[#0b0f14] border border-[#2a3547] rounded px-1 py-0.5 text-slate-200">
            {IDS.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-slate-400">to
          <input type="range" min={95} max={140} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-20 accent-[#C0504D]" />
          <span className="font-mono text-slate-200 w-10">{level} %</span>
        </label>
        <button onClick={onDisturb} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#8f3a38] hover:bg-[#a54442] text-white font-semibold"><Zap size={13} /> Simulate disturbance</button>
        <button onClick={onRestore} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c2636] hover:bg-[#25324a] border border-[#2a3547]" title="Release transfers and return all units to base load"><Undo2 size={13} /> Restore</button>
        <span className="w-px h-5 bg-[#2a3547]" />
        <span className="text-slate-400" title="Click a link to simulate a communication failure">Comm links</span>
        {LINKS.map(([a, b]) => {
          const up = snap.links[linkKey(a, b)] !== false;
          return (
            <button key={linkKey(a, b)} onClick={() => toggleLink(a, b)} title={up ? 'Click to simulate a communication failure' : 'Click to restore the link'}
              className={`px-1.5 py-0.5 rounded font-mono border ${up ? 'border-[#2a3547] text-slate-300' : 'border-[#C0504D] text-[#E06666] line-through'}`}>
              {a.slice(1)}–{b.slice(1)}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 font-mono text-[11px]">
          <span style={{ color: netColor }}>● {networkState}</span>
          <span className="text-slate-400">t = {clock}</span>
        </div>
      </div>

      {/* ---------------- 3D + side panel ---------------- */}
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="relative flex-1 min-w-0 bg-[#0d131b] border border-[#1f2a3a] rounded-lg">
          <GridTwin3D snapshot={snap} selectedId={selected} onSelect={(id) => { setSelected(id); }} />
          <div className="absolute left-2 bottom-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-slate-400 bg-[#0d131b]/80 px-2 py-1 rounded pointer-events-none">
            {[['Normal', STATE_COLOR.NORMAL], ['Warning', STATE_COLOR.WARNING], ['Overload', STATE_COLOR.OVERLOAD], ['Recovering', STATE_COLOR.RECOVERY]].map(([n, c]) => <span key={n}><span style={{ color: c }}>●</span> {n}</span>)}
            <span><span style={{ color: '#E06666' }}>●</span> alert</span><span><span style={{ color: '#6FA8DC' }}>●</span> offer</span><span><span style={{ color: '#E3B341' }}>●</span> power transfer</span><span><span style={{ color: '#7CC48F' }}>●</span> confirm</span>
            <span className="text-slate-500">· drag to rotate · scroll to zoom · click a transformer</span>
          </div>
        </div>

        <aside className="w-[380px] shrink-0 flex flex-col min-h-0 bg-[#111827] border border-[#1f2a3a] rounded-lg">
          <div className="flex items-center gap-1 p-2 border-b border-[#1f2a3a]">
            {IDS.map((id) => {
              const c = snap.units[id].isolated ? '#8A8F98' : STATE_COLOR[snap.units[id].state.operatingState] ?? '#5E9C76';
              return (
                <button key={id} onClick={() => setSelected(id)} className={`flex-1 py-1 rounded font-mono text-xs border ${selected === id ? 'bg-[#1c2636] border-[#5B7C99] text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                  <span style={{ color: c }}>●</span> {id}
                </button>
              );
            })}
          </div>
          <div className="flex text-xs border-b border-[#1f2a3a]">
            {(['telemetry', 'model'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 font-semibold ${tab === k ? 'text-white border-b-2 border-[#5B7C99]' : 'text-slate-400'}`}>
                {k === 'telemetry' ? 'Telemetry' : 'Mathematical Model'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 text-xs space-y-3">
            {tab === 'telemetry' ? <Telemetry snap={snap} id={selected} hist={hist[selected] ?? []} /> : <ModelPanel snap={snap} id={selected} />}
          </div>
        </aside>
      </div>

      {/* ---------------- stage strip + event log ---------------- */}
      <div className="h-[172px] shrink-0 flex gap-2 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col bg-[#111827] border border-[#1f2a3a] rounded-lg">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1f2a3a] text-[11px]">
            {STAGES.map((s, k) => {
              const done = ev && k < st, now = ev && k === st;
              const resultText = k === 6 && ev?.outcome ? (ev.outcome === 'RECOVERED' ? 'Recovered' : 'Isolated (sim.)') : s.label;
              const col = now ? (k === 6 ? (ev?.outcome === 'RECOVERED' ? '#5E9C76' : '#C0504D') : '#E3B341') : done ? '#5B8DB8' : '#4b5567';
              return (
                <React.Fragment key={s.key}>
                  <span className="px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ borderColor: col, color: now || done ? '#e7e9ed' : '#6b7587', background: now ? `${col}33` : 'transparent' }}>{resultText}</span>
                  {k < STAGES.length - 1 && <span className="text-slate-600">›</span>}
                </React.Fragment>
              );
            })}
            {ev && <span className="ml-auto font-mono text-slate-400">event: {ev.affected} · t+{snap.t - ev.startT}s</span>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto font-mono text-[11px] px-2 py-1 space-y-0.5">
            {snap.log.slice(0, 80).map((l) => (
              <div key={l.id} className="flex gap-2">
                <span className="text-slate-500 w-12 shrink-0">t={l.t}s</span>
                <span className="w-24 shrink-0" style={{ color: { info: '#6FA8DC', warn: '#D6A84F', crit: '#E06666', ok: '#7CC48F' }[l.level] }}>{l.stage}</span>
                <span className="text-slate-300">{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================= Telemetry panel ================= */
const Row: React.FC<{ k: string; v: React.ReactNode; c?: string }> = ({ k, v, c }) => (
  <div className="flex justify-between py-0.5 border-b border-[#1a2332]"><span className="text-slate-400">{k}</span><span className="font-mono" style={{ color: c ?? '#e7e9ed' }}>{v}</span></div>
);

const Telemetry: React.FC<{ snap: TwinSnapshot; id: string; hist: Array<{ t: number; L: number; T: number; D: number }> }> = ({ snap, id, hist }) => {
  const u = snap.units[id]; const s = u.state; const r = REFERENCES[id];
  const col = u.isolated ? '#8A8F98' : STATE_COLOR[s.operatingState];
  return (
    <>
      <div className="flex items-center justify-between">
        <div><div className="text-sm font-bold text-white">{id} · {r.ratedMVA} MVA</div><div className="text-slate-400">{r.coolingType} · 11/0.415 kV · ambient {r.ambientC} °C</div></div>
        <span className="px-2 py-0.5 rounded font-mono font-semibold" style={{ color: col, border: `1px solid ${col}` }}>{u.isolated ? 'ISOLATED (SIM)' : s.operatingState.replace('_', ' ')}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <Row k="Load" v={`${fmt(s.loadPercent)} %`} />
          <Row k="Temperature" v={`${fmt(s.transformerTemperatureC)} °C`} />
          <Row k="Voltage" v={`${fmt(s.voltageKV, 3)} kV`} />
          <Row k="Current" v={`${fmt(s.currentA, 0)} A`} />
        </div>
        <div>
          <Row k="Active power" v={`${fmt(s.powerKW / 1000, 2)} MW`} />
          <Row k="Power factor" v={fmt(s.powerFactor, 3)} />
          <Row k="Ageing index" v={`${fmt(s.healthIndex)} %`} />
          <Row k="Load offset" v={`${u.offsetPercent >= 0 ? '+' : ''}${fmt(u.offsetPercent)} %`} />
        </div>
      </div>
      <div className="h-[92px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hist} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <XAxis dataKey="t" hide />
            <YAxis yAxisId="a" tick={{ fontSize: 9, fill: '#9299A8' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0d131b', border: '1px solid #2a3547', fontSize: 11 }} />
            <Line yAxisId="a" type="monotone" dataKey="L" name="Load %" stroke="#5B8DB8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line yAxisId="a" type="monotone" dataKey="T" name="θ °C" stroke="#C0504D" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-slate-500 -mt-2">Last 180 s · blue load %, red temperature °C</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Agent {id}</div>
        <Row k="Fuzzy risk score" v={`${fmt(u.agent.riskScore)} / 100`} />
        <Row k="Hybrid AI prediction" v={u.agent.predictedState ? `${u.agent.predictedState.replace('_', ' ')} (${fmt((u.agent.predictionConfidence ?? 0) * 100, 0)} %)` : 'train Hybrid model first'} c={u.agent.predictedState ? undefined : '#6b7587'} />
        <Row k="Disturbance score D" v={fmt(u.dist.D, 3)} c={u.dist.D >= DECISION.dAct.value ? '#E06666' : u.dist.D >= DECISION.dWarn.value ? '#D6A84F' : '#7CC48F'} />
        <Row k="Health score H" v={`${fmt(u.health.H)} / 100`} />
        <Row k="Self-healing action" v={u.action.replace(/_/g, ' ')} c={ACTION_COLOR[u.action]} />
      </div>
      <p className="text-[10px] text-slate-500">Simulated telemetry from the Synapse Grid physics twin (1 s steps). Not field measurements.</p>
    </>
  );
};

/* ================= Mathematical model panel ================= */
const Eq: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-mono text-[11px] text-slate-200 bg-[#0b0f14] border border-[#1f2a3a] rounded px-2 py-1.5 leading-relaxed">{children}</div>
);
const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="text-[11px] font-bold text-white uppercase tracking-wider mt-1">{children}</div>;

const ModelPanel: React.FC<{ snap: TwinSnapshot; id: string }> = ({ snap, id }) => {
  const u = snap.units[id]; const d = u.dist; const s = u.state; const r = REFERENCES[id]; const hs = u.health;
  const ev = snap.event;
  const scores = ev?.affected === id ? ev.scores : ev?.scores.filter((x) => x.id === id) ?? [];
  const params = useMemo(() => ALL_PARAMETER_GROUPS, []);
  return (
    <>
      <p className="text-[10px] text-slate-500">Proposed project-specific model. Coefficients are engineering choices documented in <span className="font-mono">src/model/synapseModelParams.ts</span>; verified in simulation only.</p>

      <H3>A · Disturbance score</H3>
      <Eq>D = 1 − e<sup>−E</sup>,  E = α·u<sub>L</sub>² + β·u<sub>T</sub>² + γ·u<sub>V</sub> + δ·u<sub>I</sub> + κ·u<sub>L</sub>·u<sub>T</sub></Eq>
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <Row k="L / L_safe" v={`${fmt(s.loadPercent)} / ${r.safeLoadPercent} %`} />
          <Row k="θ / T_safe" v={`${fmt(s.transformerTemperatureC)} / ${fmt(r.safeTempC)} °C`} />
          <Row k="V" v={`${fmt(s.voltageKV, 3)} kV`} />
          <Row k="I / I_r" v={`${fmt(s.currentA, 0)} / ${fmt(r.ratedCurrentA, 0)} A`} />
        </div>
        <div>
          <Row k={`α·u_L² (u_L ${fmt(d.uL, 2)})`} v={fmt(d.termL, 3)} />
          <Row k={`β·u_T² (u_T ${fmt(d.uT, 2)})`} v={fmt(d.termT, 3)} />
          <Row k={`γ·u_V + δ·u_I`} v={fmt(d.termV + d.termI, 3)} />
          <Row k={`κ·u_L·u_T`} v={fmt(d.termLT, 3)} />
        </div>
      </div>
      <Row k="E → D" v={`${fmt(d.E, 3)} → ${fmt(d.D, 3)}`} c={d.D >= DECISION.dAct.value ? '#E06666' : d.D >= DECISION.dWarn.value ? '#D6A84F' : '#7CC48F'} />
      <div className="text-[10px] text-slate-500">α={PA.alpha.value}, β={PA.beta.value}, γ={PA.gamma.value}, δ={PA.delta.value}, κ={PA.kappa.value}; u_L=(L−L_safe)⁺/(115−L_safe), u_T=(θ−T_safe)⁺/(105−T_safe)</div>

      <H3>B · Health score</H3>
      <Eq>H = 100·e<sup>−λ<sub>W</sub>W − ψN</sup>·[1 − ω(1 − e<sup>−λ<sub>S</sub>S</sup>)]<br />W += D·Δt (D &gt; D_warn),  S = S·2<sup>−Δt/t½</sup> + D²·Δt</Eq>
      <div className="grid grid-cols-2 gap-x-4">
        <Row k="W (exposure)" v={`${fmt(hs.W, 1)} s`} />
        <Row k="S (stress)" v={fmt(hs.S, 2)} />
        <Row k="N (events)" v={hs.N} />
        <Row k="H" v={`${fmt(hs.H, 2)} / 100`} />
      </div>
      <div className="text-[10px] text-slate-500">λ_W=1/{fmt(1 / PB.lambdaW.value, 0)} s⁻¹, ψ={PB.psi.value}, ω={PB.omega.value}, λ_S=1/{fmt(1 / PB.lambdaS.value, 0)}, t½={PB.halfLife.value} s</div>

      <H3>C · Coordination score</H3>
      <Eq>C<sub>ij</sub> = A<sub>ij</sub>·𝟙[H<sub>j</sub>≥H<sub>min</sub>]·(w<sub>c</sub>c<sub>j</sub> + w<sub>h</sub>H<sub>j</sub>/100 − w<sub>r</sub>ρ<sub>j</sub> − w<sub>d</sub>D<sub>j</sub>)<br />c<sub>j</sub>=min(1, Cap<sub>j</sub>/ΔS), ρ<sub>j</sub>=max((L′<sub>j</sub>/L<sub>safe,j</sub>)<sup>η</sup>, u<sub>T,j</sub>)</Eq>
      {ev && scores.length > 0 ? (
        <div>
          <div className="text-[10px] text-slate-400 mb-1">Event on {ev.affected}: ΔS required = {fmt(ev.requiredMVA, 2)} MVA</div>
          <table className="w-full font-mono text-[10.5px]">
            <thead><tr className="text-slate-500"><th className="text-left">j</th><th>A</th><th>Cap</th><th>c</th><th>ρ</th><th>C</th><th className="text-left">status</th></tr></thead>
            <tbody>
              {scores.map((x) => (
                <tr key={x.id} className="border-t border-[#1a2332]">
                  <td>{x.id}</td><td className="text-center">{x.A}</td><td className="text-center">{fmt(x.capMVA, 2)}</td><td className="text-center">{fmt(x.c, 2)}</td><td className="text-center">{fmt(x.rho, 2)}</td>
                  <td className="text-center" style={{ color: x.eligible ? '#7CC48F' : '#9299a8' }}>{fmt(x.score, 2)}</td>
                  <td className="text-left" style={{ color: x.eligible ? '#7CC48F' : '#D6A84F' }}>{x.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-slate-500">Computed when a disturbance needs relief. w_c={PC.wCapacity.value}, w_h={PC.wHealth.value}, w_r={PC.wRisk.value}, w_d={PC.wDisturb.value}, η={PC.riskExponent.value}, H_min={PC.minHealth.value}, C_min={PC.minScore.value}.</div>
      )}

      <H3>D · Decision</H3>
      <Eq>D&lt;{DECISION.dWarn.value} normal · D&lt;{DECISION.dAct.value} warning · else redistribute if links up and coverage ≥ {DECISION.minCoverage.value * 100}% · otherwise flag isolation (simulated) · recovered after D&lt;{DECISION.dRecover.value} for {DECISION.confirmSteps.value} s</Eq>
      <Row k="Action" v={u.action.replace(/_/g, ' ')} c={ACTION_COLOR[u.action]} />
      {ev?.affected === id && ev.decision && <div className="text-slate-400">Decision: {ev.decision.reason}</div>}

      {ev?.affected === id && (
        <>
          <H3>Recovery result</H3>
          <Row k="Outcome" v={ev.outcome ?? 'in progress'} c={ev.outcome === 'RECOVERED' ? '#7CC48F' : ev.outcome === 'ISOLATED' ? '#E06666' : '#D6A84F'} />
          {ev.recoveredAt !== undefined && <Row k="Time to recovery" v={`${ev.recoveredAt - ev.startT} s`} />}
          {ev.transfers.map((tr) => <Row key={tr.from} k={`Transfer ${tr.from} → ${tr.to}`} v={`${fmt(tr.mva, 2)} MVA`} c="#E3B341" />)}
          {ev.before && (
            <table className="w-full font-mono text-[10.5px] mt-1">
              <thead><tr className="text-slate-500"><th className="text-left">unit</th><th>L before→after</th><th>θ before→after</th><th>D before→after</th></tr></thead>
              <tbody>
                {IDS.map((k) => {
                  const b = ev.before![k]; const a = ev.after?.[k] ?? { L: snap.units[k].state.loadPercent, T: snap.units[k].state.transformerTemperatureC, D: snap.units[k].dist.D };
                  return <tr key={k} className="border-t border-[#1a2332]"><td>{k}</td><td className="text-center">{fmt(b.L, 0)}→{fmt(a.L, 0)}</td><td className="text-center">{fmt(b.T)}→{fmt(a.T)}</td><td className="text-center">{fmt(b.D, 2)}→{fmt(a.D, 2)}</td></tr>;
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      <details className="mt-1">
        <summary className="cursor-pointer text-slate-400">All model parameters</summary>
        <div className="mt-1 space-y-2">
          {params.map((g) => (
            <div key={g.title}>
              <div className="text-[10px] text-slate-500 uppercase">{g.title}</div>
              {Object.values(g.params).map((p) => (
                <div key={g.title + p.symbol} className="flex justify-between border-b border-[#1a2332] py-0.5" title={`${p.purpose}\nWhy: ${p.rationale}\nEffect: ${p.effect}\nTuning: ${p.tuning}`}>
                  <span className="font-mono">{p.symbol}</span><span className="text-slate-400 truncate mx-2 flex-1 text-right">{p.purpose}</span><span className="font-mono">{Number(p.value.toPrecision(4))} {p.unit}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="text-[10px] text-slate-500">References per unit: {IDS.map((k) => `${k} L_safe ${REFERENCES[k].safeLoadPercent} %, T_safe ${REFERENCES[k].safeTempC} °C`).join(' · ')}</div>
        </div>
      </details>
    </>
  );
};
