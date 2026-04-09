const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/calls.json');

function readCalls() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeCalls(calls) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2));
}

function saveCall(callData) {
  const calls = readCalls();
  calls.push(callData);
  writeCalls(calls);
  return callData;
}

function updateCall(id, updates) {
  const calls = readCalls();
  const index = calls.findIndex(c => c.id === id);
  if (index === -1) return null;
  calls[index] = { ...calls[index], ...updates };
  writeCalls(calls);
  return calls[index];
}

function getCalls() {
  return readCalls();
}

function getCallsByResident(residentId) {
  return readCalls().filter(c => c.residentId === residentId);
}

// Option B: keyword-based alert detection scanning user messages directly.
// More reliable than depending on the LLM to append ##ALERT codes.
function detectAlertsFromMessages(messages) {
  const userText = (messages || [])
    .filter(m => m.role === 'user')
    .map(m => (m.message || m.content || '').toLowerCase())
    .join(' ');

  const now = new Date().toISOString();
  const detected = [];

  const rules = [
    {
      type: 'EMERGENCY',
      priority: 'immediate',
      keywords: ["fell", "fallen", "slipping", "can't breathe", "chest pain", "chest tight", "collapsed", "unconscious"]
    },
    {
      type: 'PHYSICAL_PAIN',
      priority: 'immediate',
      keywords: ["pain", "hurts", "aching", "sore", "stiff", "discomfort", "knee", "my back", "my hip", "my shoulder", "didn't sleep", "couldn't sleep", "not eating", "no appetite"]
    },
    {
      type: 'COGNITIVE_CONFUSION',
      priority: 'same_day',
      keywords: ["confused", "don't remember", "can't remember", "lost track", "forgot", "where am i", "what day"]
    },
    {
      type: 'EMOTIONAL_DISTRESS',
      priority: 'same_day',
      keywords: ["sad", "crying", "upset", "hopeless", "no point", "depressed", "lonely", "miserable", "terrible", "awful"]
    },
    {
      type: 'LONELINESS_HIGH',
      priority: 'weekly_report',
      keywords: ["alone", "nobody visits", "nobody calls", "forgotten", "no one cares", "by myself"]
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => userText.includes(kw))) {
      detected.push({ type: rule.type, priority: rule.priority, detail: null, detectedAt: now });
    }
  }

  // MENTION_FAMILY — capture which name was mentioned
  for (const name of ['Sarah', 'Michael']) {
    if (userText.includes(name.toLowerCase())) {
      detected.push({ type: 'MENTION_FAMILY', priority: 'log_only', detail: name, detectedAt: now });
    }
  }

  return detected;
}

// Merge LLM-detected alerts (Option A) with keyword-detected alerts (Option B).
// Deduplicate by type — keep one entry per type, preferring keyword-detected.
function mergeAlerts(llmAlerts, keywordAlerts) {
  const merged = new Map();
  for (const alert of [...llmAlerts, ...keywordAlerts]) {
    // keyword alerts overwrite LLM alerts of the same type
    // MENTION_FAMILY can appear multiple times (different names) — key by type+detail
    const key = alert.type === 'MENTION_FAMILY'
      ? `${alert.type}:${alert.detail}`
      : alert.type;
    merged.set(key, alert);
  }
  return Array.from(merged.values());
}

module.exports = { saveCall, updateCall, getCalls, getCallsByResident, detectAlertsFromMessages, mergeAlerts };
