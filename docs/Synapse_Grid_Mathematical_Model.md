# Synapse Grid — Project-Specific Mathematical Model

*Equations, parameters, worked examples and simulation validation for the four-transformer digital twin and its autonomous self-healing.*

**Status of the model.** The equations below were developed for this project. Their coefficients are engineering choices, documented in `src/model/synapseModelParams.ts`. They have been verified **in simulation only**: bounds, numerical stability and plausible decisions inside the Synapse Grid twin. They are not fitted to, or validated against, measured transformer data. All switching actions are **simulated decisions**; no physical breaker is operated.

The model sits on top of the existing project and does not replace anything. The physics twin, the fuzzy/ANN/RF/LSTM/hybrid models and the MVA-consistent transfer (paper Eq. 14–15) are unchanged. The new equations decide **when** to act, **who** helps and **when** recovery is confirmed.

## 1. Transformer-specific references

Each transformer gets its own operating references. The safe load follows the cooling class (ONAN 80 %, ONAF 85 %, OFAF 90 %), because forced cooling removes heat faster. The safe temperature is **derived**: it is the twin's own steady-state temperature at the safe load, $T_{safe,i}=\theta_{a,i}+15+45\,(L_{safe,i}/100)^{1.8}$. Supporters are planned up to $L_{lim,j}=\min(L_{safe,j},85)-m_L$, and a relieved unit is brought back to $L_{tgt,i}=L_{safe,i}-m_L$, where $m_L = 5$ % is the twin's normal load swing.

| Unit | Rating (MVA) | Cooling | Ambient (°C) | $L_{safe}$ (%) | $T_{safe}$ (°C) | $I_r$ (A) | $L_{lim}$ (%) | $L_{tgt}$ (%) |
|---|---|---|---|---|---|---|---|---|
| T1 | 10 | ONAN | 28 | 80 | 73.11 | 524.9 | 75 | 75 |
| T2 | 12.5 | ONAF | 30 | 85 | 78.59 | 656.1 | 80 | 80 |
| T3 | 7.5 | ONAN | 32 | 80 | 77.11 | 393.6 | 75 | 75 |
| T4 | 15 | OFAF | 27 | 90 | 79.23 | 787.3 | 80 | 85 |

## 2. Equation A — Disturbance score

$$E_i=\alpha\,u_{L,i}^2+\beta\,u_{T,i}^2+\gamma\,u_{V,i}+\delta\,u_{I,i}+\kappa\,u_{L,i}\,u_{T,i},\qquad D_i=1-e^{-E_i}$$

$$u_{L,i}=\frac{(L_i-L_{safe,i})^+}{L_{crit}-L_{safe,i}},\quad u_{T,i}=\frac{(T_i-T_{safe,i})^+}{T_{crit}-T_{safe,i}},\quad u_{V,i}=\left(\frac{(|V_i-V_n|/V_n-d_V)^+}{\varepsilon_V}\right)^2,\quad u_{I,i}=\frac{\left(\frac{I_i/I_{r,i}}{L_i/100}-1-d_I\right)^+}{\sigma_I}$$

**Why each term is included**

- $u_L$ is the load excess above this transformer's safe loading, scaled so that $u_L=1$ at the twin's 115 % overload threshold. It is squared, so small excursions count little and large ones count a lot.
- $u_T$ is the temperature excess above $T_{safe,i}$, scaled to $u_T=1$ at 105 °C. It carries the slow, cumulative part of the risk.
- $u_V$ is the voltage deviation beyond a 3 % dead-band. The dead-band matters because the twin's normal 2.5 % load-dependent drop must not raise an alarm.
- $u_I$ is a **current-consistency** term: current that the loading does not explain, such as current during a sag or a fault. It is not a second load term, because at normal operation the ratio is about 1.
- The cross term $\kappa u_L u_T$ adds extra risk only when a unit is both overloaded and hot.
- $D=1-e^{-E}$ maps any non-negative $E$ into $[0,1)$. It is monotone and saturates for extreme inputs, which keeps it numerically stable.

**Influence of the coefficients.** A larger α detects overload at lower loading. A larger β delays recovery confirmation until the unit has cooled. γ and δ set sensitivity to sags and fault currents. κ sets how much earlier a pre-heated unit escalates.

**Worked example 1 (overload, simulated input).** Take T1 at L = 118.5 %, T = 84.5 °C, V = 10.67 kV, I = 642 A. Its references are $L_{safe}=80$, $T_{safe}=73.11$ °C and $I_r=524.9$ A.

- $u_L=(118.5-80)/(115-80)=1.100$, so $\alpha u_L^2=2\times1.100^2=2.420$
- $u_T=(84.5-73.11)/(105-73.11)=0.357$, so $\beta u_T^2=0.319$
- $|V-V_n|/V_n=3.0\,\% \le d_V$, so $u_V=0$. The current ratio is $(642/524.9)/1.185=1.03 < 1.05$, so $u_I=0$
- $\kappa u_L u_T=1.5\times1.100\times0.357=0.589$
- $E=3.328$, so $D=1-e^{-3.328}=\mathbf{0.964}$, which is above $D_{act}=0.45$ and triggers coordination.

**Worked example 2 (normal).** T1 at 70 %, 66.1 °C, 10.81 kV, 374 A gives $u_L=u_T=u_V=u_I=0$, so $D=0.000$ (normal operation).

## 3. Equation B — Health score

$$H_i=100\;e^{-\lambda_W W_i-\psi N_i}\;\Big[1-\omega\big(1-e^{-\lambda_S S_i}\big)\Big]\in[0,100]$$

$$W_i\leftarrow W_i+D_i\,\Delta t\;\mathbb{1}[D_i>D_{warn}],\qquad S_i\leftarrow S_i\,2^{-\Delta t/t_{1/2}}+D_i^2\,\Delta t$$

- $W_i$ is the **accumulated abnormal operating time**, weighted by severity. It only grows, and it drives the permanent part of $H$.
- $S_i$ is a **short-term stress memory** with a 300 s half-life. It lowers $H$ by at most ω = 40 % and is regained as the unit cools down.
- $N_i$ is the **recovery history**: the number of events that needed coordinated relief. Each one leaves a permanent ψ = 2 % mark.

**Behaviour.**
- *Normal operation* (D < 0.15): W and N do not change, and S decays, so H rises towards its permanent cap.
- *Overload*: W and S grow, so H falls.
- *Recovery*: S decays, so H partly recovers. The permanent W and N part stays.

| Constant D | H at 0 s | 600 s | 1200 s | 1800 s | 2400 s | 3000 s | 3600 s |
|---|---|---|---|---|---|---|---|
| 0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| 0.3 | 100.0 | 82.7 | 73.3 | 66.0 | 59.6 | 53.9 | 48.8 |
| 0.6 | 100.0 | 61.5 | 48.1 | 39.0 | 31.9 | 26.1 | 21.4 |
| 1 | 100.0 | 44.9 | 31.5 | 22.5 | 16.1 | 11.5 | 8.3 |

**Worked example 3.** $W=120$ s, $S=30$, $N=1$ gives $H=100\,e^{-120/1800-0.02}\,[1-0.4(1-e^{-30/120})]=83.58$.

## 4. Equation C — Multi-agent coordination score

$$C_{ij}=A_{ij}\;\mathbb{1}[H_j\ge H_{min}]\;\big(w_c\,c_j+w_h\,H_j/100-w_r\,\rho_j-w_d\,D_j\big)$$

$$c_j=\min\!\Big(1,\frac{Cap_j}{\Delta S_i}\Big),\quad Cap_j=\frac{S_j\,(L_{lim,j}-L_j)^+}{100},\quad \rho_j=\max\!\Big(\big(L'_j/L_{safe,j}\big)^{\eta},\,u_{T,j}\Big),\quad L'_j=L_j+\frac{100\min(Cap_j,\Delta S_i)}{S_j}$$

Each factor maps to one of the required considerations:
- **Severity of the affected unit** sets the required relief $\Delta S_i=S_i(L_i-L_{tgt,i})^+/100$.
- **Available capacity** enters through $c_j$.
- **Communication availability** is the factor $A_{ij}\in\{0,1\}$. A failed link makes the supporter unreachable.
- **Supporter health** enters through $H_j/100$ and the $H_{min}$ gate.
- **Overload risk** is $\rho_j$, which rises steeply ($\eta=4$) as the planned post-transfer loading approaches the supporter's safe limit, or when the supporter is already hot.
- A supporter that is itself disturbed is penalised by $w_d D_j$.

Eligible supporters ($C_{ij}\ge C_{min}=0.20$ and $Cap_j\ge 0.05$ MVA) are ranked by $C_{ij}$. The relief is then allocated in that order with the existing MVA-consistent transfer (paper Eq. 14–15), so apparent power is conserved between units of different rating.

**Worked example 4 (T1 at 118.5 %, all links up).** $\Delta S_1=10\,(118.5-75)/100=4.35$ MVA.

| Supporter j | $L_j$ (%) | $Cap_j$ (MVA) | $c_j$ | $L'_j$ (%) | $\rho_j$ | $C_{1j}$ | Status |
|---|---|---|---|---|---|---|---|
| T2 | 62 | 2.25 | 0.52 | 80.0 | 0.78 | 0.33 | eligible |
| T3 | 68 | 0.53 | 0.12 | 75.0 | 0.77 | 0.15 | score 0.15 < C_min |
| T4 | 58 | 3.30 | 0.76 | 80.0 | 0.62 | 0.47 | eligible |

T4 has the most headroom at the lowest risk, so it is chosen first. T2 is second. T3 is excluded because its 7.5 MVA rating leaves little headroom below its limit.

## 5. Equation D — Self-healing decision logic

| Condition (evaluated in this order) | Action |
|---|---|
| $D_i<D_{warn}=0.15$ | Continue normal operation |
| $D_{warn}\le D_i<D_{act}=0.45$ | Warning mode (monitor, no transfer) |
| $D_i\ge D_{crit}=0.85$ and $H_i<H_{iso}=30$ | Flag for isolation (simulated) |
| No communication link available | Flag for isolation (simulated) |
| Eligible capacity ≥ ζ·ΔS ($\zeta$ = 25 %) | Redistribute load (simulated transfer) |
| Otherwise | Flag for isolation: simulated shedding of load above $L_{tgt,i}$ |
| After a transfer: $D_i<D_{rec}=0.10$ for M = 10 s and every supporter $D_j<D_{warn}$ | Recovery confirmed |
| After a transfer: $D_i\ge D_{act}$ for $T_{esc}$ = 30 s | Escalate to isolation flag |

Messages between stages take a simulated latency of τ_c = 2 s, so each stage (alert, offers, decision, transfer confirmation) shows up separately on the 3D model.

**Decision-table check** (direct evaluation of the rule):

| D | H | ΔS (MVA) | Eligible cap. (MVA) | Link | Action | Reason |
|---|---|---|---|---|---|---|
| 0.05 | 95 | 0 | 0 | up | NORMAL OPERATION | D = 0.05 < D_warn |
| 0.3 | 95 | 0.5 | 3 | up | WARNING MODE | D_warn ≤ D = 0.30 < D_act |
| 0.91 | 98 | 4.4 | 5.2 | up | REDISTRIBUTE LOAD | eligible capacity covers 100 % of 4.40 MVA |
| 0.91 | 98 | 4.4 | 0.6 | up | FLAG ISOLATION | coverage 14 % < ζ = 25 % |
| 0.91 | 98 | 4.4 | 5.2 | down | FLAG ISOLATION | no communication link available |
| 0.95 | 25 | 4.4 | 5.2 | up | FLAG ISOLATION | critical D = 0.95 with low health H = 25 |

## 6. Simulation validation

All scenarios use the same controller as the website: seed 42, 900 s pre-roll to thermal steady state, 1 s steps. Base loads are T1 70 %, T2 62 %, T3 68 % and T4 58 % in the Normal-Operation profile (±5 % swing).

| Scenario | Outcome | Detection delay (s) | Time to outcome (s) | Required (MVA) | Transfers | Max θ of affected unit (°C) |
|---|---|---|---|---|---|---|
| S1 Normal operation (600 s) | NO EVENT | — | — | 0 | — | 68.43 |
| S2 Overload T1 → 118 % | RECOVERED | 1 | 18 | 4.36 | T4→T1 2.69, T2→T1 1.69 | 67.83 |
| S3a Communication failure: T1–T4 and T1–T2 down | ISOLATED | 1 | 41 | 4.36 | — | 67.83 |
| S3b Communication failure: T1–T4 down | ISOLATED | 1 | 41 | 4.36 | T2→T1 1.74 | 69.93 |
| S5 Overload T3 → 135 % | RECOVERED | 1 | 18 | 4.55 | T4→T3 2.69, T2→T3 1.74 | 68.35 |

**S2 before and after (T1 overload to 118 %).**

| Unit | L before → after (%) | θ before → after (°C) | D before → after | Final state | Final H |
|---|---|---|---|---|---|
| T1 | 118.1 → 75.9 | 66.7 → 67.5 | 0.91 → 0.00 | NORMAL | 96.0 |
| T2 | 65.3 → 80.4 | 61.6 → 62.4 | 0.00 → 0.00 | NORMAL | 100.0 |
| T3 | 71.3 → 72.9 | 66.0 → 66.2 | 0.00 → 0.00 | NORMAL | 100.0 |
| T4 | 61.3 → 80.8 | 58.8 → 59.3 | 0.00 → 0.00 | NORMAL | 100.0 |

**Interpretation.**
- *Normal (S1)*: across 600 s the largest disturbance score of any unit was 0. There were no false alarms and no transfers.
- *Overload (S2, S5)*: detection follows the disturbance by 1 s. The relief is split across two supporters in score order, recovery is confirmed 18 s after detection, and every unit ends in NORMAL. Temperatures barely rise because the twin's thermal time constants (180–300 s) are much longer than the coordination time (about 8 s).
- *Communication failure (S3a)*: with T1–T2 and T1–T4 down, only T3 is reachable, and its headroom is too small (coverage 0 %). The rule flags T1 for isolation and sheds the excess load in simulation instead of overloading T3.
- *Partial communication failure (S3b)*: with T1–T4 down, T2 alone covers 41 % of the need. The transfer goes ahead, T1 stays above $D_{act}$, and after $T_{esc}$ = 30 s it is escalated to the isolation flag. Total time is 41 s.
- *Recovery (S4)*: after S2 the base load is restored. Over 600 s T1's health rises from 95.98 to 97.24 as the stress memory decays. The permanent part (W, N) remains.

**Bounds, stability and monotonicity** (randomised tests):

- D over 20,000 random inputs (L 0–250 %, T 0–250 °C, V 0–15 kV, I 0–5000 A): min 0, max 1, non-finite 0. Increasing load or temperature never decreased D (load violations 0, temperature violations 0). Extreme inputs (zeros, 10⁶ values, negatives) give D = [1, 1, 0].
- H over 20,000 random (W, S, N): min 0, max 45.7445. H always stays within [0, 100] and decreases monotonically under constant D (table in Section 3).
- $C_{ij}$ over 20,000 random supporter states: min -0.9195, max 0.6855. upper bound w_c + w_h = 0.70 (full coverage, perfect health, no risk); no fixed lower bound because ρ grows with temperature, but any C < C_min = 0.20 is ineligible.

## 7. Parameter configuration

Every parameter is defined in `src/model/synapseModelParams.ts` with its purpose, value, reason, effect and tuning procedure. The table below is generated from that file.

| Group | Symbol | Value | Unit | Purpose | Why this value | How to tune |
|---|---|---|---|---|---|---|
| A. Disturbance score | α | 2 | – | Weight of the squared load-excess term u_L² | Loading is the primary driver of overload in the twin (state labels use L ≥ 115 %). A value of 2 makes D ≈ 0.48 when a unit reaches 100 % with an ONAN safe limit of 80 %, i.e. action starts before the 115 % overload label. | Sweep α in Load-Ramp runs and choose the smallest value for which D crosses D_act before the twin labels OVERLOAD. |
| A. Disturbance score | β | 2.5 | – | Weight of the squared temperature-excess term u_T² | Temperature carries the slow, cumulative part of the risk and controls when recovery can be confirmed; it is weighted slightly above load so a hot unit is not declared recovered just because its load dropped. | Run the overload→transfer scenario and pick β so that recovery is confirmed when θ falls a few kelvin above T_safe. |
| A. Disturbance score | γ | 0.8 | – | Weight of the voltage-deviation term u_V | Voltage sags in the twin (−5 % to −15 %) are secondary disturbances; γ = 0.8 makes a 10 % sag alone give D ≈ 0.79, i.e. a warning/action on its own. | Use Voltage-Sag scenario runs; γ should make the sag window D ≥ D_warn. |
| A. Disturbance score | δ | 1 | – | Weight of the current-consistency term u_I | u_I flags current that is not explained by the loading (sag or fault current). Unit weight keeps it comparable to the other terms. | Fault-Event runs: δ should push D above D_crit during the fault window. |
| A. Disturbance score | κ | 1.5 | – | Weight of the load × temperature synergy term u_L·u_T | An overload on an already hot transformer is worse than either condition alone (ageing accelerates with both). The cross term adds risk only when both are present. | Compare a cold and a pre-heated overload with equal load; κ sets how much earlier the hot case escalates. |
| A. Disturbance score | d_V | 0.03 | p.u. | Voltage-deviation dead-band | The twin drops voltage by 2.5 % at rated load by design; deviations within 3 % are normal regulation, not a disturbance. | Set just above the largest deviation seen in Normal-Operation runs. |
| A. Disturbance score | ε_V | 0.05 | p.u. | Voltage-deviation scale beyond the dead-band | A further 5 % deviation (8 % total) gives u_V = 1, a full-weight voltage disturbance. | Match to the statutory voltage band used by the utility (±5 % to ±10 %). |
| A. Disturbance score | d_I | 0.05 | – | Dead-band of the current-consistency ratio | With noise and the small load-dependent voltage drop the ratio (I/I_r)/(L/100) stays within 5 % of 1 in normal operation. | Set above the 99th percentile of the ratio in Normal-Operation data. |
| A. Disturbance score | σ_I | 0.25 | – | Scale of the current-consistency excess | A current 30 % above what the load explains gives u_I = 1. | Fault-Event data: choose so fault windows give u_I ≫ 1. |
| References | L_crit | 115 | % | Load at which the twin labels OVERLOAD | Taken from the twin labelling rule (Eq. 8 of the paper). | Fixed by the labelling rule. |
| References | T_crit | 105 | °C | Temperature at which the twin labels OVERLOAD | Taken from the twin labelling rule. | Fixed by the labelling rule. |
| References | V_n | 11 | kV | Nominal primary voltage | All four units are 11/0.415 kV. | – |
| B. Health score | λ_W | 0.000555556 | 1/s | Rate at which accumulated abnormal exposure W_i lowers health | 30 min of full-severity abnormal operation (D = 1) reduces the permanent part of H to e⁻¹ ≈ 37 %. | Choose so that the Sustained-Overload scenario (300 s at D ≈ 1) costs a few percent of health. |
| B. Health score | ψ | 0.02 | per event | Permanent penalty per self-healing event N_i | Each event that needs coordinated relief leaves a 2 % mark (recovery history). | Set from how many events per year a utility tolerates before inspection. |
| B. Health score | ω | 0.4 | – | Maximum recoverable derating from short-term stress S_i | Up to 40 % of health can be temporarily lost while the unit is stressed and is regained as it cools. | Tune visually against the thermal recovery time of the twin. |
| B. Health score | λ_S | 0.00833333 | 1/s | Sensitivity of the recoverable part to stress S_i | 120 s·D² of stress gives 63 % of the maximum recoverable derating. | As for ω. |
| B. Health score | t_½ | 300 | s | Half-life of the short-term stress memory S_i | Matches the order of the twin thermal time constants (τ_s = 180–300 steps). | Set close to the median τ_s of the four units. |
| B. Health score | D_warn | 0.15 | – | Only D above this value counts as abnormal exposure W_i | Same threshold as warning mode, so normal fluctuations do not age the score. | – |
| C. Coordination score | w_c | 0.45 | – | Weight of capacity coverage c_j | The first purpose of a supporter is to absorb the excess power. | Rank stability check across T1–T4 overload cases. |
| C. Coordination score | w_h | 0.25 | – | Weight of supporter health H_j/100 | A degraded unit should not be loaded further. | As above. |
| C. Coordination score | w_r | 0.2 | – | Weight of overload risk ρ_j | Penalises supporters that would end close to their own safe limit. | Increase if supporters end in WARNING after transfers. |
| C. Coordination score | w_d | 0.1 | – | Weight of supporter disturbance D_j | A supporter already disturbed should help last. | – |
| C. Coordination score | η | 4 | – | Steepness of the risk curve (L_j′/L_safe,j)^η | Risk stays small at moderate post-transfer loading and rises sharply near L_safe. | – |
| C. Coordination score | H_min | 60 | % | Minimum health for a unit to be allowed to support | Below 60 the unit is treated as degraded. | – |
| C. Coordination score | C_min | 0.2 | – | Minimum coordination score for eligibility | Excludes supporters with negligible net benefit. | – |
| C. Coordination score | H_cap,min | 0.05 | MVA | Smallest headroom worth negotiating | Avoids splitting transfers into negligible parts. | – |
| D. Decision logic | D_warn | 0.15 | – | Enter warning mode | About 90 % loading on an ONAN unit. | Lower → earlier warnings. |
| D. Decision logic | D_act | 0.45 | – | Start coordinated self-healing | About 100 % loading on an ONAN unit, before the 115 % overload label. | Lower → earlier action, more transfers. |
| D. Decision logic | D_rec | 0.1 | – | Below this value a unit counts as recovered | Below the warning threshold with margin (hysteresis). | – |
| D. Decision logic | D_crit | 0.85 | – | Critical disturbance | Combined with low health it triggers isolation. | – |
| D. Decision logic | H_iso | 30 | % | Health below which a critical unit is flagged for isolation | Do not keep stressing a badly degraded unit. | – |
| D. Decision logic | ζ | 0.25 | – | Minimum fraction of the required relief that supporters must offer | Below 25 % coverage a transfer is not worth it; flag instead. | – |
| D. Decision logic | M | 10 | s | Consecutive seconds with D < D_rec needed to confirm recovery | Prevents declaring recovery on a single noisy sample. | – |
| D. Decision logic | T_rec,max | 1200 | s | Time allowed for recovery before escalation | About four times the largest τ_s. | – |
| D. Decision logic | T_esc | 30 | s | Escalate to isolation if D stays ≥ D_act this long after a transfer | Partial relief that leaves the unit overloaded must not be tolerated for long; 30 s is short compared with the thermal time constants, so the unit is still cool when the flag is raised. | Must exceed τ_c plus the twin load-settling time (~5 s). |
| D. Decision logic | τ_c | 2 | s | Simulated message latency per coordination stage | Makes each stage (alert, offers, decision) visible and gives agents time to respond. | – |
| Transfer limits | m_L | 5 | % | Margin for the twin's normal load swing | The Normal-Operation profile varies load by ±5 % (sinusoid); targets and supporter limits keep this margin so units do not cross a threshold on the next swing. | Set to the amplitude of normal load variation observed in the dataset. |
| Transfer limits | L_warn | 85 | % | Load at which the twin labels WARNING | Supporters are never planned above the twin's own warning threshold, even if their cooling class would allow more. | Fixed by the labelling rule. |

## 8. Where the model appears in the website

Open **3D Grid Twin** and select T1–T4. The **Mathematical Model** tab shows, live for the selected unit:
- the measured inputs and references
- every term of $E$ and the resulting $D$
- $W$, $S$, $N$ and $H$
- during an event, the coordination table ($A$, $Cap$, $c$, $\rho$, $C$, eligibility)
- the decision with its reason
- the recovery result with a before/after table

The 3D scene shows the same events: red alert pulses, blue offers and grey declines, amber power-transfer streams with MVA labels, green confirmations, and a red **LINK DOWN** marker for failed links.

## 9. Limitations

- The coefficients are reasoned choices, not values fitted to field data. They should be re-tuned against measured transformer data before any real use.
- The twin's network has no impedances or power-flow constraints. A transfer moves apparent power between units, assuming they are electrically tie-able and lossless.
- Isolation and shedding are flags and simulated load changes. No physical switching exists in this project.
- The health score is an operational indicator. It is not an IEC insulation-ageing estimate. The twin keeps its separate physics-based ageing index.
