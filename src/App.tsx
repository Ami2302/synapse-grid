import { useState, useEffect, useRef, useMemo } from 'react';
import { Header, type ActiveTab } from './components/Header';
import { SimulationControls } from './components/SimulationControls';
import { DigitalTwinVisualizer } from './components/DigitalTwinVisualizer';
import { DigitalTwin3DVisualizer } from './components/DigitalTwin3DVisualizer';
import { MultiTransformerGrid } from './components/MultiTransformerGrid';
import { LiveTwinStatePanel } from './components/LiveTwinStatePanel';
import { RealtimeAnalyticsCharts } from './components/RealtimeAnalyticsCharts';
import { EventTimelineAlerts } from './components/EventTimelineAlerts';
import { ScenarioBuilder } from './components/ScenarioBuilder';
import { DatasetGeneratorPanel } from './components/DatasetGeneratorPanel';
import { DatasetQualityAndPreview } from './components/DatasetQualityAndPreview';
import { SoftComputingWorkspace } from './components/SoftComputingWorkspace';
import { GridTwinPage } from './components/GridTwinPage';
import { useModelRegistry } from './ml/modelRegistry';
import { MultiAgentSystemWorkspace } from './components/MultiAgentSystemWorkspace';
import { SelfHealingWorkspace } from './components/SelfHealingWorkspace';
import { SystemOverviewDashboard } from './components/SystemOverviewDashboard';

import type { 
  TransformerConfig, 
  ScenarioConfig, 
  TransformerState, 
  DatasetRecord, 
  DatasetQuality, 
  SimulationEventLog, 
  ScenarioType 
} from './simulation/types';
import { DEFAULT_TRANSFORMERS, DEFAULT_SCENARIO_CONFIGS } from './simulation/initialData';
import { PhysicsSimulationEngine } from './simulation/physicsEngine';
import { DatasetEngine } from './simulation/datasetEngine';
import { MultiAgentEngine } from './mas/agentEngine';
import { SelfHealingEngine, type SelfHealingResult } from './mas/selfHealingEngine';
import type { SelfHealingActionRecord } from './mas/types';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grid-twin');
  const [visualMode, setVisualMode] = useState<'3d' | '2d'>('3d');

  const [selectedId, setSelectedId] = useState<string>('T1');
  const [transformers, setTransformers] = useState<Record<string, TransformerConfig>>(DEFAULT_TRANSFORMERS);
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(DEFAULT_SCENARIO_CONFIGS['NORMAL_OPERATION']);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(0);

  const [statesMap, setStatesMap] = useState<Record<string, TransformerState>>({});
  const [history, setHistory] = useState<TransformerState[]>([]);
  const [eventLogs, setEventLogs] = useState<SimulationEventLog[]>([]);

  const [dataset, setDataset] = useState<DatasetRecord[]>([]);
  const [quality, setQuality] = useState<DatasetQuality | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genCurrentRun, setGenCurrentRun] = useState<string>('');

  // Self-Healing Engine state
  const [selfHealingLogs, setSelfHealingLogs] = useState<SelfHealingActionRecord[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<SelfHealingResult['pipelineSteps']>([]);

  const engineRef = useRef<PhysicsSimulationEngine>(new PhysicsSimulationEngine(scenarioConfig.randomSeed));
  const masEngineRef = useRef<MultiAgentEngine>(new MultiAgentEngine(transformers, statesMap));

  // Initialize digital twin environment
  useEffect(() => {
    const engine = engineRef.current;
    const initialMap: Record<string, TransformerState> = {};
    const initLogs: SimulationEventLog[] = [];

    Object.keys(DEFAULT_TRANSFORMERS).forEach((id) => {
      const trans = DEFAULT_TRANSFORMERS[id];
      const initialState = engine.step(0, trans, scenarioConfig, null, 'INIT-RUN');
      initialMap[id] = initialState;
    });

    setStatesMap(initialMap);
    if (initialMap['T1']) {
      setHistory([initialMap['T1']]);
    }

    masEngineRef.current.updateAgents(DEFAULT_TRANSFORMERS, initialMap);

    initLogs.push({
      id: `log-init`,
      timestamp: '00:00:00',
      stepIndex: 0,
      transformerId: 'ALL',
      severity: 'info',
      operatingState: 'NORMAL',
      message: 'Synapse Grid Platform initialized. Digital Twin simulation & Multi-Agent Network ready.',
    });
    setEventLogs(initLogs);
  }, []);

  // Update Multi-Agent Engine whenever statesMap or transformers change
  // Re-evaluate agents when a newly trained hybrid model is published
  const { hybridModel } = useModelRegistry();
  const currentAgents = useMemo(() => {
    return masEngineRef.current.updateAgents(transformers, statesMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformers, statesMap, hybridModel]);

  // Main simulation loop
  useEffect(() => {
    let interval: any = null;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setSimTime((prevTime) => {
          const nextTime = prevTime + scenarioConfig.samplingIntervalSeconds;
          const engine = engineRef.current;
          const newStatesMap: Record<string, TransformerState> = {};
          const newRecords: DatasetRecord[] = [];

          Object.keys(transformers).forEach((id) => {
            const transConfig = transformers[id];
            const prevState = statesMap[id] || null;
            const nextState = engine.step(nextTime, transConfig, scenarioConfig, prevState, 'SIM-LIVE');
            newStatesMap[id] = nextState;

            newRecords.push(DatasetEngine.toDatasetRecord(nextState));

            if (!prevState || prevState.operatingState !== nextState.operatingState) {
              const severity =
                nextState.operatingState === 'FAULT' || nextState.operatingState === 'OVERLOAD'
                  ? 'critical'
                  : nextState.operatingState === 'HIGH_STRESS'
                  ? 'caution'
                  : nextState.operatingState === 'WARNING'
                  ? 'warning'
                  : nextState.operatingState === 'RECOVERY'
                  ? 'recovery'
                  : 'info';

              setEventLogs((prevLogs) => [
                {
                  id: `log-${Date.now()}-${id}`,
                  timestamp: nextState.timestamp,
                  stepIndex: nextTime,
                  transformerId: id,
                  severity,
                  operatingState: nextState.operatingState,
                  message: `Transformer ${id} state changed to ${nextState.operatingState} (${nextState.eventType})`,
                },
                ...prevLogs,
              ]);
            }
          });

          setStatesMap(newStatesMap);

          if (newStatesMap[selectedId]) {
            setHistory((prevHist) => [...prevHist, newStatesMap[selectedId]]);
          }

          setDataset((prevData) => {
            const updated = [...prevData, ...newRecords];
            setQuality(DatasetEngine.analyzeDatasetQuality(updated));
            return updated;
          });

          if (nextTime >= scenarioConfig.durationSeconds) {
            setIsRunning(false);
            setEventLogs((prevLogs) => [
              {
                id: `log-end-${Date.now()}`,
                timestamp: newStatesMap[selectedId]?.timestamp || '00:00:00',
                stepIndex: nextTime,
                transformerId: 'ALL',
                severity: 'info',
                operatingState: 'NORMAL',
                message: `Scenario '${scenarioConfig.name}' completed (${scenarioConfig.durationSeconds}s duration).`,
              },
              ...prevLogs,
            ]);
          }

          return nextTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, scenarioConfig, transformers, statesMap, selectedId]);

  const handleStart = () => {
    engineRef.current.setSeed(scenarioConfig.randomSeed);
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setSimTime(0);
    setHistory([]);
    engineRef.current.setSeed(scenarioConfig.randomSeed);

    const initialMap: Record<string, TransformerState> = {};
    Object.keys(transformers).forEach((id) => {
      const trans = transformers[id];
      const initialState = engineRef.current.step(0, trans, scenarioConfig, null, 'INIT-RUN');
      initialMap[id] = initialState;
    });

    setStatesMap(initialMap);
    masEngineRef.current.updateAgents(transformers, initialMap);
    if (initialMap[selectedId]) {
      setHistory([initialMap[selectedId]]);
    }
  };

  const handleInjectFault = () => {
    const updatedScenario: ScenarioConfig = {
      ...scenarioConfig,
      faultInjection: true,
      faultStartTimeSeconds: simTime,
      faultDurationSeconds: 45,
      faultSeverity: 9,
      peakLoadPercent: 145,
    };
    setScenarioConfig(updatedScenario);
    setEventLogs((prev) => [
      {
        id: `fault-trigger-${Date.now()}`,
        timestamp: statesMap[selectedId]?.timestamp || '00:00:00',
        stepIndex: simTime,
        transformerId: selectedId,
        severity: 'critical',
        operatingState: 'FAULT',
        message: `MANUAL FAULT INJECTION: Phase fault & severe thermal surge triggered on ${selectedId}!`,
      },
      ...prev,
    ]);
  };

  // Trigger Self-Healing Event logic
  const handleSimulateOverloadEvent = (transformerId: string) => {
    // 1. Force overloaded state on target transformer
    const currentTransState = statesMap[transformerId] || {
      loadPercent: 118.5,
      transformerTemperatureC: 84.5,
      voltageKV: 10.8,
    };

    const overloadedState: TransformerState = {
      ...currentTransState,
      transformerId,
      loadPercent: 118.5,
      transformerTemperatureC: 84.5,
      operatingState: 'OVERLOAD',
      anomaly: 1,
      overload: 1,
      fault: 0,
      eventType: 'SUSTAINED_OVERLOAD',
      timestamp: new Date().toISOString().substring(11, 19)
    };

    const tempMap = { ...statesMap, [transformerId]: overloadedState };
    setStatesMap(tempMap);

    // 2. Execute Self-Healing Engine
    const agentsMap = masEngineRef.current.updateAgents(transformers, tempMap);
    const result = SelfHealingEngine.executeSelfHealing(transformerId, agentsMap, masEngineRef.current, transformers);

    // 3. Apply state updates to Digital Twin map
    const finalMap = { ...tempMap };
    Object.keys(result.updatedStates).forEach((id) => {
      if (finalMap[id]) {
        finalMap[id] = { ...finalMap[id], ...result.updatedStates[id] };
      }
    });

    setStatesMap(finalMap);
    masEngineRef.current.updateAgents(transformers, finalMap);

    // 4. Record logs and pipeline steps
    setSelfHealingLogs((prev) => [...result.logs, ...prev]);
    setPipelineSteps(result.pipelineSteps);

    // 5. Add event log to timeline
    setEventLogs((prev) => [
      {
        id: `sh-event-${Date.now()}`,
        timestamp: new Date().toISOString().substring(11, 19),
        stepIndex: simTime,
        transformerId,
        severity: 'recovery',
        operatingState: 'RECOVERY',
        message: `AUTONOMOUS SELF-HEALING EXECUTED: Overload on ${transformerId} mitigated via P2P load transfer.`,
      },
      ...prev,
    ]);

    setActiveTab('self-healing');
  };

  const handleStartBatchGeneration = (
    transformersCount: number,
    runsPerScenario: Record<ScenarioType, number>,
    seed: number
  ) => {
    setIsGenerating(true);
    setGenProgress(0);

    const activeTransformers = Object.values(transformers).slice(0, transformersCount);
    const scenarioDist = Object.keys(runsPerScenario).map((scType) => ({
      scenarioType: scType as ScenarioType,
      runsCount: runsPerScenario[scType as ScenarioType],
    }));

    setTimeout(() => {
      const generated = DatasetEngine.generateBatchDataset(
        activeTransformers,
        scenarioDist,
        seed,
        (progressPercent, currentRun) => {
          setGenProgress(progressPercent);
          setGenCurrentRun(currentRun);
        }
      );

      setDataset(generated);
      const qMetrics = DatasetEngine.analyzeDatasetQuality(generated);
      setQuality(qMetrics);
      setIsGenerating(false);
      setActiveTab('data-preview');
    }, 100);
  };

  const handleExportCSV = () => {
    const csvData = DatasetEngine.exportToCSV(
      dataset.length > 0
        ? dataset
        : history.map((st) => DatasetEngine.toDatasetRecord(st, activeTransformerConfig))
    );
    DatasetEngine.downloadFile(csvData, 'SynapseGrid_DigitalTwin_Dataset.csv', 'text/csv;charset=utf-8;');
  };

  const activeState = statesMap[selectedId]?.operatingState || 'NORMAL';
  const activeTransformerConfig = transformers[selectedId] || DEFAULT_TRANSFORMERS['T1'];
  const activeTransformerState = statesMap[selectedId] || {
    timestamp: '00:00:00',
    stepIndex: 0,
    transformerId: selectedId,
    ratedCapacityMVA: activeTransformerConfig.ratedCapacityMVA,
    voltageKV: activeTransformerConfig.primaryVoltageKV,
    currentA: 0,
    powerKW: 0,
    powerFactor: 0.95,
    loadPercent: activeTransformerConfig.initialLoadPercent,
    ambientTemperatureC: activeTransformerConfig.ambientTempC,
    transformerTemperatureC: 55,
    healthIndex: 100,
    operatingState: 'NORMAL',
    anomaly: 0,
    overload: 0,
    fault: 0,
    eventType: 'NORMAL_OPERATION',
    scenario: scenarioConfig.scenarioType,
    simulationRunId: 'INIT-RUN',
  };

  return (
    <div className={`${activeTab === 'grid-twin' ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-[#0B0F14] text-slate-100 flex flex-col font-sans`}>
      <Header
        simulationActive={isRunning && !isPaused}
        simulationTime={simTime}
        activeState={activeState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetCount={dataset.length}
      />

      {/* kept mounted so the twin keeps its state when other tabs are opened */}
      <div className={`flex-1 min-h-0 ${activeTab === 'grid-twin' ? '' : 'hidden'}`}>
        <GridTwinPage />
      </div>

      <main className={`flex-1 p-4 max-w-[1920px] w-full mx-auto space-y-4 ${activeTab === 'grid-twin' ? 'hidden' : ''}`}>
        {activeTab === 'overview' && (
          <SystemOverviewDashboard
            currentConfig={activeTransformerConfig}
            currentState={activeTransformerState}
            agents={currentAgents}
            messages={masEngineRef.current.getMessageBus()}
            selfHealingLogs={selfHealingLogs}
            onNavigateTab={setActiveTab}
            onSimulateOverload={handleSimulateOverloadEvent}
          />
        )}

        {activeTab === 'digital-twin' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-3">
                <SimulationControls
                  selectedTransformerId={selectedId}
                  setSelectedTransformerId={setSelectedId}
                  transformerConfig={activeTransformerConfig}
                  setTransformerConfig={(cfg) => setTransformers({ ...transformers, [selectedId]: cfg })}
                  scenarioConfig={scenarioConfig}
                  setScenarioConfig={setScenarioConfig}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onReset={handleReset}
                  onGenerateDataset={() => setActiveTab('dataset-generator')}
                  onExportCSV={handleExportCSV}
                  onInjectFault={handleInjectFault}
                />
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between bg-[#111827] border border-[#172033] px-3 py-1.5 rounded-lg text-xs font-mono">
                  <span className="text-[11px] text-slate-400 uppercase font-bold">
                    VISUAL DISPLAY CENTER:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setVisualMode('3d')}
                      className={`px-3 py-1 rounded font-bold text-xs transition-all ${
                        visualMode === '3d'
                          ? 'bg-[#5B7C99]/30 text-white border border-[#5B7C99] shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      3D REAL-TIME TWIN
                    </button>
                    <button
                      onClick={() => setVisualMode('2d')}
                      className={`px-3 py-1 rounded font-bold text-xs transition-all ${
                        visualMode === '2d'
                          ? 'bg-[#5B7C99]/30 text-white border border-[#5B7C99] shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      2D SCHEMATIC
                    </button>
                  </div>
                </div>

                {visualMode === '3d' ? (
                  <DigitalTwin3DVisualizer
                    state={activeTransformerState}
                    config={activeTransformerConfig}
                  />
                ) : (
                  <DigitalTwinVisualizer
                    state={activeTransformerState}
                    config={activeTransformerConfig}
                  />
                )}
              </div>

              <div className="lg:col-span-3">
                <LiveTwinStatePanel
                  state={activeTransformerState}
                  config={activeTransformerConfig}
                />
              </div>
            </div>

            <MultiTransformerGrid
              transformersStates={statesMap}
              selectedTransformerId={selectedId}
              onSelectTransformer={setSelectedId}
            />

            <EventTimelineAlerts
              logs={eventLogs}
              activeState={activeState}
              onClearLogs={() => setEventLogs([])}
            />

            <RealtimeAnalyticsCharts
              history={history}
              onResetHistory={() => setHistory([])}
            />
          </div>
        )}

        {activeTab === 'scenario-builder' && (
          <ScenarioBuilder
            config={scenarioConfig}
            onChangeConfig={setScenarioConfig}
            onApplyAndRun={(cfg) => {
              setScenarioConfig(cfg);
              setActiveTab('digital-twin');
              handleReset();
              handleStart();
            }}
          />
        )}

        {activeTab === 'dataset-generator' && (
          <DatasetGeneratorPanel
            onStartBatchGeneration={handleStartBatchGeneration}
            isGenerating={isGenerating}
            progressPercent={genProgress}
            currentRunInfo={genCurrentRun}
            generatedRecordsCount={dataset.length}
          />
        )}

        {activeTab === 'data-preview' && (
          <DatasetQualityAndPreview
            records={dataset}
            quality={quality}
          />
        )}

        {activeTab === 'soft-computing' && (
          <SoftComputingWorkspace
            dataset={dataset.length > 0 ? dataset : history.map((st) => DatasetEngine.toDatasetRecord(st, activeTransformerConfig))}
            onNavigateToDatasetGen={() => setActiveTab('dataset-generator')}
          />
        )}

        {activeTab === 'multi-agent' && (
          <MultiAgentSystemWorkspace
            agents={currentAgents}
            messages={masEngineRef.current.getMessageBus()}
            onTriggerSelfHealing={handleSimulateOverloadEvent}
          />
        )}

        {activeTab === 'self-healing' && (
          <SelfHealingWorkspace
            agents={currentAgents}
            selfHealingLogs={selfHealingLogs}
            activePipelineSteps={pipelineSteps}
            onSimulateOverloadEvent={handleSimulateOverloadEvent}
            onResetGrid={handleReset}
          />
        )}
      </main>

      <footer className={`bg-[#111827] border-t border-[#172033] py-2.5 px-4 text-xs font-mono text-slate-400 ${activeTab === 'grid-twin' ? 'hidden' : ''}`}>
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>SYNAPSE GRID</strong> — Multi-Agent Edge Intelligence for Smart Distribution Networks Platform
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>GRID STATE: <strong className="text-[#5B7C99]">{activeState}</strong></span>
            <span>DATASET RECORDS: <strong className="text-white">{dataset.length}</strong></span>
            <span>SIMULATION ENGINE: <strong className="text-[#5E9C76]">IEEE 757 / IEC 60076-7 SIM</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
