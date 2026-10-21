import type { 
  TransformerConfig, 
  ScenarioConfig, 
  TransformerState, 
  DatasetRecord, 
  DatasetQuality, 
  OperatingState,
  ScenarioType
} from './types';
import { PhysicsSimulationEngine } from './physicsEngine';
import { DEFAULT_SCENARIO_CONFIGS } from './initialData';

export class DatasetEngine {
  public static toDatasetRecord(state: TransformerState, config?: TransformerConfig): DatasetRecord {
    return {
      timestamp: state.timestamp,
      transformer_id: state.transformerId,
      simulation_run_id: state.simulationRunId,
      scenario: state.scenario,
      rated_capacity_MVA: state.ratedCapacityMVA,
      primary_voltage_kV: state.voltageKV,
      secondary_voltage_kV: config ? config.secondaryVoltageKV : 0.415,
      load_percent: state.loadPercent,
      current_A: state.currentA,
      active_power_kW: state.powerKW,
      power_factor: state.powerFactor,
      ambient_temperature_C: state.ambientTemperatureC,
      transformer_temperature_C: state.transformerTemperatureC,
      health_index: state.healthIndex,
      operating_state: state.operatingState,
      anomaly: state.anomaly,
      overload: state.overload,
      fault: state.fault,
      event_type: state.eventType,
    };
  }

  public static generateBatchDataset(
    transformersList: TransformerConfig[],
    scenarioDistribution: Array<{ scenarioType: ScenarioType; runsCount: number }>,
    baseSeed: number = 42,
    progressCallback?: (progressPercent: number, currentRun: string) => void
  ): DatasetRecord[] {
    const dataset: DatasetRecord[] = [];
    const engine = new PhysicsSimulationEngine(baseSeed);
    let runCounter = 1;
    
    const totalRuns = scenarioDistribution.reduce((acc, curr) => acc + curr.runsCount, 0) * transformersList.length;
    let completedRuns = 0;

    for (const dist of scenarioDistribution) {
      if (dist.runsCount <= 0) continue;
      const baseScenario = DEFAULT_SCENARIO_CONFIGS[dist.scenarioType] || DEFAULT_SCENARIO_CONFIGS['NORMAL_OPERATION'];

      for (let runIdx = 0; runIdx < dist.runsCount; runIdx++) {
        for (const transformer of transformersList) {
          const runId = `RUN-${String(runCounter).padStart(3, '0')}`;
          
          const runSeed = baseSeed + runCounter * 17;
          engine.setSeed(runSeed);

          const randomizedScenario: ScenarioConfig = {
            ...baseScenario,
            randomSeed: runSeed,
            ambientTempC: baseScenario.ambientTempC + ((runIdx % 5) - 2) * 1.5,
            initialLoadPercent: Math.max(30, Math.min(95, baseScenario.initialLoadPercent + ((runIdx % 7) - 3) * 2.0)),
          };

          const states = engine.runSimulationScenario(transformer, randomizedScenario, runId);
          for (const s of states) {
            dataset.push(this.toDatasetRecord(s, transformer));
          }

          completedRuns++;
          runCounter++;

          if (progressCallback) {
            const percent = Math.min(100, Math.round((completedRuns / totalRuns) * 100));
            progressCallback(percent, `${runId} (${dist.scenarioType} - ${transformer.id})`);
          }
        }
      }
    }

    return dataset;
  }

  public static analyzeDatasetQuality(records: DatasetRecord[]): DatasetQuality {
    const totalRecords = records.length;
    const transformersSet = new Set<string>();
    const classDistribution: Record<OperatingState, number> = {
      NORMAL: 0,
      WARNING: 0,
      HIGH_STRESS: 0,
      OVERLOAD: 0,
      FAULT: 0,
      RECOVERY: 0,
    };

    let normalSamples = 0;
    let warningSamples = 0;
    let highStressSamples = 0;
    let overloadSamples = 0;
    let faultSamples = 0;
    let anomalySamples = 0;
    let missingValues = 0;

    const seenRows = new Set<string>();
    let duplicateRows = 0;

    for (const record of records) {
      transformersSet.add(record.transformer_id);

      for (const val of Object.values(record)) {
        if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
          missingValues++;
        }
      }

      const rowKey = `${record.timestamp}-${record.transformer_id}-${record.simulation_run_id}-${record.load_percent}-${record.transformer_temperature_C}`;
      if (seenRows.has(rowKey)) {
        duplicateRows++;
      } else {
        seenRows.add(rowKey);
      }

      const state = record.operating_state;
      if (classDistribution[state] !== undefined) {
        classDistribution[state]++;
      }

      if (state === 'NORMAL') normalSamples++;
      if (state === 'WARNING') warningSamples++;
      if (state === 'HIGH_STRESS') highStressSamples++;
      if (state === 'OVERLOAD') overloadSamples++;
      if (state === 'FAULT') faultSamples++;

      if (record.anomaly === 1) anomalySamples++;
    }

    return {
      totalRecords,
      totalTransformers: transformersSet.size,
      totalFeatures: 18,
      normalSamples,
      warningSamples,
      highStressSamples,
      overloadSamples,
      faultSamples,
      anomalySamples,
      missingValues,
      duplicateRows,
      classDistribution,
    };
  }

  public static exportToCSV(records: DatasetRecord[]): string {
    if (records.length === 0) return '';
    const headers = Object.keys(records[0]) as (keyof DatasetRecord)[];
    const csvLines: string[] = [headers.join(',')];

    for (const record of records) {
      const line = headers.map((header) => {
        const value = record[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',');
      csvLines.push(line);
    }

    return csvLines.join('\n');
  }

  public static downloadFile(content: string, fileName: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
