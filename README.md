# Synapse Grid v2 — 3D grid twin with autonomous self-healing

Runs on its own port, next to the original project:

    npm install
    npm run dev          # → http://localhost:5175

## What is new in v2
- **3D Grid Twin** (default page): T1–T4 in one interactive three.js scene with communication arcs,
  animated alert / offer / transfer / confirm pulses, power-transfer streams with MVA labels,
  failed-link markers, click-to-select telemetry, and a live self-healing event log.
- **Project-specific mathematical model** (`src/model/`): disturbance score D, health score H,
  coordination score C, and self-healing decision rule. All parameters are documented in
  `src/model/synapseModelParams.ts`.
- **Grid twin controller** (`src/twin/gridTwinController.ts`): runs the physics twin, agents, model and
  self-healing step by step. The website and the validation script share this code.
- All earlier pages (Soft Computing with 5 algorithms, Multi-Agent, Self-Healing, datasets) are unchanged.

## Demo during evaluation
1. Open **3D Grid Twin**. All four units are NORMAL and all 6 communication links are up.
2. Choose a transformer and a load (e.g. T1, 118 %), then click **Simulate disturbance**.
   Watch: overload → alert pulses → capacity offers → decision → amber transfer streams →
   recovering → RECOVERED.
3. Click **Comm links** buttons (e.g. 1–2 and 4–1) to fail links and repeat. This shows partial relief
   or the simulated isolation flag.
4. Open the **Mathematical Model** tab to see every term of D, H and C, the decision and the result.
5. Optional: train the Hybrid model in **Soft Computing / AI**. The agents then show its predictions.

## Validation and report
    npm run validate     # scenarios S1–S5 + bounds/stability → validation/results.json
    npm run report       # docs/Synapse_Grid_Mathematical_Model.md (+ .docx, needs pandoc)

`experiments.ts` regenerates the IEEE paper numbers: `npx tsx experiments.ts ./results`

## Live website (GitHub Pages)
Every push to `main` builds the site with GitHub Actions (`.github/workflows/deploy.yml`) and publishes it to
`https://<your-username>.github.io/<repo-name>/`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
Note: trained models live in the browser only — each visitor trains them in Soft Computing / AI.
