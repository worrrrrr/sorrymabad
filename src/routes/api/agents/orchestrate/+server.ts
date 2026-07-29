import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AgentRegistry, MessageQueue, MultiAgentOrchestrator, createMultiAgentSystem } from '$lib/agents/orchestrator';
import type { AgentConfig, AgentTask } from '$lib/types/agents';
import { v4 as uuidv4 } from 'uuid';

// Singleton instances for the agent system
let registry: AgentRegistry | null = null;
let messageQueue: MessageQueue | null = null;
let orchestrator: MultiAgentOrchestrator | null = null;

/**
 * Initialize the multi-agent system
 */
function getAgentSystem() {
  if (!registry || !messageQueue || !orchestrator) {
    // Define default agent configurations
    const defaultAgentConfigs: AgentConfig[] = [
      {
        id: uuidv4(),
        role: 'RESEARCHER',
        name: 'Research Agent',
        description: 'Gathers information from external sources',
        capabilities: ['web_search', 'database_query', 'api_call'],
        maxConcurrentTasks: 3,
        timeoutMs: 30000,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'ANALYST',
        name: 'Analysis Agent',
        description: 'Analyzes data and finds patterns',
        capabilities: ['data_analysis', 'pattern_recognition', 'statistical_analysis'],
        maxConcurrentTasks: 2,
        timeoutMs: 45000,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'VALIDATOR',
        name: 'Validation Agent',
        description: 'Validates facts and cross-references sources',
        capabilities: ['fact_checking', 'source_verification', 'consistency_check'],
        maxConcurrentTasks: 5,
        timeoutMs: 20000,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'SYNTHESIZER',
        name: 'Synthesis Agent',
        description: 'Combines findings into coherent output',
        capabilities: ['content_synthesis', 'report_generation', 'summary_creation'],
        maxConcurrentTasks: 2,
        timeoutMs: 60000,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'PLANNER',
        name: 'Planning Agent',
        description: 'Breaks down complex tasks into steps',
        capabilities: ['task_decomposition', 'workflow_planning', 'dependency_mapping'],
        maxConcurrentTasks: 1,
        timeoutMs: 30000,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'CRITIC',
        name: 'Critic Agent',
        description: 'Reviews and provides feedback on outputs',
        capabilities: ['quality_review', 'error_detection', 'improvement_suggestions'],
        maxConcurrentTasks: 3,
        timeoutMs: 30000,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: uuidv4(),
        role: 'COORDINATOR',
        name: 'Coordinator Agent',
        description: 'Manages communication between agents',
        capabilities: ['task_routing', 'load_balancing', 'conflict_resolution'],
        maxConcurrentTasks: 10,
        timeoutMs: 15000,
        retryAttempts: 5,
        enabled: true
      }
    ];

    const system = createMultiAgentSystem(defaultAgentConfigs);
    registry = system.registry;
    messageQueue = system.messageQueue;
    orchestrator = system.orchestrator;
  }

  return { registry, messageQueue, orchestrator };
}

/**
 * POST /api/agents/orchestrate
 * Execute a multi-agent workflow
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { objective, agentRoles, task } = body;

    if (!objective) {
      return json({ error: 'Objective is required' }, { status: 400 });
    }

    const { orchestrator: orch } = getAgentSystem();
    
    // Default to all agent roles if not specified
    const roles = agentRoles || ['RESEARCHER', 'ANALYST', 'VALIDATOR', 'SYNTHESIZER'];
    
    // Create initial task
    const initialTask: Omit<AgentTask, 'id' | 'assignedTo' | 'status' | 'createdAt'> = {
      taskType: task?.taskType || 'research_query',
      input: task?.input || { query: objective },
      metadata: task?.metadata || {}
    };

    // Execute workflow
    const session = await orch.executeWorkflow(objective, roles, initialTask);

    return json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      objective: session.objective,
      participatingAgents: session.participatingAgents.length,
      tasks: session.tasks.length,
      createdAt: session.createdAt
    });
  } catch (error) {
    console.error('[API] Orchestration error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Orchestration failed' 
    }, { status: 500 });
  }
};

/**
 * GET /api/agents/orchestrate/:sessionId
 * Get session status
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { orchestrator: orch } = getAgentSystem();
    
    // Check if requesting specific session
    const sessionId = params.sessionId || url.searchParams.get('sessionId');
    
    if (sessionId) {
      try {
        const session = await orch.getSessionStatus(sessionId);
        return json({
          success: true,
          session
        });
      } catch (error) {
        return json({ 
          error: 'Session not found',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 404 });
      }
    }

    // Return all active sessions
    const activeSessions = orch.getActiveSessions();
    const stats = orch.getStats();

    return json({
      success: true,
      activeSessions,
      stats
    });
  } catch (error) {
    console.error('[API] Get session error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to get session' 
    }, { status: 500 });
  }
};

/**
 * DELETE /api/agents/orchestrate/:sessionId
 * Terminate a session
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const { orchestrator: orch } = getAgentSystem();
    await orch.terminateSession(sessionId);

    return json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('[API] Terminate session error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to terminate session' 
    }, { status: 500 });
  }
};
