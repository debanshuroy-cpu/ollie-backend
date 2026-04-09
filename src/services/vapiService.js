const axios = require('axios');
const { buildSystemPrompt } = require('../prompts/systemPrompt');
const { getResidentById, getAllResidents } = require('./residentService');

const VAPI_BASE_URL = 'https://api.vapi.ai';

const vapiClient = axios.create({
  baseURL: VAPI_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Creates the Ollie assistant in VAPI
// Run once — saves the assistant ID to use in calls
async function createOllieAssistant() {
  const residents = getAllResidents();
  const resident = residents[0];
  const systemPrompt = buildSystemPrompt(resident);

  const assistantConfig = {
    name: "Ollie",
    model: {
      provider: "custom-llm",
      url: process.env.CUSTOM_LLM_URL,
      model: "claude-haiku-4-5-20251001",
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ]
    },
    voice: {
      provider: "cartesia",
      voiceId: "f786b574-daa5-4673-aa0c-cbe3e8534c02",
      model: "sonic-3",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en"
    },
    firstMessage: `Good morning, ${resident.name}! How did you sleep last night?`,
    endCallMessage: "It was lovely talking with you. Take care of yourself.",
    silenceTimeoutSeconds: 10,
    maxDurationSeconds: 600,  // 10 minute max per conversation
    backgroundSound: "off",
    backchannelingEnabled: false,
    analysisPlan: {
      summaryPrompt: "Summarise this conversation in 2 sentences from a caregiver's perspective. Note any health concerns, emotional signals, or topics discussed.",
      structuredDataPrompt: "Extract any ##ALERT or ##FLAG codes mentioned in the assistant responses.",
      successEvaluationPrompt: "Was this a warm, natural conversation? Did the resident seem engaged?"
    },
    backgroundDenoisingEnabled: true,
    startSpeakingPlan: {
      waitSeconds: 1.5,
    },
    stopSpeakingPlan: {
      numWords: 2,
      backoffSeconds: 2,
    },
  };

  try {
    const response = await vapiClient.post('/assistant', assistantConfig);
    console.log('✅ Ollie assistant created:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create assistant:', error.response?.data || error.message);
    throw error;
  }
}

// Updates the system prompt on the VAPI assistant for a given resident
// Called before each conversation with fresh resident context
async function updateAssistantPrompt(residentId) {
  const resident = getResidentById(residentId);
  if (!resident) throw new Error(`Resident not found: ${residentId}`);

  const systemPrompt = buildSystemPrompt(resident);
  const assistantId = process.env.VAPI_ASSISTANT_ID || '14a75005-8f1a-4f9e-89f9-aa9c04dcd378';

  try {
    const response = await vapiClient.patch(`/assistant/${assistantId}`, {
      model: {
        provider: "custom-llm",
        url: process.env.CUSTOM_LLM_URL,
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        maxTokens: 150
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Failed to update assistant:', error.response?.data || error.message);
    console.error('VAPI error response:', error.response?.data);
    const vapiError = error.response?.data || { message: error.message };
    const err = new Error(vapiError.message || error.message);
    err.vapiError = vapiError;
    throw err;
  }
}

// Fetches assistant details
async function getAssistant(assistantId) {
  try {
    const response = await vapiClient.get(`/assistant/${assistantId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get assistant:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { createOllieAssistant, updateAssistantPrompt, getAssistant };
