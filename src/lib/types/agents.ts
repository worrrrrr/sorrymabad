import { z } from 'zod';

/**
 * Agent Type Definitions
 * Each agent has a specific role in the multi-agent orchestration system
 */
export const AgentRoleSchema = z.enum([
  'RESEARCHER',      // Gathers information from external sources
  'ANALYST',         // Analyzes data and finds patterns
  'VALIDATOR',       // Validates facts and cross-references sources
  'SYNTHESIZER',     // Combines findings into coherent output
  'PLANNER',         // Breaks down complex tasks into steps
  'CRITIC',          // Reviews and provides feedback on outputs
  'COORDINATOR'      // Manages communication between agents
]);

export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentStatusSchema = z.enum([
  'IDLE',
  'BUSY',
  'ERROR',
  'OFFLINE'
]);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/**
 * Agent Configuration Schema
 */
export const AgentConfigSchema = z.object({
  id: z.string().uuid(),
  role: AgentRoleSchema,
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  capabilities: z.array(z.string()),
  maxConcurrentTasks: z.number().int().positive().default(1),
  timeoutMs: z.number().int().positive().default(30000),
  retryAttempts: z.number().int().nonnegative().default(3),
  enabled: z.boolean().default(true),
  modelConfig: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    systemPrompt: z.string().optional()
  }).optional()
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Inter-Agent Message Schema
 */
export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid(),
  messageType: z.enum(['REQUEST', 'RESPONSE', 'NOTIFICATION', 'ERROR']),
  payload: z.unknown(),
  timestamp: z.number(),
  correlationId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL')
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

/**
 * Task Assignment Schema
 */
export const AgentTaskSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.string().uuid(),
  taskType: z.string(),
  input: z.unknown(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;

/**
 * Agent State Schema
 */
export const AgentStateSchema = z.object({
  config: AgentConfigSchema,
  status: AgentStatusSchema,
  currentTaskId: z.string().uuid().optional().nullable(),
  completedTasksCount: z.number().int().nonnegative().default(0),
  failedTasksCount: z.number().int().nonnegative().default(0),
  lastActiveAt: z.number().optional(),
  healthScore: z.number().min(0).max(100).default(100)
});

export type AgentState = z.infer<typeof AgentStateSchema>;

/**
 * Multi-Agent Orchestration Session
 */
export const OrchestrationSessionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  objective: z.string(),
  participatingAgents: z.array(z.string().uuid()),
  messageQueue: z.array(AgentMessageSchema),
  tasks: z.array(AgentTaskSchema),
  status: z.enum(['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  finalOutput: z.unknown().optional(),
  errors: z.array(z.object({
    agentId: z.string().uuid(),
    error: z.string(),
    timestamp: z.number()
  }))
});

export type OrchestrationSession = z.infer<typeof OrchestrationSessionSchema>;

/**
 * Agent Communication Protocol
 */
export const AgentRequestSchema = z.object({
  action: z.enum([
    'RESEARCH_QUERY',
    'ANALYZE_DATA',
    'VALIDATE_FACT',
    'SYNTHESIZE_OUTPUT',
    'CREATE_PLAN',
    'REVIEW_OUTPUT',
    'COORDINATE_TASKS'
  ]),
  payload: z.unknown(),
  requestedBy: z.string().uuid(),
  targetAgents: z.array(z.string().uuid()).optional(),
  timeoutMs: z.number().int().positive().optional()
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

/**
 * Agent Response Schema
 */
export const AgentResponseSchema = z.object({
  requestId: z.string().uuid(),
  agentId: z.string().uuid(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  processingTimeMs: z.number().int().positive(),
  confidence: z.number().min(0).max(1).optional()
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// TypeScript Interfaces for runtime use
export interface IAgent {
  config: AgentConfig;
  state: AgentState;
  execute(task: AgentTask): Promise<AgentResponse>;
  canHandle(taskType: string): boolean;
}

export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): void;
  getAgent(agentId: string): IAgent | undefined;
  getAgentsByRole(role: AgentRole): IAgent[];
  getAllAgents(): IAgent[];
}

export interface IMessageQueue {
  enqueue(message: AgentMessage): Promise<void>;
  dequeue(agentId: string): Promise<AgentMessage | null>;
  peek(agentId: string): Promise<AgentMessage | null>;
  getMessageCount(agentId: string): Promise<number>;
}

export interface IOrchestrator {
  createSession(objective: string, agentIds: string[]): Promise<OrchestrationSession>;
  assignTask(sessionId: string, task: AgentTask): Promise<void>;
  broadcastMessage(sessionId: string, message: AgentMessage): Promise<void>;
  getSessionStatus(sessionId: string): Promise<OrchestrationSession>;
  terminateSession(sessionId: string): Promise<void>;
}
