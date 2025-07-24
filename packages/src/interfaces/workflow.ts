import { IPlugin } from "./plugin.js";
import { Dataset } from "./data-processor.js";

export interface IWorkflowPlugin extends IPlugin {
  // Workflow Management
  createWorkflow(definition: WorkflowDefinition): Promise<Workflow>;
  executeWorkflow(workflowId: string, input: any, options?: WorkflowExecutionOptions): Promise<WorkflowResult>;
  pauseWorkflow(workflowId: string): Promise<void>;
  resumeWorkflow(workflowId: string): Promise<void>;
  stopWorkflow(workflowId: string): Promise<void>;
  deleteWorkflow(workflowId: string): Promise<void>;

  // Workflow Queries
  getWorkflow(workflowId: string): Promise<Workflow>;
  listWorkflows(filter?: WorkflowFilter): Promise<Workflow[]>;
  getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
  getWorkflowHistory(workflowId: string): Promise<WorkflowExecution[]>;

  // Agent Management
  registerAgent(agent: AnalyticsAgent): Promise<string>;
  unregisterAgent(agentId: string): Promise<void>;
  getAgent(agentId: string): Promise<AnalyticsAgent>;
  listAgents(filter?: AgentFilter): Promise<AnalyticsAgent[]>;
  configureAgentCapabilities(agentId: string, capabilities: AgentCapabilities): Promise<void>;

  // State Management
  saveWorkflowState(workflowId: string, state: WorkflowState): Promise<void>;
  loadWorkflowState(workflowId: string): Promise<WorkflowState>;
  clearWorkflowState(workflowId: string): Promise<void>;

  // Monitoring and Debugging
  getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics>;
  getExecutionTrace(workflowId: string, executionId: string): Promise<ExecutionTrace>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryPoint: string;
  variables?: WorkflowVariable[];
  configuration?: WorkflowConfiguration;
  metadata?: WorkflowMetadata;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  agentId?: string;
  configuration: any;
  inputSchema?: any;
  outputSchema?: any;
  conditions?: WorkflowCondition[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export type WorkflowNodeType = 
  | "agent" 
  | "condition" 
  | "parallel" 
  | "data-operation" 
  | "wait" 
  | "merge" 
  | "split";

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
  weight?: number;
  metadata?: any;
}

export interface WorkflowCondition {
  expression: string;
  description?: string;
  errorMessage?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  retryConditions?: string[];
}

export interface WorkflowVariable {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface WorkflowConfiguration {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  parallelismLimit?: number;
  errorHandling?: "stop" | "continue" | "retry";
  debugMode?: boolean;
  [key: string]: any;
}

export interface WorkflowMetadata {
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  tags?: string[];
  category?: string;
  version: string;
  [key: string]: any;
}

export interface Workflow {
  definition: WorkflowDefinition;
  state: WorkflowState;
  status: WorkflowStatus;
  executionHistory: WorkflowExecution[];
  metrics: WorkflowMetrics;
}

export interface WorkflowState {
  currentNode?: string;
  nodeStates: Map<string, any>;
  sharedContext: any;
  executionHistory: ExecutionStep[];
  variables: Map<string, any>;
  metadata: {
    startTime?: Date;
    lastUpdate: Date;
    executionCount: number;
    currentExecutionId?: string;
  };
}

export interface WorkflowStatus {
  status: "created" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    currentNode?: string;
    percentComplete: number;
  };
  timing: {
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    estimatedCompletion?: Date;
  };
  error?: WorkflowError;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  startTime: Date;
  endTime?: Date;
  status: "running" | "completed" | "failed" | "cancelled";
  input: any;
  output?: any;
  error?: WorkflowError;
  trace: ExecutionStep[];
  metrics: ExecutionMetrics;
}

export interface ExecutionStep {
  id: string;
  nodeId: string;
  agentId?: string;
  startTime: Date;
  endTime?: Date;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: any;
  output?: any;
  error?: WorkflowError;
  duration?: number;
  metadata?: any;
}

export interface WorkflowError {
  code: string;
  message: string;
  nodeId?: string;
  agentId?: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
}

export interface WorkflowResult {
  workflowId: string;
  executionId: string;
  status: "completed" | "failed" | "cancelled";
  output: any;
  error?: WorkflowError;
  metrics: ExecutionMetrics;
  trace: ExecutionStep[];
}

export interface WorkflowExecutionOptions {
  input?: any;
  variables?: Record<string, any>;
  timeout?: number;
  debugMode?: boolean;
  priority?: "low" | "normal" | "high";
  executionMode?: "sync" | "async";
}

export interface WorkflowFilter {
  status?: WorkflowStatus["status"];
  createdAfter?: Date;
  createdBefore?: Date;
  tags?: string[];
  category?: string;
  name?: string;
}

export interface AnalyticsAgent {
  id: string;
  name: string;
  description: string;
  specialization: AgentSpecialization;
  capabilities: AgentCapabilities;
  llmProvider: string;
  model: string;
  systemPrompt: string;
  tools: AgentTool[];
  configuration: AgentConfiguration;
  metadata: AgentMetadata;
}

export type AgentSpecialization = 
  | "data-discovery" 
  | "statistical-analysis" 
  | "visualization" 
  | "insight-generation"
  | "data-validation"
  | "query-optimization"
  | "anomaly-detection"
  | "predictive-modeling";

export interface AgentCapabilities {
  dataTyping?: boolean;
  qualityAssessment?: boolean;
  schemaInference?: boolean;
  sampleAnalysis?: boolean;
  statisticalAnalysis?: boolean;
  visualization?: boolean;
  reportGeneration?: boolean;
  queryGeneration?: boolean;
  anomalyDetection?: boolean;
  patternRecognition?: boolean;
  [key: string]: any;
}

export interface AgentTool {
  name: string;
  description: string;
  execute: (params: any, context: any) => Promise<any>;
  schema: any;
  async: boolean;
  timeout?: number;
  permissions?: string[];
}

export interface AgentConfiguration {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  caching?: boolean;
  debugMode?: boolean;
  [key: string]: any;
}

export interface AgentMetadata {
  createdAt: string;
  updatedAt?: string;
  version: string;
  author: string;
  tags?: string[];
  category?: string;
  [key: string]: any;
}

export interface AgentFilter {
  specialization?: AgentSpecialization;
  capabilities?: string[];
  provider?: string;
  model?: string;
  tags?: string[];
}

export interface WorkflowMetrics {
  executionCount: number;
  averageExecutionTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  memoryUsage: MemoryUsageMetrics;
  agentMetrics: Map<string, AgentMetrics>;
  lastUpdated: Date;
}

export interface ExecutionMetrics {
  totalDuration: number;
  nodeExecutionTimes: Map<string, number>;
  agentExecutionTimes: Map<string, number>;
  memoryUsage: MemoryUsageMetrics;
  throughput: number;
  errors: WorkflowError[];
  warnings: string[];
}

export interface MemoryUsageMetrics {
  peak: number;
  average: number;
  current: number;
  limit: number;
}

export interface AgentMetrics {
  executionCount: number;
  averageExecutionTime: number;
  successRate: number;
  errorRate: number;
  lastExecution?: Date;
  totalTokensUsed?: number;
  averageTokensPerExecution?: number;
}

export interface ExecutionTrace {
  executionId: string;
  workflowId: string;
  steps: ExecutionStep[];
  agentCalls: AgentCall[];
  dataOperations: DataOperation[];
  events: TraceEvent[];
  timeline: TimelineEvent[];
}

export interface AgentCall {
  id: string;
  agentId: string;
  stepId: string;
  startTime: Date;
  endTime?: Date;
  input: any;
  output?: any;
  error?: WorkflowError;
  llmCalls: LLMCall[];
  toolCalls: ToolCall[];
}

export interface LLMCall {
  provider: string;
  model: string;
  prompt: string;
  response?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
  timestamp: Date;
}

export interface ToolCall {
  toolName: string;
  input: any;
  output?: any;
  duration: number;
  timestamp: Date;
  error?: string;
}

export interface DataOperation {
  type: "query" | "transform" | "load" | "save";
  description: string;
  sql?: string;
  dataset?: string;
  rowsAffected?: number;
  duration: number;
  timestamp: Date;
}

export interface TraceEvent {
  type: "info" | "warning" | "error" | "debug";
  message: string;
  nodeId?: string;
  agentId?: string;
  timestamp: Date;
  metadata?: any;
}

export interface TimelineEvent {
  timestamp: Date;
  type: "node-start" | "node-complete" | "agent-call" | "error" | "state-change";
  description: string;
  nodeId?: string;
  agentId?: string;
  duration?: number;
  metadata?: any;
}