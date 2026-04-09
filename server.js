require('dotenv').config();

const Fastify = require('fastify');
const cors = require('@fastify/cors');

const webhookRoutes = require('./src/routes/webhook');
const assistantRoutes = require('./src/routes/assistant');
const residentRoutes = require('./src/routes/residents');
const llmRoutes = require('./src/routes/llm');

const app = Fastify({ logger: true });

// CORS — allow Flutter app and caregiver dashboard
app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE']
});

// Routes
app.register(webhookRoutes);
app.register(assistantRoutes);
app.register(residentRoutes);
app.register(llmRoutes);

// Start
const PORT = process.env.PORT || 3000;

app.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`
🐾 Ollie backend running at ${address}
   
   First time setup:
   1. Add your VAPI_API_KEY to .env
   2. POST ${address}/assistant/create  → creates Ollie in VAPI
   3. Copy the returned assistantId to .env as VAPI_ASSISTANT_ID
   4. Preview system prompt: GET ${address}/assistant/prompt/preview
   5. Start a call: POST ${address}/call/start
  `);
});
