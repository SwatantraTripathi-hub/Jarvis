const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const ai = require("../service/ai.service");
const { createMemory, queryMemory } = require("../service/vector.service");

require("dotenv").config();
const usermodel = require("../models/user.model");
const messageModel = require("../models/message.model");
// ─── CLEAN REWRITE — all previous broken/duplicated code removed ───────────

const MEMORY_TIMEOUT_MS = 350;
const RECENT_HISTORY_LIMIT = 10;

function withTimeout(promise, ms, fallbackValue) {
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallbackValue), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
}

function initSocketServer(httpServer) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);

        try {
          const hostname = new URL(origin).hostname;
          if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return callback(null, true);
          if (hostname.endsWith('.onrender.com')) return callback(null, true);
        } catch (error) {
          // Ignore invalid origins and reject them below.
        }

        return callback(new Error('Not allowed by Socket.IO CORS'));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const cookies = cookie.parse(socket.handshake.headers?.cookie || "");

    if (!cookies.token) {
      return next(new Error("Authentication error:No token provoided"));
    }

    // verifying jwt token
    try {
      const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);
      const user = await usermodel.findById(decoded.id);
      if (!user) {
        return next(new Error("User not found"));
      }
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("Invalid token"));
    }
  });
  
  io.on("connection", (socket) => {
    console.log("User connected:", socket.user._id);

    const processPrompt = async ({ prompt, chat, source = 'text' }) => {
      try {
        if (!prompt || !chat) {
          console.error("Invalid message received from client:", { prompt, chat, source });
          return;
        }

        const userMessagePromise = messageModel.create({
          user: socket.user._id,
          content: prompt,
          role: "user",
          chat,
        });

        const userVectorPromise = ai.generateVector(prompt).catch((err) => {
          console.warn("User vector generation failed:", err.message);
          return null;
        });

        const memoryPromise = (async () => {
          const userVector = await userVectorPromise;
          if (!Array.isArray(userVector) || !userVector.length) return [];

          return queryMemory({
            vector: userVector,
            limit: 3,
            metadataFilter: { chatId: { $eq: chat.toString() } },
          }).catch((err) => {
            console.warn("Memory query failed:", err.message);
            return [];
          });
        })();

        const [chatHistoryDesc, memory] = await Promise.all([
          messageModel.find({ chat }).sort({ createdAt: -1 }).limit(RECENT_HISTORY_LIMIT).lean(),
          withTimeout(memoryPromise, MEMORY_TIMEOUT_MS, []),
        ]);

        const smt = chatHistoryDesc
          .slice()
          .reverse()
          .map((item) => ({ role: item.role, content: item.content }));

        const memoryText = memory
          .map((item) => item?.metadata?.text || "")
          .filter(Boolean)
          .join("\n");

        const ltm = memoryText
          ? [
              {
                role: "system",
                content: `These are relevant past messages from this chat. Use them only as context and do not repeat them verbatim unless needed:\n${memoryText}`,
              },
            ]
          : [];

       
        const sourcePrefix = source === 'voice'
          ? [{ role: 'system', content: 'The latest user query came from voice transcription. Handle minor speech-to-text noise gracefully.' }]
          : [];

        const response = await ai.generateResponse([...sourcePrefix, ...ltm, ...smt, { role: "user", content: prompt }]);

        socket.emit("ai-response", { content: response, chat });
        console.log("AI response:", response);

        const responseMessage = await messageModel.create({
          chat,
          user: socket.user._id,
          role: "model",
          content: response,
        });

        Promise.all([
          userMessagePromise,
          userVectorPromise,
          ai.generateVector(response).catch((err) => {
            console.warn("Response vector generation failed:", err.message);
            return null;
          }),
        ])
          .then(async ([userMessageDoc, userVector, responseVector]) => {
            const jobs = [];

            if (Array.isArray(userVector) && userVector.length && userMessageDoc?._id) {
              jobs.push(
                createMemory({
                  vector: userVector,
                  messageId: userMessageDoc._id.toString(),
                  metadata: {
                    userId: socket.user._id.toString(),
                    chatId: chat.toString(),
                    role: "user",
                    text: prompt.slice(0, 200),
                  },
                })
              );
            }

            if (Array.isArray(responseVector) && responseVector.length) {
              jobs.push(
                createMemory({
                  vector: responseVector,
                  messageId: responseMessage._id.toString(),
                  metadata: {
                    userId: socket.user._id.toString(),
                    chatId: chat.toString(),
                    role: "model",
                    text: response.slice(0, 200),
                  },
                })
              );
            }

            await Promise.all(jobs);
          })
          .catch((err) => console.warn("Background vector storage failed:", err.message));
      }
      
      
      catch (error) {
        console.error("Error processing ai-message:", error.message);
        socket.emit("ai-response", {
          content:
            error.clientMessage ||
            "Error: Failed to get AI response. Please try again.",
          chat,
        });
      }

    };

    socket.on("ai-message", async (message) => {
      await processPrompt({
        prompt: message?.prompt,
        chat: message?.chat,
        source: 'text',
      });
    });

    socket.on("voice-message", async (message) => {
      await processPrompt({
        prompt: message?.transcript || message?.prompt,
        chat: message?.chat,
        source: 'voice',
      });
    });
  });
}

module.exports = { initSocketServer };