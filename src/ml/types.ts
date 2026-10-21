import type { OperatingState } from '../simulation/types';

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][]; // 5x5 matrix for NORMAL, WARNING, HIGH_STRESS, OVERLOAD, FAULT
  labels: OperatingState[];
  trainingTimeMs: number;
  trainSamplesCount: number;
  testSamplesCount: number;
}

export interface ForecastingMetrics {
  rmse: number;
  mae: number;
  r2Score: number;
  actualVsPredicted: Array<{ timestamp: string; actual: number; predicted: number }>;
  trainingTimeMs: number;
  trainSamplesCount: number;
  testSamplesCount: number;
}

export interface FeatureImportance {
  featureName: string;
  importance: number; // 0 to 1
}

export interface EpochLog {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  trainAccuracy: number;
}

export type ModelStatus = 'NOT_TRAINED' | 'TRAINING' | 'TRAINED' | 'ERROR';
