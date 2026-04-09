const { getAllResidents, getResidentById, createResident, updateResident } = require('../services/residentService');
const { buildSystemPrompt } = require('../prompts/systemPrompt');
const { getCallsByResident } = require('../services/callService');
const { updateAssistantPrompt } = require('../services/vapiService');

async function residentRoutes(fastify) {

  // GET /residents
  fastify.get('/residents', async (request, reply) => {
    return reply.send(getAllResidents());
  });

  // GET /residents/:id
  fastify.get('/residents/:id', async (request, reply) => {
    const resident = getResidentById(request.params.id);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });
    return reply.send(resident);
  });

  // POST /residents
  fastify.post('/residents', async (request, reply) => {
    const resident = createResident(request.body);
    return reply.code(201).send(resident);
  });

  // PATCH /residents/:id
  fastify.patch('/residents/:id', async (request, reply) => {
    const resident = updateResident(request.params.id, request.body);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });

    try {
      await updateAssistantPrompt(resident.id);
      console.log(`🔄 VAPI prompt auto-updated for resident: ${resident.name}`);
      return reply.send({ resident, vapiUpdated: true });
    } catch (error) {
      console.error(`❌ VAPI auto-update failed for ${resident.name}:`, error.message);
      return reply.send({ resident, vapiUpdated: false, vapiError: error.message });
    }
  });

  // GET /residents/:id/prompt-preview
  fastify.get('/residents/:id/prompt-preview', async (request, reply) => {
    const resident = getResidentById(request.params.id);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });
    const prompt = buildSystemPrompt(resident);
    return reply.send({ residentId: resident.id, residentName: resident.name, prompt });
  });

  // GET /residents/:id/calls
  fastify.get('/residents/:id/calls', async (request, reply) => {
    const resident = getResidentById(request.params.id);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });
    const calls = getCallsByResident(request.params.id);
    return reply.send(calls);
  });

  // GET /residents/:id/calls/latest
  fastify.get('/residents/:id/calls/latest', async (request, reply) => {
    const resident = getResidentById(request.params.id);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });
    const calls = getCallsByResident(request.params.id);
    if (calls.length === 0) return reply.code(404).send({ error: 'No calls found' });
    const latest = calls[calls.length - 1];
    return reply.send(latest);
  });
}

module.exports = residentRoutes;
