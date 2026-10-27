/**
 * Algorithm graphs for the Soft Computing workspace:
 *  - FuzzyMembershipGraphs: input membership functions (load, temperature, voltage deviation)
 *    with the tester's current value marked, and the output (defuzzification) graph.
 *  - AnnNetworkDiagram: the 8-16-8-5 MLP drawn layer by layer (input, two hidden layers, output).
 *  - HybridSelectionGraphs: hybrid architecture, the validation-F1 map of every fusion-weight
 *    combination tried (how the weights are chosen), and the component comparison.
 * All curves are computed from the same functions the models use (FuzzyLogicEngine), not redrawn by hand.
 */
import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, BarChart, Bar, Cell, LabelList } from 'recharts';
import { FuzzyLogicEngine } from '../ml/fuzzyEngine';
import type { HybridTrainingResult } from '../ml/hybridEngine';
import { HYBRID_FEATURE_NAMES } from '../ml/hybridEngine';

const C = {
  steel: '#5B7C99', teal: '#4F8F8B', green: '#5E9C76', yellow: '#D6A84F', amber: '#C47A3A',
  red: '#B94A48', text: '#E7E9ED', muted: '#9299A8', border: '#2A3547', card: '#172033', bg: '#0B0F14',
};
const SET_COLORS = [C.green, C.steel, C.amber, C.red];
const axisProps = { stroke: C.muted, fontSize: 10, tickLine: false } as const;
const tooltipStyle = { contentStyle: { background: C.bg, border: `1px solid ${C.border}`, fontSize: 11 }, labelStyle: { color: C.text } };

const Panel: React.FC<{ title: string; note?: string; children: React.ReactNode; className?: string }> = ({ title, note, children, className }) => (
  <div className={`bg-grid-card p-4 rounded-xl border border-grid-border font-mono text-xs space-y-2 ${className || ''}`}>
    <div className="font-bold text-white uppercase border-b border-grid-border pb-2 flex items-center justify-between gap-2">
      <span>{title}</span>
      {note && <span className="text-grid-muted normal-case font-normal text-[10px]">{note}</span>}
    </div>
    {children}
  </div>
);

// ------------------------------------------------------------------ FUZZY
type MfFn = (x: number) => Record<string, number>;
function sample(fn: MfFn, lo: number, hi: number, step: number) {
  const rows: Array<Record<string, number>> = [];
  for (let x = lo; x <= hi + 1e-9; x += step) rows.push({ x: Number(x.toFixed(2)), ...fn(x) });
  return rows;
}
const MF_SPECS = [
  {
    key: 'load', title: 'Load utilisation (%)', unit: '%', lo: 0, hi: 160, step: 1,
    fn: (x: number) => FuzzyLogicEngine.fuzzifyLoad(x) as Record<string, number>,
    sets: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    defs: 'Low trap(−10,0,50,75) · Medium tri(60,78,92) · High tri(85,100,118) · Critical trap(110,125,200,300)',
  },
  {
    key: 'temp', title: 'Hot-spot temperature (°C)', unit: '°C', lo: 0, hi: 160, step: 1,
    fn: (x: number) => FuzzyLogicEngine.fuzzifyTemp(x) as Record<string, number>,
    sets: ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL'],
    defs: 'Normal trap(0,20,55,75) · Elevated tri(65,78,90) · High tri(82,95,108) · Critical trap(100,115,150,200)',
  },
  {
    key: 'volt', title: 'Voltage deviation |ΔV| (%)', unit: '%', lo: 0, hi: 30, step: 0.25,
    fn: (x: number) => FuzzyLogicEngine.fuzzifyVoltageDev(x) as Record<string, number>,
    sets: ['NORMAL', 'DEVIATED', 'SEVERE'],
    defs: 'Normal trap(0,0,2.5,5) · Deviated tri(3.5,8,15) · Severe trap(12,18,40,60)',
  },
] as const;

export const FuzzyMembershipGraphs: React.FC<{
  inputs: { load: number; temp: number; voltage: number };
  result: { riskScore: number; activeRuleFires: Array<{ rule: { consequent: string }; strength: number }> };
}> = ({ inputs, result }) => {
  const devPct = Math.abs(((inputs.voltage - 11) / 11) * 100);
  const current: Record<string, number> = { load: inputs.load, temp: inputs.temp, volt: Number(devPct.toFixed(2)) };

  // Output side: aggregated strength per consequent (Mamdani MAX) at the singleton centres used for the centroid
  const centres: Record<string, number> = { NORMAL: 20, WARNING: 50, HIGH_STRESS: 75, OVERLOAD: 95 };
  const strength: Record<string, number> = { NORMAL: 0, WARNING: 0, HIGH_STRESS: 0, OVERLOAD: 0 };
  result.activeRuleFires.forEach((f) => {
    if (f.rule.consequent in strength) strength[f.rule.consequent] = Math.max(strength[f.rule.consequent], f.strength);
  });
  const outRows = Object.keys(centres).map((k) => ({ name: k.replace('_', ' '), centre: centres[k], strength: Number(strength[k].toFixed(3)) }));

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-grid-muted font-mono">
        MEMBERSHIP FUNCTIONS — each curve is μ(x) from the engine itself; the white line is the tester's current input, so you can read
        the degree of membership of every set where it crosses.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {MF_SPECS.map((spec) => {
          const data = sample(spec.fn, spec.lo, spec.hi, spec.step);
          const x0 = current[spec.key];
          const mu = spec.fn(x0);
          return (
            <Panel key={spec.key} title={spec.title} note={`x = ${x0}${spec.unit}`}>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="x" type="number" domain={[spec.lo, spec.hi]} {...axisProps} />
                    <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} {...axisProps} />
                    <Tooltip {...tooltipStyle} formatter={(v: unknown) => Number(v).toFixed(2)} labelFormatter={(l) => `x = ${l}${spec.unit}`} />
                    {spec.sets.map((s, i) => (
                      <Line key={s} type="linear" dataKey={s} stroke={SET_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    ))}
                    <ReferenceLine x={x0} stroke={C.text} strokeWidth={1.5} strokeDasharray="4 3" />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconType="plainline" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {spec.sets.map((s, i) => (
                  <span key={s} style={{ color: SET_COLORS[i] }}>μ_{s.toLowerCase()} = <strong>{(mu[s] ?? 0).toFixed(2)}</strong></span>
                ))}
              </div>
              <div className="text-[10px] text-grid-muted">{spec.defs}</div>
            </Panel>
          );
        })}
      </div>
      <Panel title="Output — rule aggregation & centroid defuzzification" note={`risk = Σ cₖ·αₖ / Σ αₖ = ${result.riskScore}`}>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outRows} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => Number(v).toFixed(2)} />
              <Bar dataKey="strength" name="Aggregated rule strength α" isAnimationActive={false}>
                {outRows.map((_, i) => <Cell key={i} fill={[C.green, C.yellow, C.amber, C.red][i]} />)}
                <LabelList dataKey="strength" position="top" fill={C.text} fontSize={10} formatter={(v: unknown) => (Number(v) > 0 ? Number(v).toFixed(2) : '')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-grid-muted">
          Output centres c = 20 (Normal), 50 (Warning), 75 (High stress), 95 (Overload). Rule strength = MIN of its antecedents; each output keeps the MAX over its rules.
        </div>
      </Panel>
    </div>
  );
};

// ------------------------------------------------------------------ ANN
const ANN_INPUTS = ['load %', 'temperature', 'voltage', 'current', 'active power', 'power factor', 'ambient temp', 'health index'];
const ANN_OUTPUTS = ['Normal', 'Warning', 'High stress', 'Overload', 'Fault'];

export const NetworkDiagram: React.FC<{
  layers: number[];
  inputLabels: string[];
  outputLabels: string[];
  layerTitles: string[];
  height?: number;
  highlightInputsFrom?: number; // index from which input nodes are fuzzy features (hybrid)
}> = ({ layers, inputLabels, outputLabels, layerTitles, height = 360, highlightInputsFrom }) => {
  const W = 760, H = height, padX = 120, padTop = 34, padBottom = 18;
  const colX = layers.map((_, i) => padX + (i * (W - 2 * padX)) / (layers.length - 1));
  const nodeY = (n: number, j: number) => {
    const span = H - padTop - padBottom;
    const gap = Math.min(span / n, 26);
    const top = padTop + (span - gap * (n - 1)) / 2;
    return top + j * gap;
  };
  const r = (n: number) => (n > 14 ? 6 : 8);
  const nodeColor = (li: number, j: number) => {
    if (li === 0) return highlightInputsFrom !== undefined && j >= highlightInputsFrom ? C.amber : C.teal;
    if (li === layers.length - 1) return C.green;
    return C.steel;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto block" role="img" aria-label="Neural network architecture diagram">
      {/* connections */}
      {layers.slice(0, -1).map((n, li) =>
        Array.from({ length: n }).map((_, a) =>
          Array.from({ length: layers[li + 1] }).map((__, b) => (
            <line key={`${li}-${a}-${b}`} x1={colX[li]} y1={nodeY(n, a)} x2={colX[li + 1]} y2={nodeY(layers[li + 1], b)} stroke={C.steel} strokeOpacity={0.18} strokeWidth={0.7} />
          ))
        )
      )}
      {/* nodes */}
      {layers.map((n, li) =>
        Array.from({ length: n }).map((_, j) => (
          <circle key={`n${li}-${j}`} cx={colX[li]} cy={nodeY(n, j)} r={r(n)} fill={nodeColor(li, j)} stroke={C.bg} strokeWidth={1.5} />
        ))
      )}
      {/* labels */}
      {inputLabels.map((t, j) => (
        <text key={`in${j}`} x={colX[0] - 14} y={nodeY(layers[0], j) + 3.5} textAnchor="end" fontSize={11} fill={highlightInputsFrom !== undefined && j >= highlightInputsFrom ? C.amber : C.muted}>{t}</text>
      ))}
      {outputLabels.map((t, j) => (
        <text key={`out${j}`} x={colX[colX.length - 1] + 14} y={nodeY(layers[layers.length - 1], j) + 3.5} fontSize={11} fill={C.muted}>{t}</text>
      ))}
      {layerTitles.map((t, li) => (
        <text key={`t${li}`} x={colX[li]} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.text}>{t}</text>
      ))}
    </svg>
  );
};

export const AnnNetworkDiagram: React.FC = () => (
  <Panel title="ANN / MLP architecture — 8 → 16 → 8 → 5" note="every line is a trained weight">
    <NetworkDiagram
      layers={[8, 16, 8, 5]}
      inputLabels={ANN_INPUTS}
      outputLabels={ANN_OUTPUTS}
      layerTitles={['Input (8)', 'Hidden 1 (16, ReLU)', 'Hidden 2 (8, ReLU)', 'Output (5, softmax)']}
    />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-grid-muted">
      <div><strong className="text-white">Forward:</strong> h₁ = ReLU(W₁x + b₁), h₂ = ReLU(W₂h₁ + b₂), p = softmax(W₃h₂ + b₃)</div>
      <div><strong className="text-white">Loss:</strong> cross-entropy L = −log p<sub>true</sub>; trained by back-propagation with SGD</div>
      <div><strong className="text-white">Size:</strong> 8·16 + 16·8 + 8·5 = 296 weights + 29 biases = 325 parameters</div>
    </div>
  </Panel>
);

// ------------------------------------------------------------------ HYBRID
const flowBox = (x: number, y: number, w: number, h: number, title: string, sub: string, color: string, key: string) => (
  <g key={key}>
    <rect x={x} y={y} width={w} height={h} rx={6} fill={C.bg} stroke={color} strokeWidth={1.5} />
    <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={C.text}>{title}</text>
    <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fill={C.muted}>{sub}</text>
  </g>
);
const arrowLine = (x1: number, y1: number, x2: number, y2: number, key: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.muted} strokeWidth={1.4} markerEnd="url(#hyArrow)" />
);

const HybridFlow: React.FC<{ weights?: { ann: number; rf: number; fuzzy: number } }> = ({ weights }) => (
  <svg viewBox="0 0 760 250" className="w-full max-w-4xl mx-auto block" role="img" aria-label="Hybrid fuzzy-neural architecture">
    <defs>
      <marker id="hyArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={C.muted} /></marker>
    </defs>
    {flowBox(6, 100, 140, 50, '8 twin features', 'load, θ, V, I, P, pf…', C.teal, 'b1')}
    {flowBox(170, 20, 150, 50, 'Fuzzy inference', 'risk R + 4 strengths', C.amber, 'b2')}
    {flowBox(170, 100, 150, 50, '13 fused features', '8 scaled + 5 fuzzy', C.amber, 'b3')}
    {flowBox(370, 60, 140, 46, 'ANN 13-16-8-5', `weight w_A = ${weights ? weights.ann.toFixed(1) : '?'}`, C.steel, 'b4')}
    {flowBox(370, 140, 140, 46, 'Random Forest', `weight w_R = ${weights ? weights.rf.toFixed(1) : '?'}`, C.steel, 'b5')}
    {flowBox(370, 196, 140, 46, 'Fuzzy class prob.', `weight w_F = ${weights ? weights.fuzzy.toFixed(1) : '?'}`, C.amber, 'b6')}
    {flowBox(560, 100, 90, 50, 'Soft vote', 'Σ w·p', C.green, 'b7')}
    {flowBox(670, 100, 82, 50, 'State', '5 classes', C.green, 'b8')}
    {arrowLine(146, 125, 170, 45, 'a1')}
    {arrowLine(146, 125, 170, 125, 'a2')}
    {arrowLine(245, 70, 245, 100, 'a3')}
    {arrowLine(320, 125, 370, 83, 'a4')}
    {arrowLine(320, 125, 370, 163, 'a5')}
    {arrowLine(320, 45, 370, 210, 'a6')}
    {arrowLine(510, 83, 560, 118, 'a7')}
    {arrowLine(510, 163, 560, 132, 'a8')}
    {arrowLine(510, 219, 560, 145, 'a9')}
    {arrowLine(650, 125, 670, 125, 'a10')}
  </svg>
);

export const HybridSelectionGraphs: React.FC<{ result: HybridTrainingResult | null }> = ({ result }) => {
  const search = result?.weightSearch ?? [];
  const best = result?.weights;
  const f1s = search.map((s) => s.valF1);
  const lo = f1s.length ? Math.min(...f1s) : 0, hi = f1s.length ? Math.max(...f1s) : 100;
  const colorFor = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 1;
    // dark slate → teal → green
    const a = [28, 38, 54], b = [79, 143, 139], c = [125, 200, 140];
    const mix = (p: number[], q: number[], u: number) => p.map((pv, i) => Math.round(pv + (q[i] - pv) * u));
    const rgb = t < 0.6 ? mix(a, b, t / 0.6) : mix(b, c, (t - 0.6) / 0.4);
    return `rgb(${rgb.join(',')})`;
  };
  const cell = 34, ox = 70, oy = 18;
  const compRows = result
    ? [
        ...result.components.map((c) => ({ name: `${c.name} (${c.inputs === 'ENRICHED 13' ? '13 fused' : c.inputs === 'RAW 8' ? '8 raw' : 'rules'})`, f1: c.testF1, hybrid: false })),
        { name: 'Hybrid (soft vote)', f1: result.metrics.f1Score, hybrid: true },
      ]
    : [];

  return (
    <div className="space-y-3">
      <Panel title="Hybrid fuzzy–neural architecture" note="fuzzy knowledge enters as features AND as a voter">
        <HybridFlow weights={best} />
      </Panel>

      <Panel title="Fused ANN — 13 inputs (8 twin + 5 fuzzy) → 16 → 8 → 5" note="orange = fuzzy features">
        <NetworkDiagram
          layers={[13, 16, 8, 5]}
          inputLabels={[...ANN_INPUTS, ...HYBRID_FEATURE_NAMES.slice(8).map((n) => n.replace(/_/g, ' '))]}
          outputLabels={ANN_OUTPUTS}
          layerTitles={['Input (13)', 'Hidden 1 (16, ReLU)', 'Hidden 2 (8, ReLU)', 'Output (5, softmax)']}
          height={400}
          highlightInputsFrom={8}
        />
      </Panel>

      {!result ? (
        <div className="p-3 rounded-lg border border-dashed border-grid-border text-grid-muted font-mono text-xs">
          Run the hybrid model to see how the fusion weights are chosen (validation-F1 map) and how it compares with its components.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="How the weights are chosen — validation macro-F1" note={`${search.length} combinations, step 0.1`}>
            <svg viewBox={`0 0 ${ox + 11 * cell + 20} ${oy + 11 * cell + 46}`} className="w-full" role="img" aria-label="Validation F1 for every fusion weight combination">
              {search.map((s, k) => {
                const ia = Math.round(s.ann * 10), ir = Math.round(s.rf * 10);
                const x = ox + ia * cell, y = oy + (10 - ir) * cell;
                const isBest = best && Math.abs(best.ann - s.ann) < 1e-6 && Math.abs(best.rf - s.rf) < 1e-6;
                return (
                  <g key={k}>
                    <rect x={x} y={y} width={cell - 2} height={cell - 2} rx={3} fill={colorFor(s.valF1)} stroke={isBest ? '#FFFFFF' : 'none'} strokeWidth={isBest ? 2.5 : 0}>
                      <title>{`w_ANN=${s.ann.toFixed(1)}, w_RF=${s.rf.toFixed(1)}, w_F=${s.fuzzy.toFixed(1)} → val F1 ${s.valF1.toFixed(2)} %`}</title>
                    </rect>
                    <text x={x + (cell - 2) / 2} y={y + (cell - 2) / 2 + 3.5} textAnchor="middle" fontSize={8} fill={C.bg} fontWeight={isBest ? 800 : 500}>{s.valF1.toFixed(1)}</text>
                  </g>
                );
              })}
              {Array.from({ length: 11 }).map((_, i) => (
                <g key={`ax${i}`}>
                  <text x={ox + i * cell + (cell - 2) / 2} y={oy + 11 * cell + 12} textAnchor="middle" fontSize={9} fill={C.muted}>{(i / 10).toFixed(1)}</text>
                  <text x={ox - 6} y={oy + (10 - i) * cell + (cell - 2) / 2 + 3} textAnchor="end" fontSize={9} fill={C.muted}>{(i / 10).toFixed(1)}</text>
                </g>
              ))}
              <text x={ox + 5.5 * cell} y={oy + 11 * cell + 30} textAnchor="middle" fontSize={10.5} fill={C.text}>ANN weight w_A →</text>
              <text x={16} y={oy + 5.5 * cell} textAnchor="middle" fontSize={10.5} fill={C.text} transform={`rotate(-90 16 ${oy + 5.5 * cell})`}>RF weight w_R →</text>
              <text x={ox + 6 * cell} y={oy + 2 * cell} fontSize={10} fill={C.muted}>fuzzy weight</text>
              <text x={ox + 6 * cell} y={oy + 2 * cell + 13} fontSize={10} fill={C.muted}>w_F = 1 − w_A − w_R</text>
            </svg>
            <div className="text-[10px] text-grid-muted">
              Each square is one weight combination tried on the validation split (number = macro-F1 %). The white-outlined square is the one kept:
              <strong className="text-white"> w_A = {best!.ann.toFixed(1)}, w_R = {best!.rf.toFixed(1)}, w_F = {best!.fuzzy.toFixed(1)}</strong>, validation F1 {result.validationF1} %.
              The test split is never used for this choice.
            </div>
          </Panel>

          <Panel title="Why fuse — test macro-F1 of each part vs the hybrid" note="same test split">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compRows} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                  <Tooltip {...tooltipStyle} formatter={(v: unknown) => `${Number(v).toFixed(2)} %`} />
                  <Bar dataKey="f1" name="Test macro-F1 (%)" isAnimationActive={false}>
                    {compRows.map((r, i) => <Cell key={i} fill={r.hybrid ? C.green : r.name.includes('13 fused') ? C.amber : C.steel} />)}
                    <LabelList dataKey="f1" position="right" fill={C.text} fontSize={10} formatter={(v: unknown) => Number(v).toFixed(1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-grid-muted">
              Grey = 8 raw features, orange = 13 fused features, green = final hybrid. Adding the fuzzy features lifts both learners; the vote picks the best mix.
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};
