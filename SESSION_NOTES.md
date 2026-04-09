# Ollie — Session Notes
### Date: April 9, 2026

---

## What This Session Covered

Full voicebot logic design, system prompt architecture, VAPI configuration, custom LLM proxy build, and resident profile system. Starting point was a working Flutter app that connected to VAPI but had no prompt structure, alert suppression, or dynamic resident data.

---

## 1. VAPI Assistant Audit

Fetched the live assistant config from VAPI and found:

- **Assistant ID in use:** `14a75005-8f1a-4f9e-89f9-aa9c04dcd378` (Ollie final)
- **Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via Anthropic
- **Voice:** ElevenLabs `eleven_turbo_v2_5`, voice ID `Awx8TeMHHpDzbm42nIB6`
- **STT:** Deepgram Nova-2
- **Old assistant** `99192b5b` was running Groq/Llama 3.3 — abandoned
- `endCallPhrases` was not set — calls never terminated properly
- `endCallMessage` was just `"Goodbye."` — not in Ollie's voice
- `analysisPlan` was disabled
- No webhook server URL connected
- Backend (`vapiService.js`) was pointing at wrong assistant ID via `VAPI_ASSISTANT_ID` in `.env`

**Fixes applied via VAPI API:**
- Added `endCallPhrases`: bye, goodbye, good night, take care, talk later, that is all, I will let you go
- Updated `endCallMessage`: "It was so lovely chatting with you Dorothy, take good care of yourself."
- Updated `VAPI_ASSISTANT_ID` in `.env` to `14a75005-8f1a-4f9e-89f9-aa9c04dcd378`

---

## 2. Voicebot Logic Design

Mapped out all functions Ollie needs to perform across six categories:

### Conversation & Companionship
- Time-aware greeting and tone (chatty mornings, quieter evenings)
- Natural follow-up questions referencing Dorothy's actual life
- Avoid repetitive openers

### Emotional Intelligence
- Mirror Dorothy's energy — never project positivity onto negative tone
- Gently probe if something seems off
- Handle grief (Gerald) based on emotional tone, not topic

### Health Awareness (Passive)
- Listen for pain, falls, dizziness, poor sleep, poor appetite, breathlessness, confusion, emotional distress, loneliness
- Respond empathetically — never clinical or alarmed
- Emit ##ALERT codes silently — never speak them

### Memory & Continuity
- Layer 1: hardcoded Dorothy profile
- Layer 2 (future): dynamic prompts, conversation history

### Call Flow
- Opening, pacing, silence handling, confused responses, call ending

### Edge Cases & Safety
- Medical deflection: "I'll let your care team know"
- Grief handling: follow mood not topic
- Confusion/disorientation: gentle check-in, flag internally

---

## 3. Five Design Decisions Made

### Decision 1 — Alert Detection Method
**Chosen: Option A — LLM generates ##ALERT codes**
LLM appends alert codes at the end of its response on a new line. Backend strips them before TTS and logs them separately. Gives contextual accuracy over keyword matching.

### Decision 2 — Time of Day
**Chosen: Option B — Inject dynamically via backend**
Four bands injected into system prompt at call start via `updateAssistantPrompt()`:
- Morning (6am–12pm): chatty, warm, lively
- Afternoon (12pm–5pm): gentle, relaxed
- Evening (5pm–9pm): quieter, softer
- Night (9pm–6am): very gentle, brief

### Decision 3 — Call Length and Conversation Driving
**Chosen: 5 minute adaptive**
Ollie drives gently in the morning, follows Dorothy's lead in the evening.

### Decision 4 — Medical Deflection
**Chosen: Option B — "I'll let your care team know"**
Warm, reassuring, and architecturally honest — alerts will be logged and followed up by a human caregiver.

### Decision 5 — Gerald (Grief Handling)
**Chosen: Option C — Follow mood, not topic**
- Dorothy sounds nostalgic → let her talk, gentle follow-up
- Dorothy sounds sad/flat → acknowledge warmly, redirect gently
- Never shut down Gerald. Never dramatise either.

---

## 4. Alert Code System

Kept the existing structure from `alertParser.js` — broader categories with priority levels:

| Code | Trigger | Priority |
|---|---|---|
| `##ALERT:PHYSICAL_PAIN` | Any pain, aches, discomfort including knee | immediate |
| `##ALERT:EMERGENCY` | Fall, breathlessness, chest pain | immediate |
| `##ALERT:COGNITIVE_CONFUSION` | Disorientation, repetition, confusion | same_day |
| `##ALERT:EMOTIONAL_DISTRESS` | Prolonged sadness, hopelessness, tearfulness | same_day |
| `##FLAG:LONELINESS_HIGH` | Feeling alone, forgotten, nobody visits | weekly_report |
| `##FLAG:MENTION_FAMILY:[name]` | Mention of Sarah or Michael only — NOT Gerald | log_only |

Multiple alerts per response allowed — one per line after a blank line.

---

## 5. System Prompt

Full structured prompt written with these sections:

- **ABOUT [NAME]** — dynamic, built from resident profile
- **CURRENT CALL CONTEXT** — time of day block, injected dynamically
- **YOUR PERSONALITY** — static rules
- **EMOTIONAL AWARENESS** — static rules
- **CONVERSATION GUIDANCE** — time-aware driving vs following
- **PERSONAL TOPICS** — dynamic, built from resident profile
- **HEALTH SIGNALS** — what to listen for, how to respond
- **ALERT CODES — CRITICAL INSTRUCTIONS** — format rules, suppression rules
- **ENDING THE CALL** — one warm line then stop

All `[NAME]`, `[AGE]`, `[BACKGROUND]` etc. are replaced dynamically by `buildSystemPrompt()` at call time.

---

## 6. Backend Changes

### New Files
- `src/data/residents.json` — resident profiles stored as JSON (Layer 1 storage, migrate to PostgreSQL in Layer 2)
- `src/services/residentService.js` — getAllResidents, getResidentById, createResident, updateResident
- `src/routes/residents.js` — CRUD routes: GET /residents, GET /residents/:id, POST /residents, PATCH /residents/:id, GET /residents/:id/prompt-preview
- `src/routes/llm.js` — custom LLM proxy endpoint at POST /llm/chat/completions

### Updated Files
- `src/prompts/systemPrompt.js` — fully rewritten, takes resident object, builds dynamic blocks, injects time-of-day
- `src/services/vapiService.js` — updateAssistantPrompt() now accepts residentId, fetches resident, builds prompt, patches VAPI. Model config updated to custom-llm provider pointing at CUSTOM_LLM_URL
- `src/routes/assistant.js` — added POST /assistant/prompt/update route, /call/start now calls updateAssistantPrompt before returning
- `server.js` — registered residents and llm routes

### New .env Variables
```
VAPI_ASSISTANT_ID=14a75005-8f1a-4f9e-89f9-aa9c04dcd378
ANTHROPIC_API_KEY=sk-ant-...
CUSTOM_LLM_URL=https://your-ngrok-url.ngrok-free.app/llm
OLLAMA_MODEL=llama3.2
```

---

## 7. Custom LLM Proxy

**Why it was needed:**
VAPI was calling Anthropic directly — no interception point. ##ALERT codes were going straight to ElevenLabs TTS and being spoken aloud. Prompt instructions alone were not reliable enough to suppress them.

**How it works:**
```
VAPI → POST /llm/chat/completions (your backend)
     → Ollama (testing) / Claude Haiku (production)
     → stripAlertCodes() removes ##ALERT and ##FLAG lines
     → parseAlerts() logs detected alerts to console
     → Returns clean spoken text to VAPI
     → ElevenLabs → Dorothy's ear
```

**VAPI assistant model config:**
```json
{
  "provider": "custom-llm",
  "url": "https://your-ngrok-url.ngrok-free.app/llm",
  "model": "claude-haiku-4-5-20251001",
  "temperature": 0.7,
  "maxTokens": 150
}
```

**Note:** VAPI always appends `/chat/completions` to the custom LLM URL. The URL in VAPI config must end in `/llm` so the full path becomes `/llm/chat/completions`.

---

## 8. Ollama Setup (Testing Only)

Installed and running locally at `http://localhost:11434`.
Model: `llama3.2` (3B parameters).

```bash
ollama pull llama3.2
ollama serve
```

**Why Ollama for testing:**
Anthropic API requires credits. Ollama runs free locally. Swap is trivial — just change the API endpoint and key in `llm.js`.

**Known issue:** 2-4 second latency due to local CPU/MPS inference + ngrok tunnel overhead. Will drop to ~800ms in production with Claude Haiku + deployed backend.

---

## 9. React Admin UI (ollie-admin)

Scaffolded with Vite React, proxied to `http://localhost:3000`.

**Three components:**
- **ResidentList** — cards showing all residents with Edit and Preview Prompt buttons
- **ResidentEditor** — form for all profile fields including tag-style arrays (interests, health notes) and row-based family editor (name, relation, location, visit pattern)
- **PromptPreview** — fetches GET /residents/:id/prompt-preview and displays the live generated system prompt

**To run:**
```bash
cd ollie-admin
npm run dev
# Opens at http://localhost:5173
```

---

## 10. Dorothy's Resident Profile

```json
{
  "id": "dorothy",
  "name": "Dorothy",
  "age": 78,
  "background": "former school librarian",
  "interests": ["roses", "birds", "BBC period dramas"],
  "family": [
    {
      "name": "Sarah",
      "relation": "daughter",
      "location": "Boston",
      "visitPattern": "visits every 2 weeks"
    },
    {
      "name": "Michael",
      "relation": "son",
      "location": "Denver",
      "visitPattern": "calls Sundays"
    }
  ],
  "healthNotes": [
    "mild arthritis in left knee",
    "tends to downplay pain"
  ],
  "personalTopics": ["late husband Gerald", "her old garden"]
}
```

---

## 11. GitHub Repos

Both pushed as private repositories:
- `git@github.com:debanshuroy-cpu/ollie-backend.git`
- `git@github.com:debanshuroy-cpu/ollie-admin.git`

`.env` and `node_modules/` excluded from both via `.gitignore`.

---

## 12. What's Working

- ✅ Custom LLM proxy — VAPI → backend → Ollama
- ✅ ##ALERT codes stripped before TTS — never spoken aloud
- ✅ Alert codes logged in backend terminal during calls
- ✅ Dynamic resident profiles loaded from JSON
- ✅ System prompt built dynamically with time-of-day injection
- ✅ Admin UI — resident editor and prompt preview working
- ✅ End call phrases configured — calls terminate on goodbye
- ✅ endCallMessage updated — warm, in Ollie's voice
- ✅ Correct assistant (14a75005) receiving all updates
- ✅ Code pushed to GitHub

---

## 13. Pending Items

| Priority | Item | Notes |
|---|---|---|
| 1 | Switch to Anthropic Claude Haiku | Add credits at console.anthropic.com, swap Ollama endpoint in llm.js |
| 2 | Fix Flutter WebRTC connection | App creates call but never joins Daily.co room — cost always $0 |
| 3 | Connect webhook to VAPI | Add server URL in VAPI dashboard so backend receives real-time call events |
| 4 | Test alert logging end to end | Verify alerts appear in backend logs during real calls with Flutter |
| 5 | Re-enable analysisPlan | Summary and evaluation after calls — needs webhook connected first |
| 6 | ngrok → deployed backend | Railway or Render — removes tunnel latency, gives stable URL |
| 7 | Layer 2 — PostgreSQL | Replace JSON file with database, add conversation history, dynamic memory |
| 8 | Layer 3 — Caregiver dashboard | React web app showing alerts, call summaries, resident status |
| 9 | Layer 4 — Watch face | Wear OS animation on Galaxy Watch 7 |

---

## 14. How to Run Everything Locally

```bash
# Terminal 1 — Ollama
ollama serve

# Terminal 2 — Backend
cd "/Users/debanshuroy/Documents/Development/Ollie Guardian/ollie-backend"
npm run dev

# Terminal 3 — ngrok (new URL on every restart — update .env and push config after)
ngrok http 3000

# Terminal 4 — Admin UI
cd "/Users/debanshuroy/Documents/Development/Ollie Guardian/ollie-admin"
npm run dev

# After ngrok starts — update CUSTOM_LLM_URL in .env then push config to VAPI
curl -X POST http://localhost:3000/assistant/prompt/update \
  -H "Content-Type: application/json" \
  -d '{"residentId": "dorothy"}'
```

---

## 15. Key API References

| Item | Value |
|---|---|
| VAPI Assistant ID | `14a75005-8f1a-4f9e-89f9-aa9c04dcd378` |
| VAPI Assistant Name | Ollie final |
| ElevenLabs Voice ID | `Awx8TeMHHpDzbm42nIB6` |
| ElevenLabs Model | `eleven_turbo_v2_5` |
| LLM (testing) | Ollama llama3.2 at localhost:11434 |
| LLM (production) | Claude Haiku `claude-haiku-4-5-20251001` via Anthropic |
| STT | Deepgram Nova-2 |
| Backend port | 3000 |
| Admin UI port | 5173 |
