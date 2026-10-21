import { useSyncExternalStore } from 'react';
import type { ClassificationMetrics, ForecastingMetrics } from './types';
import type { HybridFuzzyNeuralEngine, HybridTrainingResult } from './hybridEngine';

/**
 * Shared store of the latest REAL evaluation results.
 * Lives outside React components so results survive tab switches and can be read by
 * the System Overview and the transformer agents. Nothing here is pre-filled:
 * a model that has not run stays null and is shown as NOT EVALUATED.
 */
export interface ModelRegistryState {
  fuzzy: ClassificationMetrics | null;
  ann: ClassificationMetrics | null;
  rf: ClassificationMetrics | null;
  lstm: ForecastingMetrics | null;
  hybrid: HybridTrainingResult | null;
  hybridModel: HybridFuzzyNeuralEngine | null; // trained instance for live agent inference
}

let state: ModelRegistryState = {
  fuzzy: null,
  ann: null,
  rf: null,
  lstm: null,
  hybrid: null,
  hybridModel: null,
};

const listeners = new Set<() => void>();

export const modelRegistry = {
  get: (): ModelRegistryState => state,
  set: (patch: Partial<ModelRegistryState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useModelRegistry(): ModelRegistryState {
  return useSyncExternalStore(modelRegistry.subscribe, modelRegistry.get, modelRegistry.get);
}

/** Best classifier picked from measured test F1 only (models that have actually run). */
export function selectBestClassifier(s: ModelRegistryState): { name: string; f1: number } | null {
  const candidates: Array<{ name: string; f1: number }> = [];
  if (s.fuzzy) candidates.push({ name: 'Fuzzy Logic', f1: s.fuzzy.f1Score });
  if (s.ann) candidates.push({ name: 'ANN / MLP', f1: s.ann.f1Score });
  if (s.rf) candidates.push({ name: 'Random Forest', f1: s.rf.f1Score });
  if (s.hybrid) candidates.push({ name: 'Hybrid Fuzzy-Neural', f1: s.hybrid.metrics.f1Score });
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.f1 > a.f1 ? b : a));
}
