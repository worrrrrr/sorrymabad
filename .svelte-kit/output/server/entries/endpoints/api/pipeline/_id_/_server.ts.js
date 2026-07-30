import { json } from "@sveltejs/kit";
const pipelineCache = /* @__PURE__ */ new Map();
const GET = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return json(
      { error: "Pipeline ID is required" },
      { status: 400 }
    );
  }
  const cached = pipelineCache.get(id);
  if (cached) {
    return json(cached, { status: 200 });
  }
  return json(
    { error: "Pipeline results not found" },
    { status: 404 }
  );
};
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { pipelineId, result } = body;
    if (!pipelineId || !result) {
      return json(
        { error: "pipelineId and result are required" },
        { status: 400 }
      );
    }
    pipelineCache.set(pipelineId, {
      ...result,
      cachedAt: Date.now()
    });
    setTimeout(() => {
      pipelineCache.delete(pipelineId);
    }, 60 * 60 * 1e3);
    return json(
      { success: true, pipelineId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to store pipeline result:", error);
    return json(
      { error: "Failed to store pipeline result" },
      { status: 500 }
    );
  }
};
const DELETE = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return json(
      { error: "Pipeline ID is required" },
      { status: 400 }
    );
  }
  pipelineCache.delete(id);
  return json(
    { success: true },
    { status: 200 }
  );
};
export {
  DELETE,
  GET,
  POST
};
