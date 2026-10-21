import type { OperatingState } from '../simulation/types';

export type AgentAction = 
  | 'NORMAL_MONITORING'
  | 'REQUEST_CAPACITY_SUPPORT'
  | 'PROVIDE_LOAD_SUPPORT'
  | 'EMERGENCY_SHEDDING'
  | 'COOLING_ACTIVATION';

export interface TransformerAgentState {
  agentId: string; // 'AGENT-T1', 'AGENT-T2', etc.
  transformerId: string; // 'T1', 'T2', 'T3', 'T4'
  name: string;
  substation: string;
  ratedCapacityMVA: number;
  currentLoadPercent: number;
  transformerTempC: number;
  healthIndex: number;
  operatingState: OperatingState;
  
  // AI Derived Telemetry
  riskScore: number; // 0 to 100 from Fuzzy/ANN
  predictedTempC: number; // from LSTM
  predictedState: OperatingState | null; // Hybrid Fuzzy-Neural live prediction (null until the model is trained)
  predictionConfidence: number | null; // 0–1, highest fused class probability
  predictionSource: 'HYBRID' | 'NONE';
  
  // MAS Capacity Tracking
  availableCapacityPercent: number; // Headroom to 85% warning threshold
  availableCapacityMVA: number;
  recommendedAction: AgentAction;
  status: 'ONLINE' | 'COMMUNICATING' | 'REALLOCATING' | 'CRITICAL';
}

export type MessageType = 
  | 'ALERT_BROADCAST'
  | 'CAPACITY_INQUIRY'
  | 'CAPACITY_OFFER'
  | 'LOAD_TRANSFER_REQUEST'
  | 'LOAD_TRANSFER_CONFIRM'
  | 'CONSENSUS_REACHED';

export interface AgentMessage {
  id: string;
  timestamp: string;
  sourceAgentId: string;
  destAgentId: string; // 'NETWORK_BUS' or specific agent ID
  messageType: MessageType;
  riskScore: number;
  payloadMessage: string;
  status: 'SENT' | 'DELIVERED' | 'EXECUTED';
}

export interface SelfHealingActionRecord {
  id: string;
  timestamp: string;
  eventType: string;
  affectedAgentId: string;
  supportAgentId: string;
  actionTaken: string;
  loadBeforePercent: number;
  loadAfterPercent: number;
  tempBeforeC: number;
  tempAfterC: number;
  resultStatus: 'RECOVERED' | 'STABILIZED' | 'IN_PROGRESS';
}
