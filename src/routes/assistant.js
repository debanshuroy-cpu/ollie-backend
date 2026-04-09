const { createOllieAssistant, getAssistant, updateAssistantPrompt } = require('../services/vapiService');
const { buildSystemPrompt } = require('../prompts/systemPrompt');
const { getResidentById, getAllResidents } = require('../services/residentService');

async function assistantRoutes(fastify) {

  // POST /assistant/create
  // Run once to create Ollie in VAPI — save the returned ID to .env
  fastify.post('/assistant/create', async (request, reply) => {
    try {
      const assistant = await createOllieAssistant();
      return reply.send({
        success: true,
        assistantId: assistant.id,
        message: 'Save this assistantId to your .env as VAPI_ASSISTANT_ID'
      });
    } catch (error) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // GET /assistant/:id
  // Check assistant details
  fastify.get('/assistant/:id', async (request, reply) => {
    try {
      const assistant = await getAssistant(request.params.id);
      return reply.send({ success: true, assistant });
    } catch (error) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // POST /assistant/prompt/update
  // Push the latest resident prompt to the VAPI assistant
  fastify.post('/assistant/prompt/update', async (request, reply) => {
    const { residentId } = request.body || {};
    if (!residentId) {
      return reply.code(400).send({ error: 'residentId is required' });
    }
    try {
      const assistant = await updateAssistantPrompt(residentId);
      return reply.send({ success: true, assistant });
    } catch (error) {
      return reply.code(500).send({ success: false, error: error.message, vapiError: error.vapiError || null });
    }
  });

  // GET /assistant/prompt/preview
  // See the system prompt that will be sent before a call — useful for debugging
  fastify.get('/assistant/prompt/preview', async (request, reply) => {
    const residentId = request.query.residentId;
    const resident = residentId
      ? getResidentById(residentId)
      : getAllResidents()[0];

    if (!resident) {
      return reply.code(404).send({ error: 'Resident not found' });
    }

    const prompt = buildSystemPrompt(resident);
    return reply.send({ residentId: resident.id, residentName: resident.name, prompt });
  });

  // POST /call/start
  // Flutter app calls this — returns VAPI assistant ID for the call
  fastify.post('/call/start', async (request, reply) => {
    const { residentId, conversationType } = request.body || {};
    const assistantId = process.env.VAPI_ASSISTANT_ID;

    if (!assistantId) {
      return reply.code(500).send({
        success: false,
        error: 'VAPI_ASSISTANT_ID not set. Run POST /assistant/create first.'
      });
    }

    const resident = residentId
      ? getResidentById(residentId)
      : getAllResidents()[0];

    if (!resident) {
      return reply.code(404).send({ success: false, error: 'Resident not found' });
    }

    await updateAssistantPrompt(residentId || resident.id);

    return reply.send({
      success: true,
      assistantId,
      residentName: resident.name,
      conversationType: conversationType || 'morning_checkin'
    });
  });

  // GET /health
  fastify.get('/health', async (request, reply) => {
    return reply.send({ status: 'ok', service: 'ollie-backend', version: '0.1.0' });
  });
}

module.exports = assistantRoutes;
