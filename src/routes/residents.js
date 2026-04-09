const { getAllResidents, getResidentById, createResident, updateResident } = require('../services/residentService');
const { buildSystemPrompt } = require('../prompts/systemPrompt');

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
    return reply.send(resident);
  });

  // GET /residents/:id/prompt-preview
  fastify.get('/residents/:id/prompt-preview', async (request, reply) => {
    const resident = getResidentById(request.params.id);
    if (!resident) return reply.code(404).send({ error: 'Resident not found' });
    const prompt = buildSystemPrompt(resident);
    return reply.send({ residentId: resident.id, residentName: resident.name, prompt });
  });
}

module.exports = residentRoutes;
