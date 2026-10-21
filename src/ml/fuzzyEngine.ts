import type { DatasetRecord, OperatingState } from '../simulation/types';
import type { ClassificationMetrics } from './types';
import { DataPreprocessor } from './preprocessing';
import { computeClassificationMetrics } from './metrics';

export interface FuzzyRule {
  id: number;
  load: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'ANY';
  temp: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'ANY';
  voltage: 'NORMAL' | 'DEVIATED' | 'SEVERE' | 'ANY';
  consequent: OperatingState;
  weight: number;
}

export class FuzzyLogicEngine {
  // Triangular / Trapezoidal Membership Function helper
  private static trimf(x: number, a: number, b: number, c: number): number {
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x < b) return (x - a) / (b - a);
    return (c - x) / (c - b);
  }

  private static trapmf(x: number, a: number, b: number, c: number, d: number): number {
    if (x >= b && x <= c) return 1; // plateau first, so shoulder sets (a = b or c = d) include their edge
    if (x <= a || x >= d) return 0;
    if (x < b) return (x - a) / (b - a);
    return (d - x) / (d - c);
  }

  // Linguistic Fuzzification Methods
  public static fuzzifyLoad(loadPercent: number) {
    return {
      LOW: this.trapmf(loadPercent, -10, 0, 50, 75),
      MEDIUM: this.trimf(loadPercent, 60, 78, 92),
      HIGH: this.trimf(loadPercent, 85, 100, 118),
      CRITICAL: this.trapmf(loadPercent, 110, 125, 200, 300),
    };
  }

  public static fuzzifyTemp(tempC: number) {
    return {
      NORMAL: this.trapmf(tempC, 0, 20, 55, 75),
      ELEVATED: this.trimf(tempC, 65, 78, 90),
      HIGH: this.trimf(tempC, 82, 95, 108),
      CRITICAL: this.trapmf(tempC, 100, 115, 150, 200),
    };
  }

  public static fuzzifyVoltageDev(devPercent: number) {
    const absDev = Math.abs(devPercent);
    return {
      NORMAL: this.trapmf(absDev, 0, 0, 2.5, 5.0),
      DEVIATED: this.trimf(absDev, 3.5, 8.0, 15.0),
      SEVERE: this.trapmf(absDev, 12.0, 18.0, 40.0, 60.0),
    };
  }

  // Pre-defined Mamdani Fuzzy Rule Base
  public static RULES: FuzzyRule[] = [
    { id: 1, load: 'LOW', temp: 'NORMAL', voltage: 'NORMAL', consequent: 'NORMAL', weight: 1.0 },
    { id: 2, load: 'MEDIUM', temp: 'NORMAL', voltage: 'NORMAL', consequent: 'NORMAL', weight: 1.0 },
    { id: 3, load: 'HIGH', temp: 'NORMAL', voltage: 'NORMAL', consequent: 'WARNING', weight: 1.0 },
    { id: 4, load: 'ANY', temp: 'ELEVATED', voltage: 'NORMAL', consequent: 'WARNING', weight: 1.0 },
    { id: 5, load: 'HIGH', temp: 'ELEVATED', voltage: 'NORMAL', consequent: 'HIGH_STRESS', weight: 1.0 },
    { id: 6, load: 'CRITICAL', temp: 'HIGH', voltage: 'ANY', consequent: 'OVERLOAD', weight: 1.0 },
    { id: 7, load: 'ANY', temp: 'CRITICAL', voltage: 'ANY', consequent: 'OVERLOAD', weight: 1.0 },
    { id: 8, load: 'ANY', temp: 'ANY', voltage: 'SEVERE', consequent: 'HIGH_STRESS', weight: 1.0 },
    { id: 9, load: 'HIGH', temp: 'HIGH', voltage: 'DEVIATED', consequent: 'OVERLOAD', weight: 1.0 },
  ];

  public static infer(
    loadPercent: number,
    tempC: number,
    voltageKV: number,
    nominalVoltageKV: number = 11.0
  ): { riskScore: number; operatingState: OperatingState; activeRuleFires: Array<{ rule: FuzzyRule; strength: number }> } {
    const devPercent = ((voltageKV - nominalVoltageKV) / nominalVoltageKV) * 100;

    const fLoad = this.fuzzifyLoad(loadPercent);
    const fTemp = this.fuzzifyTemp(tempC);
    const fVolt = this.fuzzifyVoltageDev(devPercent);

    const activeRuleFires: Array<{ rule: FuzzyRule; strength: number }> = [];

    // Evaluate rules via Mamdani MIN operator
    let maxNormal = 0;
    let maxWarning = 0;
    let maxHighStress = 0;
    let maxOverload = 0;

    for (const rule of this.RULES) {
      let lStr = rule.load === 'ANY' ? 1.0 : fLoad[rule.load];
      let tStr = rule.temp === 'ANY' ? 1.0 : fTemp[rule.temp];
      let vStr = rule.voltage === 'ANY' ? 1.0 : fVolt[rule.voltage];

      const strength = Math.min(lStr, tStr, vStr) * rule.weight;
      if (strength > 0.01) {
        activeRuleFires.push({ rule, strength });
        if (rule.consequent === 'NORMAL') maxNormal = Math.max(maxNormal, strength);
        if (rule.consequent === 'WARNING') maxWarning = Math.max(maxWarning, strength);
        if (rule.consequent === 'HIGH_STRESS') maxHighStress = Math.max(maxHighStress, strength);
        if (rule.consequent === 'OVERLOAD') maxOverload = Math.max(maxOverload, strength);
      }
    }

    // Centroid Defuzzification over output risk spectrum [0, 100]
    const centers = { NORMAL: 20, WARNING: 50, HIGH_STRESS: 75, OVERLOAD: 95 };
    const num = maxNormal * centers.NORMAL + maxWarning * centers.WARNING + maxHighStress * centers.HIGH_STRESS + maxOverload * centers.OVERLOAD;
    const den = maxNormal + maxWarning + maxHighStress + maxOverload || 1e-6;

    const riskScore = Number((num / den).toFixed(1));

    let operatingState: OperatingState = 'NORMAL';
    if (riskScore >= 85 || maxOverload > 0.6) operatingState = 'OVERLOAD';
    else if (riskScore >= 65 || maxHighStress > 0.5) operatingState = 'HIGH_STRESS';
    else if (riskScore >= 40 || maxWarning > 0.5) operatingState = 'WARNING';

    return { riskScore, operatingState, activeRuleFires };
  }

  /**
   * Evaluates the Fuzzy Logic Model against a given synthetic dataset.
   * Returns real classification metrics and confusion matrix.
   */
  /**
   * Aggregated firing strength of each output consequent (NORMAL, WARNING, HIGH_STRESS, OVERLOAD).
   * Used as engineered features by the hybrid model.
   */
  public static consequentStrengths(
    loadPercent: number,
    tempC: number,
    voltageKV: number,
    nominalVoltageKV: number = 11.0
  ): { riskScore: number; strengths: [number, number, number, number] } {
    const res = this.infer(loadPercent, tempC, voltageKV, nominalVoltageKV);
    const strengths: [number, number, number, number] = [0, 0, 0, 0];
    const idx: Record<string, number> = { NORMAL: 0, WARNING: 1, HIGH_STRESS: 2, OVERLOAD: 3 };
    for (const f of res.activeRuleFires) {
      const k = idx[f.rule.consequent];
      if (k !== undefined) strengths[k] = Math.max(strengths[k], f.strength);
    }
    return { riskScore: res.riskScore, strengths };
  }

  /**
   * Evaluates the Fuzzy Logic Model against a given synthetic dataset.
   * Fuzzy rules are not trained, so the whole dataset is used for evaluation.
   */
  public static evaluateDataset(dataset: DatasetRecord[]): ClassificationMetrics {
    const startTime = performance.now();
    const actual: number[] = [];
    const predicted: number[] = [];
    for (const record of dataset) {
      const pred = this.infer(record.load_percent, record.transformer_temperature_C, record.primary_voltage_kV);
      actual.push(DataPreprocessor.encodeLabel(record.operating_state));
      predicted.push(DataPreprocessor.encodeLabel(pred.operatingState));
    }
    const m = computeClassificationMetrics(actual, predicted, performance.now() - startTime, 0);
    return { ...m, trainSamplesCount: dataset.length };
  }
}
