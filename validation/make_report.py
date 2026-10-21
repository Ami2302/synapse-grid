# Builds docs/Synapse_Grid_Mathematical_Model.md (+ .docx via pandoc) from validation/results.json
import json, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
R = json.load(open(os.path.join(HERE, 'results.json')))
P = json.load(open(os.path.join(HERE, 'parameters.json')))
S = R['scenarios']; C = R['checks']; W = R['workedExample']; REF = R['references']
f = lambda x, d=2: f"{x:.{d}f}"
ids = ['T1', 'T2', 'T3', 'T4']
md = []
a = md.append

a("# Synapse Grid — Project-Specific Mathematical Model\n")
a("*Equations, parameters, worked examples and simulation validation for the four-transformer digital twin and its autonomous self-healing.*\n")
a("**Status of the model.** The equations below were developed for this project. Their coefficients are engineering choices, documented in `src/model/synapseModelParams.ts`. They have been verified **in simulation only**: bounds, numerical stability and plausible decisions inside the Synapse Grid twin. They are not fitted to, or validated against, measured transformer data. All switching actions are **simulated decisions**; no physical breaker is operated.\n")
a("The model sits on top of the existing project and does not replace anything. The physics twin, the fuzzy/ANN/RF/LSTM/hybrid models and the MVA-consistent transfer (paper Eq. 14–15) are unchanged. The new equations decide **when** to act, **who** helps and **when** recovery is confirmed.\n")

a("## 1. Transformer-specific references\n")
a("Each transformer gets its own operating references. The safe load follows the cooling class (ONAN 80 %, ONAF 85 %, OFAF 90 %), because forced cooling removes heat faster. The safe temperature is **derived**: it is the twin's own steady-state temperature at the safe load, $T_{safe,i}=\\theta_{a,i}+15+45\\,(L_{safe,i}/100)^{1.8}$. Supporters are planned up to $L_{lim,j}=\\min(L_{safe,j},85)-m_L$, and a relieved unit is brought back to $L_{tgt,i}=L_{safe,i}-m_L$, where $m_L = 5$ % is the twin's normal load swing.\n")
a("| Unit | Rating (MVA) | Cooling | Ambient (°C) | $L_{safe}$ (%) | $T_{safe}$ (°C) | $I_r$ (A) | $L_{lim}$ (%) | $L_{tgt}$ (%) |")
a("|---|---|---|---|---|---|---|---|---|")
for i in ids:
    r = REF[i]
    a(f"| {i} | {r['ratedMVA']} | {r['coolingType']} | {r['ambientC']} | {r['safeLoadPercent']} | {r['safeTempC']} | {r['ratedCurrentA']} | {r['supporterLimit']} | {r['reliefTarget']} |")
a("")

# ---------------- A
a("## 2. Equation A — Disturbance score\n")
a("$$E_i=\\alpha\\,u_{L,i}^2+\\beta\\,u_{T,i}^2+\\gamma\\,u_{V,i}+\\delta\\,u_{I,i}+\\kappa\\,u_{L,i}\\,u_{T,i},\\qquad D_i=1-e^{-E_i}$$\n")
a("$$u_{L,i}=\\frac{(L_i-L_{safe,i})^+}{L_{crit}-L_{safe,i}},\\quad u_{T,i}=\\frac{(T_i-T_{safe,i})^+}{T_{crit}-T_{safe,i}},\\quad u_{V,i}=\\left(\\frac{(|V_i-V_n|/V_n-d_V)^+}{\\varepsilon_V}\\right)^2,\\quad u_{I,i}=\\frac{\\left(\\frac{I_i/I_{r,i}}{L_i/100}-1-d_I\\right)^+}{\\sigma_I}$$\n")
a("**Why each term is included**\n")
a("- $u_L$ is the load excess above this transformer's safe loading, scaled so that $u_L=1$ at the twin's 115 % overload threshold. It is squared, so small excursions count little and large ones count a lot.")
a("- $u_T$ is the temperature excess above $T_{safe,i}$, scaled to $u_T=1$ at 105 °C. It carries the slow, cumulative part of the risk.")
a("- $u_V$ is the voltage deviation beyond a 3 % dead-band. The dead-band matters because the twin's normal 2.5 % load-dependent drop must not raise an alarm.")
a("- $u_I$ is a **current-consistency** term: current that the loading does not explain, such as current during a sag or a fault. It is not a second load term, because at normal operation the ratio is about 1.")
a("- The cross term $\\kappa u_L u_T$ adds extra risk only when a unit is both overloaded and hot.")
a("- $D=1-e^{-E}$ maps any non-negative $E$ into $[0,1)$. It is monotone and saturates for extreme inputs, which keeps it numerically stable.\n")
a("**Influence of the coefficients.** A larger α detects overload at lower loading. A larger β delays recovery confirmation until the unit has cooled. γ and δ set sensitivity to sags and fault currents. κ sets how much earlier a pre-heated unit escalates.\n")
wd = W['disturbance']; i0 = wd['input']; d0 = wd['result']
a("**Worked example 1 (overload, simulated input).** Take T1 at L = 118.5 %, T = 84.5 °C, V = 10.67 kV, I = 642 A. Its references are $L_{safe}=80$, $T_{safe}=73.11$ °C and $I_r=524.9$ A.\n")
a(f"- $u_L=(118.5-80)/(115-80)={f(d0['uL'],3)}$, so $\\alpha u_L^2=2\\times{f(d0['uL'],3)}^2={f(d0['termL'],3)}$")
a(f"- $u_T=(84.5-73.11)/(105-73.11)={f(d0['uT'],3)}$, so $\\beta u_T^2={f(d0['termT'],3)}$")
a(f"- $|V-V_n|/V_n=3.0\\,\\% \\le d_V$, so $u_V=0$. The current ratio is $(642/524.9)/1.185=1.03 < 1.05$, so $u_I=0$")
a(f"- $\\kappa u_L u_T=1.5\\times{f(d0['uL'],3)}\\times{f(d0['uT'],3)}={f(d0['termLT'],3)}$")
a(f"- $E={f(d0['E'],3)}$, so $D=1-e^{{-{f(d0['E'],3)}}}=\\mathbf{{{f(d0['D'],3)}}}$, which is above $D_{{act}}=0.45$ and triggers coordination.\n")
dn = W['normal']['result']
a(f"**Worked example 2 (normal).** T1 at 70 %, 66.1 °C, 10.81 kV, 374 A gives $u_L=u_T=u_V=u_I=0$, so $D={f(dn['D'],3)}$ (normal operation).\n")

# ---------------- B
a("## 3. Equation B — Health score\n")
a("$$H_i=100\\;e^{-\\lambda_W W_i-\\psi N_i}\\;\\Big[1-\\omega\\big(1-e^{-\\lambda_S S_i}\\big)\\Big]\\in[0,100]$$\n")
a("$$W_i\\leftarrow W_i+D_i\\,\\Delta t\\;\\mathbb{1}[D_i>D_{warn}],\\qquad S_i\\leftarrow S_i\\,2^{-\\Delta t/t_{1/2}}+D_i^2\\,\\Delta t$$\n")
a("- $W_i$ is the **accumulated abnormal operating time**, weighted by severity. It only grows, and it drives the permanent part of $H$.")
a("- $S_i$ is a **short-term stress memory** with a 300 s half-life. It lowers $H$ by at most ω = 40 % and is regained as the unit cools down.")
a("- $N_i$ is the **recovery history**: the number of events that needed coordinated relief. Each one leaves a permanent ψ = 2 % mark.\n")
a("**Behaviour.**")
a("- *Normal operation* (D < 0.15): W and N do not change, and S decays, so H rises towards its permanent cap.")
a("- *Overload*: W and S grow, so H falls.")
a("- *Recovery*: S decays, so H partly recovers. The permanent W and N part stays.\n")
a("| Constant D | H at 0 s | 600 s | 1200 s | 1800 s | 2400 s | 3000 s | 3600 s |")
a("|---|---|---|---|---|---|---|---|")
for cv in C['health']['curves']:
    a(f"| {cv['D']} | " + " | ".join(f(x, 1) for x in cv['H_every_600s']) + " |")
a("")
a(f"**Worked example 3.** $W=120$ s, $S=30$, $N=1$ gives $H=100\\,e^{{-120/1800-0.02}}\\,[1-0.4(1-e^{{-30/120}})]={f(W['health']['H'],2)}$.\n")

# ---------------- C
a("## 4. Equation C — Multi-agent coordination score\n")
a("$$C_{ij}=A_{ij}\\;\\mathbb{1}[H_j\\ge H_{min}]\\;\\big(w_c\\,c_j+w_h\\,H_j/100-w_r\\,\\rho_j-w_d\\,D_j\\big)$$\n")
a("$$c_j=\\min\\!\\Big(1,\\frac{Cap_j}{\\Delta S_i}\\Big),\\quad Cap_j=\\frac{S_j\\,(L_{lim,j}-L_j)^+}{100},\\quad \\rho_j=\\max\\!\\Big(\\big(L'_j/L_{safe,j}\\big)^{\\eta},\\,u_{T,j}\\Big),\\quad L'_j=L_j+\\frac{100\\min(Cap_j,\\Delta S_i)}{S_j}$$\n")
a("Each factor maps to one of the required considerations:")
a("- **Severity of the affected unit** sets the required relief $\\Delta S_i=S_i(L_i-L_{tgt,i})^+/100$.")
a("- **Available capacity** enters through $c_j$.")
a("- **Communication availability** is the factor $A_{ij}\\in\\{0,1\\}$. A failed link makes the supporter unreachable.")
a("- **Supporter health** enters through $H_j/100$ and the $H_{min}$ gate.")
a("- **Overload risk** is $\\rho_j$, which rises steeply ($\\eta=4$) as the planned post-transfer loading approaches the supporter's safe limit, or when the supporter is already hot.")
a("- A supporter that is itself disturbed is penalised by $w_d D_j$.\n")
a("Eligible supporters ($C_{ij}\\ge C_{min}=0.20$ and $Cap_j\\ge 0.05$ MVA) are ranked by $C_{ij}$. The relief is then allocated in that order with the existing MVA-consistent transfer (paper Eq. 14–15), so apparent power is conserved between units of different rating.\n")
a(f"**Worked example 4 (T1 at 118.5 %, all links up).** $\\Delta S_1=10\\,(118.5-75)/100={f(W['relief']['requiredMVA_at_118_5'],2)}$ MVA.\n")
a("| Supporter j | $L_j$ (%) | $Cap_j$ (MVA) | $c_j$ | $L'_j$ (%) | $\\rho_j$ | $C_{1j}$ | Status |")
a("|---|---|---|---|---|---|---|---|")
for x in W['coordination']:
    L0 = {'T2': 62, 'T3': 68, 'T4': 58}[x['id']]
    a(f"| {x['id']} | {L0} | {f(x['capMVA'])} | {f(x['c'])} | {f(x['Lafter'],1)} | {f(x['rho'])} | {f(x['score'])} | {x['reason']} |")
a("\nT4 has the most headroom at the lowest risk, so it is chosen first. T2 is second. T3 is excluded because its 7.5 MVA rating leaves little headroom below its limit.\n")

# ---------------- D
a("## 5. Equation D — Self-healing decision logic\n")
a("| Condition (evaluated in this order) | Action |")
a("|---|---|")
a("| $D_i<D_{warn}=0.15$ | Continue normal operation |")
a("| $D_{warn}\\le D_i<D_{act}=0.45$ | Warning mode (monitor, no transfer) |")
a("| $D_i\\ge D_{crit}=0.85$ and $H_i<H_{iso}=30$ | Flag for isolation (simulated) |")
a("| No communication link available | Flag for isolation (simulated) |")
a("| Eligible capacity ≥ ζ·ΔS ($\\zeta$ = 25 %) | Redistribute load (simulated transfer) |")
a("| Otherwise | Flag for isolation: simulated shedding of load above $L_{tgt,i}$ |")
a("| After a transfer: $D_i<D_{rec}=0.10$ for M = 10 s and every supporter $D_j<D_{warn}$ | Recovery confirmed |")
a("| After a transfer: $D_i\\ge D_{act}$ for $T_{esc}$ = 30 s | Escalate to isolation flag |\n")
a("Messages between stages take a simulated latency of τ_c = 2 s, so each stage (alert, offers, decision, transfer confirmation) shows up separately on the 3D model.\n")
a("**Decision-table check** (direct evaluation of the rule):\n")
a("| D | H | ΔS (MVA) | Eligible cap. (MVA) | Link | Action | Reason |")
a("|---|---|---|---|---|---|---|")
for d in C['decisionTable']:
    a(f"| {d['D']} | {d['H']} | {d['req']} | {d['cap']} | {'up' if d['link'] else 'down'} | {d['action'].replace('_',' ')} | {d['reason']} |")
a("")

# ---------------- G scenarios
a("## 6. Simulation validation\n")
a("All scenarios use the same controller as the website: seed 42, 900 s pre-roll to thermal steady state, 1 s steps. Base loads are T1 70 %, T2 62 %, T3 68 % and T4 58 % in the Normal-Operation profile (±5 % swing).\n")
a("| Scenario | Outcome | Detection delay (s) | Time to outcome (s) | Required (MVA) | Transfers | Max θ of affected unit (°C) |")
a("|---|---|---|---|---|---|---|")
for k, aff in [('S1', '-'), ('S2', 'T1'), ('S3a', 'T1'), ('S3b', 'T1'), ('S5', 'T3')]:
    s = S[k]
    tr = ', '.join(f"{t['from']}→{t['to']} {t['mva']:.2f}" for t in s['transfers']) or '—'
    mt = s['maxT'][aff] if aff != '-' else max(s['maxT'].values())
    a(f"| {s['name']} | {s['outcome']} | {s['detectionDelay'] if s['detectionDelay'] is not None else '—'} | {s['timeToOutcome'] if s['timeToOutcome'] is not None else '—'} | {s['requiredMVA']} | {tr} | {mt} |")
a("")
s2 = S['S2']
a("**S2 before and after (T1 overload to 118 %).**\n")
a("| Unit | L before → after (%) | θ before → after (°C) | D before → after | Final state | Final H |")
a("|---|---|---|---|---|---|")
for i in ids:
    b = s2['before'][i]; af = s2['after'][i]; fi = s2['final'][i]
    a(f"| {i} | {f(b['L'],1)} → {f(af['L'],1)} | {f(b['T'],1)} → {f(af['T'],1)} | {f(b['D'])} → {f(af['D'])} | {fi['state']} | {f(fi['H'],1)} |")
a("")
a("**Interpretation.**")
a(f"- *Normal (S1)*: across 600 s the largest disturbance score of any unit was {max(S['S1']['maxD'].values())}. There were no false alarms and no transfers.")
a("- *Overload (S2, S5)*: detection follows the disturbance by 1 s. The relief is split across two supporters in score order, recovery is confirmed 18 s after detection, and every unit ends in NORMAL. Temperatures barely rise because the twin's thermal time constants (180–300 s) are much longer than the coordination time (about 8 s).")
a("- *Communication failure (S3a)*: with T1–T2 and T1–T4 down, only T3 is reachable, and its headroom is too small (coverage 0 %). The rule flags T1 for isolation and sheds the excess load in simulation instead of overloading T3.")
a(f"- *Partial communication failure (S3b)*: with T1–T4 down, T2 alone covers 41 % of the need. The transfer goes ahead, T1 stays above $D_{{act}}$, and after $T_{{esc}}$ = 30 s it is escalated to the isolation flag. Total time is {S['S3b']['timeToOutcome']} s.")
a(f"- *Recovery (S4)*: after S2 the base load is restored. Over 600 s T1's health rises from {S['S4']['H_before']['T1']} to {S['S4']['H_after']['T1']} as the stress memory decays. The permanent part (W, N) remains.\n")
cd = C['disturbance']; ch = C['health']; cc = C['coordination']
a("**Bounds, stability and monotonicity** (randomised tests):\n")
a(f"- D over {cd['samples']:,} random inputs (L 0–250 %, T 0–250 °C, V 0–15 kV, I 0–5000 A): min {cd['min']}, max {cd['max']}, non-finite {cd['nonFinite']}. Increasing load or temperature never decreased D (load violations {cd['monotonicityViolations_load']}, temperature violations {cd['monotonicityViolations_temperature']}). Extreme inputs (zeros, 10⁶ values, negatives) give D = {cd['extremes']}.")
a(f"- H over {ch['samples']:,} random (W, S, N): min {ch['min']}, max {ch['max']}. H always stays within [0, 100] and decreases monotonically under constant D (table in Section 3).")
a(f"- $C_{{ij}}$ over {cc['samples']:,} random supporter states: min {cc['min']}, max {cc['max']}. {cc['theoreticalBounds']}.\n")

# ---------------- E parameters
a("## 7. Parameter configuration\n")
a("Every parameter is defined in `src/model/synapseModelParams.ts` with its purpose, value, reason, effect and tuning procedure. The table below is generated from that file.\n")
a("| Group | Symbol | Value | Unit | Purpose | Why this value | How to tune |")
a("|---|---|---|---|---|---|---|")
for g in P:
    for p in g['params']:
        v = p['value']; vs = f"{v:.6g}" if isinstance(v, float) else str(v)
        a(f"| {g['title']} | {p['symbol']} | {vs} | {p['unit']} | {p['purpose']} | {p['rationale']} | {p['tuning']} |")
a("")

# ---------------- web + limits
a("## 8. Where the model appears in the website\n")
a("Open **3D Grid Twin** and select T1–T4. The **Mathematical Model** tab shows, live for the selected unit:")
a("- the measured inputs and references")
a("- every term of $E$ and the resulting $D$")
a("- $W$, $S$, $N$ and $H$")
a("- during an event, the coordination table ($A$, $Cap$, $c$, $\\rho$, $C$, eligibility)")
a("- the decision with its reason")
a("- the recovery result with a before/after table\n")
a("The 3D scene shows the same events: red alert pulses, blue offers and grey declines, amber power-transfer streams with MVA labels, green confirmations, and a red **LINK DOWN** marker for failed links.\n")
a("## 9. Limitations\n")
a("- The coefficients are reasoned choices, not values fitted to field data. They should be re-tuned against measured transformer data before any real use.")
a("- The twin's network has no impedances or power-flow constraints. A transfer moves apparent power between units, assuming they are electrically tie-able and lossless.")
a("- Isolation and shedding are flags and simulated load changes. No physical switching exists in this project.")
a("- The health score is an operational indicator. It is not an IEC insulation-ageing estimate. The twin keeps its separate physics-based ageing index.\n")

open(os.path.join(ROOT, 'docs', 'Synapse_Grid_Mathematical_Model.md'), 'w').write('\n'.join(md))
subprocess.run(['pandoc', os.path.join(ROOT, 'docs', 'Synapse_Grid_Mathematical_Model.md'), '-o', os.path.join(ROOT, 'docs', 'Synapse_Grid_Mathematical_Model.docx')], check=True)
print('report written')
