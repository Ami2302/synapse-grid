import React from 'react';
import { BookOpen, Info, HelpCircle, ShieldCheck } from 'lucide-react';

export const ModelAssumptionsModal: React.FC = () => {
  const vivaQA = [
    {
      q: 'Q: What is a Digital Twin?',
      a: 'A Digital Twin is a virtual representation of a physical asset (distribution transformer) whose internal state updates continuously according to real-time or simulated operating conditions.',
    },
    {
      q: 'Q: Why are we using a Digital Twin?',
      a: 'To simulate transformer behavior under diverse normal, warning, stress, overload, fault, and recovery operating conditions, generating controlled time-series telemetry datasets for Soft Computing & Multi-Agent System experimentation.',
    },
    {
      q: 'Q: Why not directly use random data?',
      a: 'Independent random values destroy physical relationships between electrical (V, I, P, PF) and thermal (ambient, oil, hot-spot temp) variables. The Digital Twin generates correlated, temporally continuous data based on IEEE 757 / IEC 60076-7 thermal and 3-phase electrical equations.',
    },
    {
      q: 'Q: Why do we need scenarios?',
      a: 'To systematically evaluate and generate balanced datasets containing Baseline Normal, Load Ramp, Morning/Evening Peaks, Step Load Increase, Sustained Overload, Voltage Sag, Thermal Stress, Intermittent Anomalies, Fault Trips, and Recovery states.',
    },
    {
      q: 'Q: Why is this useful for Soft Computing / AI?',
      a: 'The generated dataset provides continuous numerical input features (voltage, current, active power, power factor, ambient/transformer temp, load %) and multi-class target labels (operating_state, anomaly, overload, fault) for training ML models like Random Forest, XGBoost, LSTM, and Fuzzy Logic systems.',
    },
    {
      q: 'Q: What happens after this module?',
      a: 'Soft Computing models will predict abnormal/overload conditions ahead of time; individual Transformer Agents (T1–T4) will communicate these states across neighbor agents, enabling Multi-Agent System load redistribution and self-healing grid control.',
    },
  ];

  return (
    <div className="bg-grid-surface border border-grid-border rounded-xl p-6 flex flex-col gap-6 shadow-xl max-w-6xl mx-auto my-4 text-xs font-mono">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-grid-border pb-4">
        <div className="p-2.5 rounded-lg bg-grid-card border border-grid-steel/40 text-grid-steel">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white font-mono tracking-wider">
            MODEL ASSUMPTIONS &amp; VIVA DEFENSE GUIDE
          </h2>
          <p className="text-xs text-grid-muted">
            SYNAPSE GRID Project: Transformer Intelligence &amp; Synthetic Data Generation Platform
          </p>
        </div>
      </div>

      {/* Mandatory Viva Disclaimer Notice */}
      <div className="p-4 rounded-lg bg-grid-card border border-grid-steel/40 text-grid-text space-y-2">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Info className="w-4 h-4 text-grid-steel" />
          MANDATORY RESEARCH DISCLAIMER
        </div>
        <p className="leading-relaxed text-grid-muted">
          &quot;This Digital Twin is a simulation-based approximation designed for controlled dataset generation and algorithm development. It is not a complete electromagnetic or thermal finite-element model of a physical transformer.&quot;
        </p>
      </div>

      {/* VIVA PREPARATION SECTION (6 Q&As) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-grid-border pb-2">
          <HelpCircle className="w-4 h-4 text-grid-steel" />
          VIVA DEFENSE Q&amp;A REFERENCE
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vivaQA.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-grid-bg border border-grid-border space-y-1.5">
              <div className="font-bold text-white text-xs">{item.q}</div>
              <div className="text-grid-muted text-[11px] leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 10 TECHNICAL ASSUMPTIONS BREAKDOWN */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-grid-border pb-2">
          <ShieldCheck className="w-4 h-4 text-grid-green" />
          10 CORE TECHNICAL SIMULATION ASSUMPTIONS
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              1. DIGITAL TWIN STATE REPRESENTATION
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Virtual state updates dynamically at discrete step intervals Δt = 1 second, tracking electrical parameters, oil/winding temperature, health index, and discrete operating labels for each distribution transformer.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              2. TRANSFORMER OPERATING BOUNDARIES
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Standard 3-phase oil-immersed distribution transformer parameters (e.g. 10 MVA, 11 kV / 0.415 kV) with ONAN/ONAF thermal time constants (τ = 30 to 50 minutes).
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              3. LOAD-CURRENT RELATIONSHIP
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              3-phase line current I(t) is directly proportional to target active capacity utilization:
              I = (Load% × Rated_MVA × 1000) / (√3 × Secondary_kV). Overcurrent surges scale up during fault events.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              4. POWER &amp; POWER FACTOR CALCULATION
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Active power P(t) = √3 × V_line × I_line × cos(φ). Power factor degrades slightly under heavy overloads (Load &gt; 100%) and severe fault transients.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              5. THERMAL DIFFERENTIAL MODEL (IEEE 757 / IEC 60076-7)
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Temperature changes continuous following differential exponential lag:
              dT/dt = (T_steady - T) / τ, where T_steady = T_ambient + ΔT_no_load + ΔT_rated × (Load/100)^1.8.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              6. SIMULATED HEALTH INDEX &amp; AGING
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Health Index H(t) between 0% and 100% degrades dynamically based on thermal stress above 85°C, sustained overloads, and fault events using an Arrhenius aging acceleration factor.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              7. MEASUREMENT NOISE MODEL
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Zero-mean Gaussian noise N(0, σ²) generated via Box-Muller transformation is added to load, voltage, current, and temperature streams to simulate real SCADA/AMI sensor measurement jitter.
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              8. SCENARIO PROFILE ENGINE
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Profiles deterministically control loading trajectories (Ramp, Morning/Evening Peak curves, Step increase, Sustained Overload, Voltage Sag drops, and Phase Faults).
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              9. OPERATING STATE THRESHOLD RULES
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              <strong className="text-grid-green">NORMAL</strong> (Load &lt; 85%), <strong className="text-grid-yellow">WARNING</strong> (85% ≤ Load &lt; 100%), <strong className="text-grid-amber">HIGH STRESS</strong> (100% ≤ Load &lt; 115% or Temp ≥ 90°C), <strong className="text-grid-red">OVERLOAD / FAULT</strong> (Load ≥ 115% or Fault Injection active).
            </p>
          </div>

          <div className="bg-grid-bg p-4 rounded-lg border border-grid-border space-y-2">
            <h3 className="text-xs font-bold text-grid-steel uppercase border-b border-grid-border pb-1">
              10. SYNTHETIC DATASET REPRODUCIBILITY
            </h3>
            <p className="text-grid-muted text-[11px] leading-relaxed">
              Seeded Mulberry32 PRNG guarantees 100% bit-exact reproducibility across runs when using identical random seeds, while varying seeds generates statistically sound non-duplicate datasets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
