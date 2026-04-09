const { parseAlerts } = require('../services/alertParser');

async function webhookRoutes(fastify) {

  // VAPI sends events here during and after calls
  fastify.post('/webhook/vapi', async (request, reply) => {
    const event = request.body;

    fastify.log.info({ type: event.type }, 'VAPI webhook received');

    switch (event.type) {

      case 'call-started':
        console.log(`📞 Call started — Call ID: ${event.call?.id}`);
        break;

      case 'transcript':
        // Real-time transcript — parse alerts as they come in
        if (event.transcript?.role === 'assistant') {
          const alerts = parseAlerts(event.transcript.text || '');
          if (alerts.length > 0) {
            console.log('🚨 Alerts detected mid-call:', alerts);
            // Layer 2: store alerts in database here
          }
        }
        break;

      case 'call-ended':
        console.log(`📴 Call ended — Duration: ${event.call?.duration}s`);
        const summary = event.analysis?.summary;
        const transcript = event.transcript;
        if (summary) console.log('📋 Summary:', summary);
        // Layer 2: save transcript + summary to database here
        break;

      case 'status-update':
        console.log(`📊 Call status: ${event.status}`);
        break;

      default:
        fastify.log.info({ type: event.type }, 'Unhandled VAPI event');
    }

    return reply.code(200).send({ received: true });
  });
}

module.exports = webhookRoutes;
