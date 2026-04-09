const { parseAlerts } = require('../services/alertParser');
const { saveCall } = require('../services/callService');

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

        const assistantText = (payload.artifact?.messages || [])
          .filter(m => m.role === 'assistant')
          .map(m => m.message || m.content || '')
          .join(' ');

        const alerts = parseAlerts(assistantText);
        if (alerts.length > 0) {
          console.log('🚨 End-of-call alerts:', alerts);
        }

        const summary = payload.analysis?.summary || null;
        if (summary) console.log('📋 Summary:', summary);

        const callRecord = {
          id: payload.call?.id,
          residentId: 'dorothy',
          startedAt: payload.call?.startedAt,
          endedAt: payload.call?.endedAt,
          duration: payload.call?.duration,
          endedReason: payload.call?.endedReason,
          messages: payload.artifact?.messages,
          transcript: payload.artifact?.transcript,
          summary,
          alerts
        };

        saveCall(callRecord);
        console.log(`💾 Call saved — ID: ${callRecord.id}`);
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
