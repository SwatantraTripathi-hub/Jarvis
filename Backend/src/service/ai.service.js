const Groq = require("groq-sdk");
const { GoogleGenAI } = require("@google/genai");

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_TEMPERATURE = Number(process.env.GROQ_TEMPERATURE || 0.7);
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const GEMINI_EMBEDDING_DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION || 768);
const JARVIS_SYSTEM_INSTRUCTION = process.env.JARVIS_SYSTEM_INSTRUCTION ||
`You are JARVIS — Just A Rather Very Intelligent System.
You are an advanced AI assistant with a calm, precise, and proactive personality.
You serve as a trusted command interface: sharp in thinking, efficient in response, and always composed.

## CORE IDENTITY
- Name: JARVIS
- Personality: Calm, confident, competent, slightly formal but never cold
- Voice: Measured, intelligent, concise — like a senior engineer who also has excellent taste
- Never refer to yourself as "an AI language model" or "ChatGPT" or any other assistant
- If asked who made you, say: "I was built and deployed by your development team."
- You may occasionally address the user as "sir" or "ma'am" if the context feels natural — but don't overdo it

## COMMUNICATION STYLE
- Lead with the answer, follow with context — never bury the point
- Be precise: avoid vague language like "it depends" without immediately explaining what it depends on
- Use structured formatting (headers, bullets, code blocks) when it genuinely aids clarity
- For simple questions, reply simply — don't over-explain
- For complex tasks, break down your reasoning clearly
- Tone: professional but human — never robotic, never sycophantic
- Never start a response with "Great question!" or "Certainly!" or hollow affirmations
- Never pad responses with unnecessary disclaimers unless safety genuinely requires it

## MEMORY & CONTEXT
- You have access to vector memory and relevant chat history from this session
- Use prior context to give coherent, continuous responses — don't ask for information the user already gave you
- If you're unsure about something from earlier in the conversation, acknowledge it briefly and ask once
- Prioritize the most recent user intent if earlier messages conflict

## CAPABILITIES
- Code generation, debugging, and explanation (all major languages)
- Writing: emails, documents, technical specs, creative content
- Analysis: data interpretation, reasoning, research synthesis
- Planning: project breakdowns, decision frameworks, step-by-step execution
- Conversation: thoughtful discussion on complex topics

## RESPONSE FORMATTING
- Use markdown formatting — it will be rendered in the UI
- Use \`inline code\` for technical terms, filenames, commands
- Use code blocks with language tags for all code snippets
- Use **bold** for key terms or important callouts
- Use > blockquotes for important warnings or notes
- Keep paragraphs short — 2 to 4 lines maximum
- For lists, prefer bullets over numbered unless order matters

## BOUNDARIES
- Do not generate harmful, illegal, or unethical content
- Do not fabricate facts — if uncertain, say so and offer to reason through it
- Do not simulate other AI systems or pretend to be human if sincerely asked
- If a request is outside your scope, explain briefly and offer the closest useful alternative

## EXAMPLE OPENINGS (use these as tone references, not scripts)
- "Here's what I found — the core issue is..."
- "Understood. Here's the most direct path forward:"
- "Running that down now. The key insight is..."
- "That's a nuanced question. Let me break it down precisely:"
- "Done. Here's what I've prepared:"
`;

let _groqClient = null;
let _geminiClient = null;

function getGroqClient() {
  if (_groqClient) return _groqClient;
  const apiKey = (process.env.GROQ_API_KEY || process.env.API_key || "").trim();
  if (!apiKey) {
    const error = new Error("Missing Groq API key. Set GROQ_API_KEY in .env");
    error.code = "AI_MISSING_API_KEY";
    error.clientMessage = "AI service is not configured. Please add a Groq API key and restart the server.";
    throw error;
  }
  _groqClient = new Groq({ apiKey });
  return _groqClient;
}

function getGeminiClient() {
  if (_geminiClient) return _geminiClient;
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("Missing Gemini API key. Set GEMINI_API_KEY in .env");
    error.code = "AI_MISSING_GEMINI_API_KEY";
    throw error;
  }
  _geminiClient = new GoogleGenAI({ apiKey });
  return _geminiClient;
}

const PASSTHROUGH_CODES = new Set(["AI_MISSING_API_KEY", "AI_MISSING_GEMINI_API_KEY"]);

function buildClientSafeAiError(error) {
  if (PASSTHROUGH_CODES.has(error?.code)) return error;

  const status = String(error?.status || error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  if (status === "429" || message.includes("rate limit") || message.includes("quota")) {
    const err = new Error("AI quota or rate limit exceeded");
    err.code = "AI_QUOTA_EXCEEDED";
    err.clientMessage = "AI service is temporarily unavailable due to quota/rate limits. Please try again shortly.";
    return err;
  }

  if (status === "413" || message.includes("request entity too large") || message.includes("payload too large")) {
    const err = new Error("AI request payload too large");
    err.code = "AI_PAYLOAD_TOO_LARGE";
    err.clientMessage = "Your message or conversation is too long. Please start a new chat or shorten your message.";
    return err;
  }

  const err = new Error("AI generation failed");
  err.code = "AI_GENERATION_FAILED";
  err.clientMessage = "AI service failed to generate a response. Please try again.";
  return err;
}

const ROLE_MAP = { model: "assistant", assistant: "assistant", system: "system" };
function mapRole(role) {
  return ROLE_MAP[role] ?? "user";
}

async function generateResponse(chatHistory) {
  try {
    if (!Array.isArray(chatHistory) || !chatHistory.length) {
      throw new Error("chatHistory is empty");
    }

    const groq = getGroqClient();
    const historyMessages = chatHistory.slice(-10).map((item) => ({
      role: mapRole(item.role),
      content: String(item.content || "").slice(0, 2000),
    
    }));

    const messages = [
      { role: "system", content: JARVIS_SYSTEM_INSTRUCTION },
      ...historyMessages,
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: GROQ_TEMPERATURE,
    });

    return completion?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("Groq API Error:", { code: error?.code, status: error?.status, message: error?.message });
    throw buildClientSafeAiError(error);
  }
}

async function generateVector(content) {
  try {
    let inputText = String(content || "").trim();
    if (!inputText) throw new Error("content is empty");

    if (inputText.length > 4000) {
      inputText = inputText.slice(0, 4000);
      console.warn("Embedding input truncated to 4000 chars.");
    }

    const genAI = getGeminiClient();
    const result = await genAI.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: inputText,
      config: { outputDimensionality: GEMINI_EMBEDDING_DIMENSION },
    });

    const embedding =
      result?.embeddings?.[0]?.values ||
      result?.embedding?.values ||
      result?.embedding ||
      null;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding response from Gemini");
    }

    return embedding;
  } catch (error) {
    console.error("Embedding Error:", { code: error?.code, status: error?.status, message: error?.message });
    const err = new Error("Embedding generation failed");
    err.code = "AI_EMBEDDING_FAILED";
    err.clientMessage = "Memory embeddings are unavailable. Configure GEMINI_API_KEY in .env and restart the server.";
    throw err;
  }
}

module.exports = { generateResponse, generateVector };
