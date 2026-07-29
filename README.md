# sorrymabad

Deterministic-first personal research system. LLM is ONLY a Router + Synthesizer. Deterministic tools are the source of truth.

## Architecture

### 5-Layer Pipeline

1. **Router (Layer 1)** - Fast regex-first intent matching with LLM fallback
2. **Planner (Layer 2)** - Rule-based DAG builder with variable substitution ($1, $2)
3. **Executor (Layer 3)** - Topological sort execution with sanitization
4. **Sanitizer (Layer 4)** - Input validation to prevent indirect prompt injection
5. **Synthesizer (Layer 5)** - Circuit-breaker aware LLM handler with template renderer fallback

## Tech Stack

- **Framework**: SvelteKit 5 with @sveltejs/adapter-cloudflare
- **Language**: TypeScript (strict mode, noImplicitAny: true)
- **Validation**: Zod schemas
- **Graph**: graphlib for DAG operations
- **Styling**: TailwindCSS

## Project Structure

```
src/
├── lib/
│   ├── types/
│   │   └── pipeline.ts       # Zod schemas and TypeScript interfaces
│   └── orchestrator/
│       ├── router.ts         # Layer 1: Intent Router
│       ├── planner.ts        # Layer 2: DAG Planner
│       ├── executor.ts       # Layer 3: DAG Executor
│       ├── sanitizer.ts      # Layer 4: Input Sanitizer
│       ├── synthesizer.ts    # Layer 5: LLM Synthesizer + Fallback
│       └── heavy-worker-pool.ts  # Worker pool for CPU-intensive tasks
└── routes/
    └── api/
        └── research/
            └── +server.ts    # Main API endpoint
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

- `LLM_API_ENDPOINT` - LLM API endpoint URL
- `LLM_API_KEY` - LLM API key
- `LLM_MODEL` - LLM model name (default: gpt-3.5-turbo)
- `WORKER_SCRIPT_PATH` - Path to heavy worker script for child_process.fork

## API Usage

### POST /api/research

Execute a research query through the 5-layer pipeline.

**Request:**
```json
{
  "query": "Calculate 123 * 456",
  "options": {
    "llmFallback": false,
    "confidenceThreshold": 0.7,
    "maxRetries": 2,
    "timeout": 30000,
    "sanitize": true,
    "parallel": true
  }
}
```

**Response:**
```json
{
  "pipelineId": "uuid",
  "userIntent": { ... },
  "executionGraph": [ ... ],
  "results": { ... },
  "errors": [],
  "metadata": {
    "startTime": 1234567890,
    "endTime": 1234567895,
    "duration": 5000,
    "llmUsed": false,
    "fallbackUsed": false,
    "circuitBreakerOpen": false
  },
  "status": "success"
}
```

### GET /api/research

Health check endpoint.

## License

MIT
