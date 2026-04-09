// TODO: Switch to Anthropic Claude Haiku for production
const { parseAlerts, stripAlertCodes } = require('../services/alertParser');

async function llmRoutes(fastify) {

  fastify.post('/llm/chat/completions', async (request, reply) => {
    const {
      messages = [],
      max_tokens,
      temperature,
      stream: streamRequested
    } = request.body;

    let rawText;
    try {
      const response = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'llama3.2',
          messages,
          max_tokens: max_tokens || 150,
          temperature: temperature ?? 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Ollama error:', text);
        return reply.code(500).send({ error: `Ollama error: ${text}` });
      }

      const data = await response.json();
      rawText = data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Ollama request failed:', error.message);
      return reply.code(500).send({ error: error.message });
    }

    // Parse alerts before stripping — these go to the care team
    const alerts = parseAlerts(rawText);
    if (alerts.length > 0) {
      console.log('🚨 Alerts detected:', JSON.stringify(alerts, null, 2));
    }

    const cleanText = stripAlertCodes(rawText);

    const completionId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // Streaming — VAPI typically always requests this for real-time voice
    if (streamRequested) {
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const chunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: cleanText },
          finish_reason: null
        }]
      };

      reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);

      const finalChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      };
      reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
      return;
    }

    // Non-streaming fallback
    return reply.send({
      id: completionId,
      object: 'chat.completion',
      created,
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: cleanText },
        finish_reason: 'stop'
      }]
    });
  });
}

module.exports = llmRoutes;
