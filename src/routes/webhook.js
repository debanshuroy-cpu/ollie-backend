const { parseAlerts } = require('../services/alertParser');
const { saveCall, updateCall, detectAlertsFromMessages, mergeAlerts } = require('../services/callService');
const { getResidentById } = require('../services/residentService');

async function generateSummary(transcriptText, residentName) {
  const response = await fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      messages: [
        {
          role: 'user',
          content: `You are summarising a call between Ollie, an AI companion, and ${residentName}, a resident in a senior care facility.
Summarise this conversation in 2-3 sentences from a caregiver's perspective. Note any health concerns, emotional signals, or important topics discussed. Be concise and factual.
Only refer to the resident as ${residentName}.

Transcript:
${transcriptText}`
        }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function webhookRoutes(fastify) {

  // VAPI sends events here during and after calls
  fastify.post('/webhook/vapi', async (request, reply) => {
    const event = request.body;

    const payload = event.message || event;
    const type = payload.type;

    fastify.log.info({ type }, 'VAPI webhook received');
    console.log('VAPI event type received:', type, JSON.stringify(event).slice(0, 300));

    switch (type) {

      case 'conversation-update':
        // Parse real-time alerts from assistant messages
        if (payload.conversation) {
          const assistantMessages = payload.conversation
            .filter(m => m.role === 'assistant')
            .map(m => m.content || '')
            .join(' ');
          const alerts = parseAlerts(assistantMessages);
          if (alerts.length > 0) {
            console.log('🚨 Alerts detected mid-call:', alerts);
          }
        }
        break;

      case 'end-of-call-report': {
        console.log(`📴 Call ended — Duration: ${payload.call?.duration}s`);

        const artifactMessages = payload.artifact?.messages || [];

        // Option A: parse ##ALERT codes from assistant messages (LLM-generated)
        const assistantText = artifactMessages
          .filter(m => m.role === 'assistant' || m.role === 'bot')
          .map(m => m.message || m.content || '')
          .join(' ');
        const llmAlerts = parseAlerts(assistantText);

        // Option B: scan user messages directly for health signal keywords
        const keywordAlerts = detectAlertsFromMessages(artifactMessages);

        // Merge — deduplicate by type, keyword alerts take precedence
        const alerts = mergeAlerts(llmAlerts, keywordAlerts);

        if (alerts.length > 0) {
          console.log('🚨 End-of-call alerts:', alerts);
        }

        const firstTime = artifactMessages[0]?.time;
        const lastTime = artifactMessages[artifactMessages.length - 1]?.time;
        const startedAt = firstTime ? new Date(firstTime).toISOString() : null;
        const endedAt = lastTime ? new Date(lastTime).toISOString() : null;
        const duration = (firstTime && lastTime) ? Math.round((lastTime - firstTime) / 1000) : null;
        const endedReason = payload.message?.endedReason || payload.endedReason || null;

        const callRecord = {
          id: payload.call?.id,
          residentId: 'dorothy',
          startedAt,
          endedAt,
          duration,
          endedReason,
          messages: artifactMessages,
          transcript: payload.artifact?.transcript,
          summary: null,
          alerts
        };

        saveCall(callRecord);
        console.log(`💾 Call saved — ID: ${callRecord.id}`);

        // Generate summary non-blocking — don't let failure break the webhook response
        const resident = getResidentById(callRecord.residentId);
        const residentName = resident?.name || callRecord.residentId;

        const transcriptText = artifactMessages
          .filter(m => m.role === 'user' || m.role === 'bot')
          .map(m => `${m.role === 'bot' ? 'Ollie' : residentName}: ${m.message || m.content || ''}`)
          .join('\n');

        generateSummary(transcriptText, residentName)
          .then(summary => {
            updateCall(callRecord.id, { summary });
            console.log(`📋 Summary generated for call ${callRecord.id}`);
          })
          .catch(err => {
            console.error(`❌ Summary generation failed for call ${callRecord.id}:`, err.message);
          });

        break;
      }

      case 'status-update':
        console.log(`📊 Call status: ${payload.status}`);
        break;

      case 'hang':
        console.log(`📵 User hung up — Call ID: ${payload.call?.id}`);
        break;

      default:
        fastify.log.info({ type }, 'Unhandled VAPI event');
    }

    return reply.code(200).send({ received: true });
  });
}

module.exports = webhookRoutes;
