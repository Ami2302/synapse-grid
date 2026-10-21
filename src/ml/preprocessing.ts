import type { DatasetRecord, OperatingState } from '../simulation/types';

export const OPERATING_STATES_ORDER: OperatingState[] = [
  'NORMAL',
  'WARNING',
  'HIGH_STRESS',
  'OVERLOAD',
  'FAULT',
];

export const FEATURE_NAMES = [
  'load_percent',
  'transformer_temperature_C',
  'primary_voltage_kV',
  'current_A',
  'active_power_kW',
  'power_factor',
  'ambient_temperature_C',
  'health_index',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

export interface PreprocessedDataset {
  X: number[][]; // Feature matrix
  y: number[];   // Label indices (0 to 4)
  records: DatasetRecord[];
  featureMin: number[];
  featureMax: number[];
}

export class DataPreprocessor {
  public static encodeLabel(state: OperatingState): number {
    const idx = OPERATING_STATES_ORDER.indexOf(state);
    return idx >= 0 ? idx : 0;
  }

  public static decodeLabel(index: number): OperatingState {
    return OPERATING_STATES_ORDER[Math.max(0, Math.min(4, Math.round(index)))] || 'NORMAL';
  }

  public static preprocess(records: DatasetRecord[]): PreprocessedDataset {
    // 1. Clean invalid records
    const valid = records.filter(
      (r) =>
        r &&
        typeof r.load_percent === 'number' &&
        !isNaN(r.load_percent) &&
        typeof r.transformer_temperature_C === 'number' &&
        !isNaN(r.transformer_temperature_C)
    );

    if (valid.length === 0) {
      return { X: [], y: [], records: [], featureMin: [], featureMax: [] };
    }

    // 2. Extract feature matrix X and target y
    const rawX: number[][] = valid.map((r) => [
      r.load_percent,
      r.transformer_temperature_C,
      r.primary_voltage_kV,
      r.current_A,
      r.active_power_kW,
      r.power_factor,
      r.ambient_temperature_C,
      r.health_index,
    ]);

    const y: number[] = valid.map((r) => this.encodeLabel(r.operating_state));

    // 3. Compute Min/Max for normalization
    const numFeatures = rawX[0].length;
    const featureMin = new Array(numFeatures).fill(Infinity);
    const featureMax = new Array(numFeatures).fill(-Infinity);

    for (let i = 0; i < rawX.length; i++) {
      for (let j = 0; j < numFeatures; j++) {
        if (rawX[i][j] < featureMin[j]) featureMin[j] = rawX[i][j];
        if (rawX[i][j] > featureMax[j]) featureMax[j] = rawX[i][j];
      }
    }

    // 4. MinMax Normalize X to [0, 1]
    const X: number[][] = rawX.map((row) =>
      row.map((val, col) => {
        const range = featureMax[col] - featureMin[col];
        return range > 0 ? (val - featureMin[col]) / range : 0.5;
      })
    );

    return { X, y, records: valid, featureMin, featureMax };
  }

  public static trainTestSplit<T>(
    data: T[],
    testRatio: number = 0.25,
    shuffle: boolean = true
  ): { train: T[]; test: T[] } {
    if (data.length === 0) return { train: [], test: [] };

    const items = [...data];
    if (shuffle) {
      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }

    const testCount = Math.max(1, Math.floor(items.length * testRatio));
    const trainCount = items.length - testCount;

    return {
      train: items.slice(0, trainCount),
      test: items.slice(trainCount),
    };
  }

  /**
   * Chronological Train/Test split specifically for time-series forecasting (LSTM) to prevent data leakage.
   * Early time data -> Train, Later time data -> Test.
   */
  public static chronologicalSplit<T>(
    data: T[],
    testRatio: number = 0.25
  ): { train: T[]; test: T[] } {
    return this.trainTestSplit(data, testRatio, false);
  }

  /**
   * Creates sliding window sequences for LSTM sequence modeling.
   * Window size = seqLength. Target = transformer_temperature_C at time t + seqLength.
   */
  public static createSlidingWindows(
    records: DatasetRecord[],
    seqLength: number = 10
  ): Array<{ sequence: number[][]; targetTemp: number; targetStateIndex: number; timestamp: string }> {
    const windows: Array<{ sequence: number[][]; targetTemp: number; targetStateIndex: number; timestamp: string }> = [];

    if (records.length <= seqLength) return windows;

    // Normalize records for sequence features
    const preprocessed = this.preprocess(records);

    for (let i = 0; i <= preprocessed.X.length - seqLength - 1; i++) {
      const sequence = preprocessed.X.slice(i, i + seqLength);
      const targetRecord = preprocessed.records[i + seqLength];
      windows.push({
        sequence,
        targetTemp: targetRecord.transformer_temperature_C,
        targetStateIndex: this.encodeLabel(targetRecord.operating_state),
        timestamp: targetRecord.timestamp,
      });
    }

    return windows;
  }
}
