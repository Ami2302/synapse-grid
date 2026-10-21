import type { OperatingState } from '../simulation/types';
import type { ClassificationMetrics } from './types';
import { OPERATING_STATES_ORDER } from './preprocessing';

const NUM_CLASSES = OPERATING_STATES_ORDER.length;

/**
 * Shared classification metrics used by every classifier in Synapse Grid,
 * so all models are compared with the same formula.
 *
 * Macro precision / recall / F1 are averaged only over classes that actually
 * appear in the evaluation set (true support > 0) or were predicted. Classes
 * that never occur are skipped instead of being counted as a perfect 100%.
 */
export function computeClassificationMetrics(
  actual: number[],
  predicted: number[],
  trainingTimeMs: number,
  trainSamplesCount: number
): ClassificationMetrics {
  const confusionMatrix = Array.from({ length: NUM_CLASSES }, () => new Array(NUM_CLASSES).fill(0));
  let correct = 0;
  for (let i = 0; i < actual.length; i++) {
    confusionMatrix[actual[i]][predicted[i]]++;
    if (actual[i] === predicted[i]) correct++;
  }

  let precSum = 0;
  let recSum = 0;
  let f1Sum = 0;
  let classesUsed = 0;
  for (let c = 0; c < NUM_CLASSES; c++) {
    const tp = confusionMatrix[c][c];
    let predictedAsC = 0;
    let actualC = 0;
    for (let k = 0; k < NUM_CLASSES; k++) {
      predictedAsC += confusionMatrix[k][c];
      actualC += confusionMatrix[c][k];
    }
    if (actualC === 0 && predictedAsC === 0) continue; // class absent from this evaluation
    const prec = predictedAsC > 0 ? tp / predictedAsC : 0;
    const rec = actualC > 0 ? tp / actualC : 0;
    precSum += prec;
    recSum += rec;
    f1Sum += prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
    classesUsed++;
  }

  const n = Math.max(1, classesUsed);
  const pct = (v: number) => Number((v * 100).toFixed(2));

  return {
    accuracy: pct(correct / Math.max(1, actual.length)),
    precision: pct(precSum / n),
    recall: pct(recSum / n),
    f1Score: pct(f1Sum / n),
    confusionMatrix,
    labels: [...OPERATING_STATES_ORDER] as OperatingState[],
    trainingTimeMs: Number(trainingTimeMs.toFixed(1)),
    trainSamplesCount,
    testSamplesCount: actual.length,
  };
}

/** Macro F1 (0–1) only — used for validation-based weight search. */
export function macroF1(actual: number[], predicted: number[]): number {
  return computeClassificationMetrics(actual, predicted, 0, 0).f1Score / 100;
}

export function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}
