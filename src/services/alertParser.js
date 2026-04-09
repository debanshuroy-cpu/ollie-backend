// Parses ##ALERT and ##FLAG codes from VAPI transcript
// These are appended silently by the LLM and never spoken aloud

const ALERT_PATTERNS = {
  PHYSICAL_PAIN:       /##ALERT:PHYSICAL_PAIN/,
  COGNITIVE_CONFUSION: /##ALERT:COGNITIVE_CONFUSION/,
  EMOTIONAL_DISTRESS:  /##ALERT:EMOTIONAL_DISTRESS/,
  EMERGENCY:           /##ALERT:EMERGENCY/,
  LONELINESS_HIGH:     /##FLAG:LONELINESS_HIGH/,
  MENTION_FAMILY:      /##FLAG:MENTION_FAMILY:\[(.+?)\]/
};

const ALERT_PRIORITY = {
  EMERGENCY:           'immediate',
  PHYSICAL_PAIN:       'immediate',
  COGNITIVE_CONFUSION: 'same_day',
  EMOTIONAL_DISTRESS:  'same_day',
  LONELINESS_HIGH:     'weekly_report',
  MENTION_FAMILY:      'log_only'
};

function parseAlerts(transcript) {
  const alerts = [];

  for (const [type, pattern] of Object.entries(ALERT_PATTERNS)) {
    const match = transcript.match(pattern);
    if (match) {
      alerts.push({
        type,
        priority: ALERT_PRIORITY[type],
        detail: match[1] || null,  // Captures family name for MENTION_FAMILY
        detectedAt: new Date().toISOString()
      });
    }
  }

  return alerts;
}

// Strips alert codes from text before sending to TTS or display
function stripAlertCodes(text) {
  return text
    .replace(/##ALERT:\w+/g, '')
    .replace(/##FLAG:\w+(\[.+?\])?/g, '')
    .trim();
}

module.exports = { parseAlerts, stripAlertCodes };
