export type OperatingState = 
  | 'NORMAL' 
  | 'WARNING' 
  | 'HIGH_STRESS' 
  | 'OVERLOAD' 
  | 'FAULT' 
  | 'RECOVERY';

export type ScenarioType = 
  | 'NORMAL_OPERATION'
  | 'LOAD_RAMP'
  | 'MORNING_PEAK'
  | 'EVENING_PEAK'
  | 'SUDDEN_LOAD_INCREASE'
  | 'SUSTAINED_OVERLOAD'
  | 'VOLTAGE_SAG'
  | 'THERMAL_STRESS'
  | 'INTERMITTENT_ANOMALY'
  | 'FAULT_EVENT'
  | 'RECOVERY';

export interface TransformerConfig {
  id: string; // 'T1', 'T2', 'T3', 'T4'
  name: string;
  substation: string;
  ratedCapacityMVA: number; // e.g. 10 MVA
  primaryVoltageKV: number; // e.g. 11 kV
  secondaryVoltageKV: number; // e.g. 0.415 kV
  initialLoadPercent: number; // e.g. 60%
  initialPowerFactor: number; // e.g. 0.95
  ambientTempC: number; // e.g. 28°C
  coolingType: string; // 'ONAN' | 'ONAF' | 'OFAF'
  thermalTimeConstantMinutes: number; // Thermal inertia coefficient
}

export interface ScenarioConfig {
  scenarioType: ScenarioType;
  name: string;
  description: string;
  durationSeconds: number; // total time steps or seconds
  samplingIntervalSeconds: number; // default 1s
  initialLoadPercent: number;
  peakLoadPercent: number;
  rampTimeSeconds: number;
  ambientTempC: number;
  voltageVariationPercent: number; // e.g. -5% to +5%
  powerFactor: number;
  thermalStressFactor: number;
  faultInjection: boolean;
  faultStartTimeSeconds: number;
  faultDurationSeconds: number;
  faultSeverity: number; // 1 (mild) to 10 (catastrophic)
  recoveryTimeSeconds: number;
  noiseLevelPercent: number;
  randomSeed: number;
}

export interface TransformerState {
  timestamp: string; // HH:MM:SS or ISO string
  stepIndex: number;
  transformerId: string;
  ratedCapacityMVA: number;
  voltageKV: number;
  currentA: number;
  powerKW: number;
  powerFactor: number;
  loadPercent: number;
  ambientTemperatureC: number;
  transformerTemperatureC: number;
  healthIndex: number; // 0% to 100%
  operatingState: OperatingState;
  anomaly: 0 | 1;
  overload: 0 | 1;
  fault: 0 | 1;
  eventType: string;
  scenario: ScenarioType;
  simulationRunId: string;
}

export interface DatasetRecord {
  timestamp: string;
  transformer_id: string;
  simulation_run_id: string;
  scenario: string;
  rated_capacity_MVA: number;
  primary_voltage_kV: number;
  secondary_voltage_kV: number;
  load_percent: number;
  current_A: number;
  active_power_kW: number;
  power_factor: number;
  ambient_temperature_C: number;
  transformer_temperature_C: number;
  health_index: number;
  operating_state: OperatingState;
  anomaly: number;
  overload: number;
  fault: number;
  event_type: string;
}

export interface DatasetQuality {
  totalRecords: number;
  totalTransformers: number;
  totalFeatures: number;
  normalSamples: number;
  warningSamples: number;
  highStressSamples: number;
  overloadSamples: number;
  faultSamples: number;
  anomalySamples: number;
  missingValues: number;
  duplicateRows: number;
  classDistribution: Record<OperatingState, number>;
}

export interface SimulationEventLog {
  id: string;
  timestamp: string;
  stepIndex: number;
  transformerId: string;
  severity: 'info' | 'warning' | 'caution' | 'critical' | 'recovery';
  operatingState: OperatingState;
  message: string;
}

export interface ScenarioDistributionConfig {
  scenarioType: ScenarioType;
  enabled: boolean;
  weightPercent: number;
  runsCount: number;
}
