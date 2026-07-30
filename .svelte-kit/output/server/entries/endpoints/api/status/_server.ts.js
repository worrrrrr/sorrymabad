import { json } from "@sveltejs/kit";
const GET = async () => {
  const status = {
    status: "healthy",
    timestamp: Date.now(),
    version: "0.1.0",
    layers: {
      router: "operational",
      planner: "operational",
      executor: "operational",
      sanitizer: "operational",
      synthesizer: "operational"
    },
    environment: {
      llmConfigured: !!process.env.LLM_API_ENDPOINT,
      workerPoolConfigured: !!process.env.WORKER_SCRIPT_PATH
    }
  };
  return json(status, { status: 200 });
};
export {
  GET
};
