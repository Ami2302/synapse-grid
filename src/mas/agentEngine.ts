import type { TransformerState, TransformerConfig } from '../simulation/types';
import type { TransformerAgentState, AgentMessage, AgentAction } from './types';
import { FuzzyLogicEngine } from '../ml/fuzzyEngine';
import { modelRegistry } from '../ml/modelRegistry';
import type { OperatingState } from '../simulation/types';

const SEVERITY: Record<OperatingState, number> = {
  NORMAL: 0,
  RECOVERY: 0,
  WARNING: 1,
  HIGH_STRESS: 2,
  OVERLOAD: 3,
  FAULT: 4,
};

export class MultiAgentEngine {
  private agentsMap: Record<string, TransformerAgentState> = {};
  private messageBus: AgentMessage[] = [];

  constructor(transformers: Record<string, TransformerConfig>, states: Record<string, TransformerState>) {
    this.updateAgents(transformers, states);
  }

  public updateAgents(
    transformers: Record<string, TransformerConfig>,
    states: Record<string, TransformerState>
  ): Record<string, TransformerAgentState> {
    const hybrid = modelRegistry.get().hybridModel;

    Object.keys(transformers).forEach((id) => {
      const config = transformers[id];
      const state = states[id];

      if (state) {
        // Evaluate AI Fuzzy Risk Score dynamically
        const fuzzyRes = FuzzyLogicEngine.infer(
          state.loadPercent,
          state.transformerTemperatureC,
          state.voltageKV
        );

        // Headroom capacity to 85% warning threshold
        const targetThreshold = 85.0;
        const headroomPercent = Math.max(0, targetThreshold - state.loadPercent);
        const headroomMVA = Number(((headroomPercent / 100) * config.ratedCapacityMVA).toFixed(2));

        // Hybrid Fuzzy-Neural live prediction (only once the model has been trained on the dataset)
        const prediction = hybrid ? hybrid.predictState(state) : null;

        // Agents act on the more severe of measured state and AI-predicted state (escalate only, never relax)
        const decisionState: OperatingState =
          prediction && SEVERITY[prediction.operatingState] > SEVERITY[state.operatingState]
            ? prediction.operatingState
            : state.operatingState;

        let action: AgentAction = 'NORMAL_MONITORING';
        let status: TransformerAgentState['status'] = 'ONLINE';

        if (decisionState === 'OVERLOAD' || decisionState === 'FAULT') {
          action = 'REQUEST_CAPACITY_SUPPORT';
          status = 'CRITICAL';
        } else if (decisionState === 'HIGH_STRESS') {
          action = 'COOLING_ACTIVATION';
          status = 'COMMUNICATING';
        } else if (headroomPercent > 15) {
          action = 'PROVIDE_LOAD_SUPPORT';
          status = 'ONLINE';
        }

        this.agentsMap[id] = {
          agentId: `AGENT-${id}`,
          transformerId: id,
          name: config.name,
          substation: config.substation,
          ratedCapacityMVA: config.ratedCapacityMVA,
          currentLoadPercent: state.loadPercent,
          transformerTempC: state.transformerTemperatureC,
          healthIndex: state.healthIndex,
          operatingState: state.operatingState,
          riskScore: fuzzyRes.riskScore,
          predictedTempC: Number((state.transformerTemperatureC + (state.loadPercent > 100 ? 3.5 : 0.2)).toFixed(1)),
          predictedState: prediction ? prediction.operatingState : null,
          predictionConfidence: prediction ? prediction.confidence : null,
          predictionSource: prediction ? 'HYBRID' : 'NONE',
          availableCapacityPercent: Number(headroomPercent.toFixed(1)),
          availableCapacityMVA: headroomMVA,
          recommendedAction: action,
          status,
        };
      }
    });

    return this.agentsMap;
  }

  public getAgents(): Record<string, TransformerAgentState> {
    return this.agentsMap;
  }

  public getMessageBus(): AgentMessage[] {
    return this.messageBus;
  }

  public addMessage(msg: Omit<AgentMessage, 'id'>): AgentMessage {
    const fullMsg: AgentMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.messageBus = [fullMsg, ...this.messageBus.slice(0, 49)];
    return fullMsg;
  }

  public clearMessages() {
    this.messageBus = [];
  }
}
