import type { TransformerConfig, ScenarioConfig, TransformerState, OperatingState } from './types';

// Simple seeded PRNG (Mulberry32) for reproducible data generation
export function createPRNG(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for Gaussian noise
export function gaussianNoise(prng: () => number, mean = 0, stdev = 1): number {
  const u1 = Math.max(1e-7, prng());
  const u2 = prng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdev;
}

export class PhysicsSimulationEngine {
  private prng: () => number;

  constructor(seed: number = 42) {
    this.prng = createPRNG(seed);
  }

  public setSeed(seed: number) {
    this.prng = createPRNG(seed);
  }

  /**
   * Evaluates the load percentage at time step t (in seconds) based on scenario profile
   */
  public calculateScenarioTargetLoad(
    t: number,
    config: ScenarioConfig
  ): { targetLoad: number; isFaultActive: boolean; isSagActive: boolean } {
    const {
      scenarioType,
      initialLoadPercent,
      peakLoadPercent,
      durationSeconds,
      rampTimeSeconds,
      faultInjection,
      faultStartTimeSeconds,
      faultDurationSeconds,
    } = config;

    let targetLoad = initialLoadPercent;
    let isFaultActive = false;
    let isSagActive = false;

    // Check fault injection window
    if (faultInjection && t >= faultStartTimeSeconds && t < faultStartTimeSeconds + faultDurationSeconds) {
      isFaultActive = true;
    }

    switch (scenarioType) {
      case 'NORMAL_OPERATION': {
        const cycle = Math.sin((t / durationSeconds) * Math.PI * 2);
        targetLoad = initialLoadPercent + cycle * 5.0;
        break;
      }

      case 'LOAD_RAMP': {
        if (t <= rampTimeSeconds) {
          const progress = t / rampTimeSeconds;
          targetLoad = initialLoadPercent + (peakLoadPercent - initialLoadPercent) * progress;
        } else {
          targetLoad = peakLoadPercent;
        }
        break;
      }

      case 'MORNING_PEAK': {
        const midPoint = durationSeconds * 0.4;
        const width = durationSeconds * 0.25;
        const surge = Math.exp(-Math.pow((t - midPoint) / width, 2));
        targetLoad = initialLoadPercent + (peakLoadPercent - initialLoadPercent) * surge;
        break;
      }

      case 'EVENING_PEAK': {
        const midPoint = durationSeconds * 0.6;
        const width = durationSeconds * 0.3;
        const surge = Math.exp(-Math.pow((t - midPoint) / width, 2));
        targetLoad = initialLoadPercent + (peakLoadPercent - initialLoadPercent) * surge;
        break;
      }

      case 'SUDDEN_LOAD_INCREASE': {
        const stepTime = rampTimeSeconds || 10;
        if (t < stepTime) {
          targetLoad = initialLoadPercent;
        } else {
          targetLoad = peakLoadPercent;
        }
        break;
      }

      case 'SUSTAINED_OVERLOAD': {
        if (t < 30) {
          targetLoad = initialLoadPercent + (peakLoadPercent - initialLoadPercent) * (t / 30);
        } else {
          targetLoad = peakLoadPercent;
        }
        break;
      }

      case 'VOLTAGE_SAG': {
        targetLoad = initialLoadPercent;
        if (t >= 30 && t <= 120) {
          isSagActive = true;
        }
        break;
      }

      case 'THERMAL_STRESS': {
        targetLoad = initialLoadPercent + (t / durationSeconds) * (peakLoadPercent - initialLoadPercent);
        break;
      }

      case 'INTERMITTENT_ANOMALY': {
        targetLoad = initialLoadPercent;
        if ((t % 40 >= 15 && t % 40 <= 25) || isFaultActive) {
          targetLoad = peakLoadPercent;
        }
        break;
      }

      case 'FAULT_EVENT': {
        if (isFaultActive) {
          targetLoad = peakLoadPercent;
        } else if (t >= faultStartTimeSeconds + faultDurationSeconds) {
          targetLoad = 25.0;
        } else {
          targetLoad = initialLoadPercent;
        }
        break;
      }

      case 'RECOVERY': {
        if (t <= config.recoveryTimeSeconds) {
          const progress = t / config.recoveryTimeSeconds;
          targetLoad = initialLoadPercent - (initialLoadPercent - peakLoadPercent) * progress;
        } else {
          targetLoad = peakLoadPercent;
        }
        break;
      }
    }

    if (isFaultActive && scenarioType !== 'FAULT_EVENT') {
      targetLoad = Math.max(targetLoad, 135.0);
    }

    return { targetLoad, isFaultActive, isSagActive };
  }

  public step(
    t: number,
    transformer: TransformerConfig,
    scenario: ScenarioConfig,
    prevState: TransformerState | null,
    runId: string,
    loadOffsetPercent: number = 0 // per-transformer adjustment (disturbance / transferred load), used by the grid twin
  ): TransformerState {
    const scenarioTarget = this.calculateScenarioTargetLoad(t, scenario);
    const { isFaultActive, isSagActive } = scenarioTarget;
    const targetLoad = scenarioTarget.targetLoad + loadOffsetPercent;

    const noiseLevel = scenario.noiseLevelPercent / 100;
    const loadNoise = gaussianNoise(this.prng, 0, noiseLevel * 2.0);
    const actualLoadPercent = Math.max(5, Math.min(200, targetLoad + loadNoise));

    let baseVoltageKV = transformer.primaryVoltageKV;
    if (isSagActive) {
      baseVoltageKV *= 1 + scenario.voltageVariationPercent / 100;
    } else {
      const voltageDrop = (actualLoadPercent / 100) * 0.025 * transformer.primaryVoltageKV;
      const vNoise = gaussianNoise(this.prng, 0, noiseLevel * 0.05);
      baseVoltageKV = transformer.primaryVoltageKV - voltageDrop + vNoise;
    }
    if (isFaultActive) {
      baseVoltageKV *= 0.85;
    }
    const voltageKV = Math.max(0.1, Number(baseVoltageKV.toFixed(3)));

    let basePF = scenario.powerFactor || transformer.initialPowerFactor;
    if (actualLoadPercent > 100) {
      basePF -= (actualLoadPercent - 100) * 0.0015;
    }
    if (isFaultActive) {
      basePF = Math.max(0.60, basePF - 0.20);
    }
    const pfNoise = gaussianNoise(this.prng, 0, noiseLevel * 0.005);
    const powerFactor = Math.max(0.50, Math.min(0.99, Number((basePF + pfNoise).toFixed(3))));

    const activeLoadMVA = (actualLoadPercent / 100) * transformer.ratedCapacityMVA;
    let currentA = (activeLoadMVA * 1000) / (Math.sqrt(3) * voltageKV);
    if (isFaultActive) {
      currentA *= 1.5 + (scenario.faultSeverity / 10);
    }
    const currentNoise = gaussianNoise(this.prng, 0, noiseLevel * 5.0);
    currentA = Math.max(0, Number((currentA + currentNoise).toFixed(1)));

    let powerKW = Math.sqrt(3) * voltageKV * currentA * powerFactor;
    if (powerKW < 0) powerKW = 0;
    powerKW = Number(powerKW.toFixed(1));

    const ambientTemp = scenario.ambientTempC || transformer.ambientTempC;
    const deltaTNoLoad = 15.0;
    const deltaTRated = 45.0;
    const stressFactor = scenario.thermalStressFactor || 1.0;

    const steadyStateTemp =
      ambientTemp +
      deltaTNoLoad +
      deltaTRated * Math.pow(actualLoadPercent / 100, 1.8) * stressFactor +
      (isFaultActive ? scenario.faultSeverity * 3.0 : 0);

    let transformerTemp: number;
    if (prevState === null) {
      transformerTemp = ambientTemp + (deltaTRated * (transformer.initialLoadPercent / 100));
    } else {
      const tau = (transformer.thermalTimeConstantMinutes * 60) / 10;
      const dT = (steadyStateTemp - prevState.transformerTemperatureC) / Math.max(1, tau);
      const tempNoise = gaussianNoise(this.prng, 0, 0.05);
      transformerTemp = prevState.transformerTemperatureC + dT + tempNoise;
    }
    transformerTemp = Math.max(ambientTemp, Number(transformerTemp.toFixed(2)));

    let prevHealth = prevState ? prevState.healthIndex : 100.0;
    let agingRate = 0.0001;
    if (transformerTemp >= 85) {
      agingRate += Math.exp((transformerTemp - 85) / 8) * 0.005;
    }
    if (actualLoadPercent > 100) {
      agingRate += Math.pow((actualLoadPercent - 100) / 10, 2) * 0.01;
    }
    if (isFaultActive) {
      agingRate += 0.1 * scenario.faultSeverity;
    }

    let newHealth = prevHealth - agingRate;
    if (scenario.scenarioType === 'RECOVERY' && transformerTemp < 65 && actualLoadPercent < 60) {
      newHealth += 0.002;
    }
    newHealth = Math.max(10.0, Math.min(100.0, Number(newHealth.toFixed(2))));

    let operatingState: OperatingState = 'NORMAL';
    let anomaly: 0 | 1 = 0;
    let overload: 0 | 1 = 0;
    let fault: 0 | 1 = 0;
    let eventType = 'NORMAL_OPERATION';

    if (isFaultActive || (scenario.scenarioType === 'FAULT_EVENT' && t >= scenario.faultStartTimeSeconds && t < scenario.faultStartTimeSeconds + scenario.faultDurationSeconds)) {
      operatingState = 'FAULT';
      anomaly = 1;
      overload = 1;
      fault = 1;
      eventType = 'CRITICAL_FAULT_INJECTION';
    } else if (actualLoadPercent >= 115 || transformerTemp >= 105) {
      operatingState = 'OVERLOAD';
      anomaly = 1;
      overload = 1;
      eventType = 'CRITICAL_TRANSFORMER_OVERLOAD';
    } else if (actualLoadPercent >= 100 || transformerTemp >= 90) {
      operatingState = 'HIGH_STRESS';
      anomaly = 1;
      eventType = 'HIGH_THERMAL_ELEVATION';
    } else if (actualLoadPercent >= 85 || transformerTemp >= 75 || isSagActive) {
      operatingState = 'WARNING';
      anomaly = 1;
      eventType = isSagActive ? 'GRID_VOLTAGE_SAG' : 'HIGH_LOADING_WARNING';
    } else if (scenario.scenarioType === 'RECOVERY' || (prevState && (prevState.operatingState === 'FAULT' || prevState.operatingState === 'OVERLOAD') && actualLoadPercent < 80)) {
      operatingState = 'RECOVERY';
      eventType = 'THERMAL_COOLING_RECOVERY';
    }

    const hours = Math.floor(t / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(t % 60).toString().padStart(2, '0');
    const formattedTimestamp = `${hours}:${minutes}:${seconds}`;

    return {
      timestamp: formattedTimestamp,
      stepIndex: t,
      transformerId: transformer.id,
      ratedCapacityMVA: transformer.ratedCapacityMVA,
      voltageKV: voltageKV,
      currentA: currentA,
      powerKW: powerKW,
      powerFactor: powerFactor,
      loadPercent: Number(actualLoadPercent.toFixed(2)),
      ambientTemperatureC: Number(ambientTemp.toFixed(1)),
      transformerTemperatureC: transformerTemp,
      healthIndex: newHealth,
      operatingState: operatingState,
      anomaly: anomaly,
      overload: overload,
      fault: fault,
      eventType: eventType,
      scenario: scenario.scenarioType,
      simulationRunId: runId,
    };
  }

  public runSimulationScenario(
    transformer: TransformerConfig,
    scenario: ScenarioConfig,
    runId: string = 'RUN-001'
  ): TransformerState[] {
    const states: TransformerState[] = [];
    let currentState: TransformerState | null = null;

    for (let t = 0; t <= scenario.durationSeconds; t += scenario.samplingIntervalSeconds) {
      currentState = this.step(t, transformer, scenario, currentState, runId);
      states.push(currentState);
    }

    return states;
  }
}
