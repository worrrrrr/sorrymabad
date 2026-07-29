import Graph from 'graphlib';
import type { UserIntent, TaskStep } from '$lib/types/pipeline';

/**
 * Layer 2: Rule-based DAG Planner
 * Maps intent to execution steps with dependency variables ($1, $2)
 */

export interface PlannedGraph {
	graph: Graph.Graph;
	steps: Map<string, TaskStep>;
	variableBindings: Map<string, unknown>;
}

export interface PlanningRule {
	intentCategory: UserIntent['category'];
	template: TaskStep[];
	dependencyResolver?: (steps: TaskStep[]) => void;
}

/**
 * Default planning rules for each intent category
 */
const PLANNING_RULES: PlanningRule[] = [
	{
		intentCategory: 'search',
		template: [
			{
				stepId: 'step_1',
				toolType: 'search',
				description: 'Execute search query',
				dependencies: [],
				inputVariables: ['$1'],
				timeout: 10000,
				retries: 2,
				priority: 0
			},
			{
				stepId: 'step_2',
				toolType: 'validator',
				description: 'Validate search results',
				dependencies: ['step_1'],
				inputVariables: ['$1'],
				timeout: 5000,
				retries: 1,
				priority: 1
			}
		],
		dependencyResolver: (steps) => {
			// step_2 depends on step_1
			steps[1].dependencies = ['step_1'];
		}
	},
	{
		intentCategory: 'calculation',
		template: [
			{
				stepId: 'step_1',
				toolType: 'calculator',
				description: 'Perform calculation',
				dependencies: [],
				inputVariables: ['$1', '$2'],
				timeout: 5000,
				retries: 1,
				priority: 0
			},
			{
				stepId: 'step_2',
				toolType: 'validator',
				description: 'Verify calculation result',
				dependencies: ['step_1'],
				inputVariables: ['$1'],
				timeout: 3000,
				retries: 1,
				priority: 1
			}
		]
	},
	{
		intentCategory: 'analysis',
		template: [
			{
				stepId: 'step_1',
				toolType: 'search',
				description: 'Gather data for primary subject',
				dependencies: [],
				inputVariables: ['$1'],
				timeout: 10000,
				retries: 2,
				priority: 0
			},
			{
				stepId: 'step_2',
				toolType: 'search',
				description: 'Gather data for secondary subject',
				dependencies: [],
				inputVariables: ['$2'],
				timeout: 10000,
				retries: 2,
				priority: 0
			},
			{
				stepId: 'step_3',
				toolType: 'synthesizer',
				description: 'Synthesize analysis from gathered data',
				dependencies: ['step_1', 'step_2'],
				inputVariables: ['$1', '$2'],
				timeout: 15000,
				retries: 1,
				priority: 2
			}
		]
	},
	{
		intentCategory: 'verification',
		template: [
			{
				stepId: 'step_1',
				toolType: 'search',
				description: 'Find verification sources',
				dependencies: [],
				inputVariables: ['$1'],
				timeout: 10000,
				retries: 2,
				priority: 0
			},
			{
				stepId: 'step_2',
				toolType: 'solver',
				description: 'Apply verification logic',
				dependencies: ['step_1'],
				inputVariables: ['$1'],
				timeout: 20000,
				retries: 1,
				priority: 1
			}
		]
	},
	{
		intentCategory: 'synthesis',
		template: [
			{
				stepId: 'step_1',
				toolType: 'search',
				description: 'Gather source materials',
				dependencies: [],
				inputVariables: ['$1'],
				timeout: 10000,
				retries: 2,
				priority: 0
			},
			{
				stepId: 'step_2',
				toolType: 'template_renderer',
				description: 'Render synthesized output',
				dependencies: ['step_1'],
				inputVariables: ['$1'],
				timeout: 5000,
				retries: 1,
				priority: 1
			}
		]
	},
	{
		intentCategory: 'unknown',
		template: [
			{
				stepId: 'step_1',
				toolType: 'search',
				description: 'General search for unknown intent',
				dependencies: [],
				inputVariables: ['$1'],
				timeout: 10000,
				retries: 2,
				priority: 0
			}
		]
	}
];

/**
 * Resolve variable substitutions in task steps
 * Replaces $1, $2, etc. with actual values from parameters
 */
export function resolveVariables(
	steps: TaskStep[],
	parameters?: Record<string, unknown>
): TaskStep[] {
	if (!parameters) return steps;

	const paramArray = Object.values(parameters);
	
	return steps.map((step) => ({
		...step,
		inputVariables: step.inputVariables.map((variable) => {
			// Handle $1, $2 style variables
			const varMatch = variable.match(/^\$(\d+)$/);
			if (varMatch) {
				const index = parseInt(varMatch[1], 10) - 1;
				if (index >= 0 && index < paramArray.length) {
					return String(paramArray[index]);
				}
			}
			// Handle named variables from parameters
			if (parameters[variable]) {
				return String(parameters[variable]);
			}
			return variable;
		})
	}));
}

/**
 * Build a DAG from planning rules based on intent
 */
export function buildDAG(intent: UserIntent): PlannedGraph {
	const rule = PLANNING_RULES.find(
		(r) => r.intentCategory === intent.category
	) || PLANNING_RULES.find((r) => r.intentCategory === 'unknown');

	// Clone template steps and resolve variables
	let steps = JSON.parse(JSON.stringify(rule.template)) as TaskStep[];
	steps = resolveVariables(steps, intent.parameters);

	// Apply custom dependency resolver if available
	if (rule.dependencyResolver) {
		rule.dependencyResolver(steps);
	}

	// Create graphlib graph
	const graph = new Graph.Graph({ directed: true });

	// Create step map for quick lookup
	const stepMap = new Map<string, TaskStep>();

	// Add nodes to graph
	for (const step of steps) {
		graph.setNode(step.stepId, step);
		stepMap.set(step.stepId, step);
	}

	// Add edges based on dependencies
	for (const step of steps) {
		for (const dep of step.dependencies) {
			if (graph.hasNode(dep)) {
				graph.setEdge(dep, step.stepId);
			}
		}
	}

	// Validate DAG (check for cycles)
	if (hasCycle(graph)) {
		throw new Error('Invalid DAG: Cycle detected in execution plan');
	}

	return {
		graph,
		steps: stepMap,
		variableBindings: new Map()
	};
}

/**
 * Check if graph has cycles using DFS
 */
function hasCycle(graph: Graph.Graph): boolean {
	const nodes = graph.nodes();
	const visited = new Set<string>();
	const recursionStack = new Set<string>();

	function dfs(node: string): boolean {
		if (recursionStack.has(node)) {
			return true; // Cycle detected
		}
		if (visited.has(node)) {
			return false;
		}

		visited.add(node);
		recursionStack.add(node);

		const successors = graph.successors(node) || [];
		for (const successor of successors) {
			if (dfs(successor)) {
				return true;
			}
		}

		recursionStack.delete(node);
		return false;
	}

	for (const node of nodes) {
		if (!visited.has(node)) {
			if (dfs(node)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Get topological order for execution
 */
export function getExecutionOrder(plannedGraph: PlannedGraph): string[] {
	return Graph.alg.topsort(plannedGraph.graph);
}

/**
 * Get steps that are ready to execute (all dependencies satisfied)
 */
export function getReadySteps(
	plannedGraph: PlannedGraph,
	completedSteps: Set<string>
): TaskStep[] {
	const readySteps: TaskStep[] = [];

	for (const stepId of plannedGraph.graph.nodes()) {
		if (completedSteps.has(stepId)) continue;

		const step = plannedGraph.steps.get(stepId);
		if (!step) continue;

		// Check if all dependencies are completed
		const allDepsCompleted = step.dependencies.every((dep) =>
			completedSteps.has(dep)
		);

		if (allDepsCompleted) {
			readySteps.push(step);
		}
	}

	// Sort by priority
	return readySteps.sort((a, b) => b.priority - a.priority);
}
