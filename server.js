require("dotenv").config();

const fs = require("fs");

const path = require("path");

// Socket.IO — initialized after fastify.listen() in start()
let io;

const fastify = require("fastify")({
  logger: true,
});

const { Server } = require("socket.io");
const cors = require("@fastify/cors");
const multipart = require("@fastify/multipart");

const {
  createClient,
  LiveTranscriptionEvents,
} = require("@deepgram/sdk");

const db = require("./database");

// Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Register plugins
fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
fastify.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB
  },
});

// ==============================
// SOCKET CONNECTION (set up inside start() after listen)
// ==============================
function setupSocketIO() {
  io = new Server(fastify.server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
  console.log("Client connected");

  let currentSessionId = 1;

  let currentSpeechBubble = null;

  // System audio variables
  let systemDeepgramConnection;
  let systemKeepAlive;
  let systemAudioQueue = [];
  let currentSystemSpeechBubble = null;

  socket.on("join-session", (sessionId) => {
    currentSessionId = sessionId;
  });

  let deepgramConnection;
  let keepAlive;
  let audioQueue = []; // Queue for chunks received before Deepgram is ready

  socket.on("start-transcribing", () => {
    console.log("Starting new Deepgram connection...");
    
    // Clean up existing connection if any
    if (deepgramConnection) {
      clearInterval(keepAlive);
      deepgramConnection.finish();
    }

    // Create Deepgram realtime connection
    deepgramConnection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      endpointing: 4000, // Important: Tells Deepgram that 4000ms of silence = end of sentence
    });

    // Deepgram opened
    deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      // Safeguard: If the user clicked Stop before it opened, deepgramConnection will be null
      if (!deepgramConnection) return;

      console.log("Deepgram connection opened");

      // Flush queued audio chunks
      if (audioQueue.length > 0) {
        console.log(`Flushing ${audioQueue.length} queued audio chunks...`);
        audioQueue.forEach((chunk) => deepgramConnection.send(chunk));
        audioQueue = [];
      }

      // Keep connection alive
      keepAlive = setInterval(() => {
        if (deepgramConnection.getReadyState() === 1) {
          deepgramConnection.keepAlive();
        }
      }, 10 * 1000);

      // Receive transcripts
      deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;

        if (!transcript) return;

        // Partial transcript
        if (!data.is_final) {
          socket.emit("partial", transcript);
        }

        // Final transcript
        if (data.is_final) {
          const now = Date.now();

          if (!currentSpeechBubble || currentSpeechBubble.sessionId !== currentSessionId || now - currentSpeechBubble.lastUpdate > 4000) {
            currentSpeechBubble = {
              id: now,
              dbId: null,
              sessionId: currentSessionId,
              speaker: "You",
              text: transcript,
              createdAt: new Date().toLocaleTimeString(),
              lastUpdate: now
            };

            const bubbleRef = currentSpeechBubble;

            db.run(
              `INSERT INTO messages (sessionId, speaker, text, createdAt) VALUES (?, ?, ?, ?)`,
              [bubbleRef.sessionId, bubbleRef.speaker, bubbleRef.text, bubbleRef.createdAt],
              function(err) {
                if (!err) {
                  bubbleRef.dbId = this.lastID;
                  db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), bubbleRef.sessionId]);
                }
              }
            );

            socket.emit("message", {
              id: bubbleRef.id,
              sessionId: bubbleRef.sessionId,
              speaker: bubbleRef.speaker,
              text: bubbleRef.text,
              createdAt: bubbleRef.createdAt
            });

          } else {
            currentSpeechBubble.text += " " + transcript;
            currentSpeechBubble.lastUpdate = now;
            const bubbleRef = currentSpeechBubble;

            const updateDb = () => {
              if (bubbleRef.dbId) {
                db.run(`UPDATE messages SET text = ? WHERE id = ?`, [bubbleRef.text, bubbleRef.dbId]);
                db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), bubbleRef.sessionId]);
              } else {
                setTimeout(updateDb, 50);
              }
            };
            updateDb();

            socket.emit("update-message", {
              id: bubbleRef.id,
              text: bubbleRef.text
            });
          }
        }
      });
    });
  });

  // Receive audio chunks
  socket.on("audio-chunk", (chunk) => {
    if (deepgramConnection) {
      if (deepgramConnection.getReadyState() === 1) {
        deepgramConnection.send(chunk);
      } else {
        // Connection isn't ready yet! Queue the chunk so we don't lose the WebM header.
        audioQueue.push(chunk);
      }
    }
  });

  // Stop transcribing
  socket.on("stop-transcribing", () => {
    console.log("Stopping Deepgram connection...");
    if (deepgramConnection) {
      clearInterval(keepAlive);
      deepgramConnection.finish();
      deepgramConnection = null;
    }
    audioQueue = []; // Clear queue
    currentSpeechBubble = null;
  });

  // ── SYSTEM AUDIO ──────────────────────────────

  socket.on("start-system-transcribing", () => {
    console.log("Starting system audio Deepgram connection...");

    if (systemDeepgramConnection) {
      clearInterval(systemKeepAlive);
      systemDeepgramConnection.finish();
    }

    systemDeepgramConnection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      endpointing: 4000,
    });

    systemDeepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      if (!systemDeepgramConnection) return;

      console.log("System audio Deepgram connection opened");

      if (systemAudioQueue.length > 0) {
        systemAudioQueue.forEach((chunk) => systemDeepgramConnection.send(chunk));
        systemAudioQueue = [];
      }

      systemKeepAlive = setInterval(() => {
        if (systemDeepgramConnection.getReadyState() === 1) {
          systemDeepgramConnection.keepAlive();
        }
      }, 10 * 1000);

      systemDeepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;

        if (!transcript) return;

        if (!data.is_final) {
          socket.emit("system-partial", transcript);
        }

        if (data.is_final) {
          const now = Date.now();

          if (!currentSystemSpeechBubble || currentSystemSpeechBubble.sessionId !== currentSessionId || now - currentSystemSpeechBubble.lastUpdate > 4000) {
            currentSystemSpeechBubble = {
              id: now + 1, // +1 to avoid ID clash with mic bubble if created at same ms
              dbId: null,
              sessionId: currentSessionId,
              speaker: "Others",
              text: transcript,
              createdAt: new Date().toLocaleTimeString(),
              lastUpdate: now,
            };

            const bubbleRef = currentSystemSpeechBubble;

            db.run(
              `INSERT INTO messages (sessionId, speaker, text, createdAt) VALUES (?, ?, ?, ?)`,
              [bubbleRef.sessionId, bubbleRef.speaker, bubbleRef.text, bubbleRef.createdAt],
              function (err) {
                if (!err) {
                  bubbleRef.dbId = this.lastID;
                  db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), bubbleRef.sessionId]);
                }
              }
            );

            socket.emit("message", {
              id: bubbleRef.id,
              sessionId: bubbleRef.sessionId,
              speaker: bubbleRef.speaker,
              text: bubbleRef.text,
              createdAt: bubbleRef.createdAt,
            });

          } else {
            currentSystemSpeechBubble.text += " " + transcript;
            currentSystemSpeechBubble.lastUpdate = now;
            const bubbleRef = currentSystemSpeechBubble;

            const updateDb = () => {
              if (bubbleRef.dbId) {
                db.run(`UPDATE messages SET text = ? WHERE id = ?`, [bubbleRef.text, bubbleRef.dbId]);
                db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), bubbleRef.sessionId]);
              } else {
                setTimeout(updateDb, 50);
              }
            };
            updateDb();

            socket.emit("update-message", {
              id: bubbleRef.id,
              text: bubbleRef.text,
            });
          }
        }
      });
    });
  });

  socket.on("system-audio-chunk", (chunk) => {
    if (systemDeepgramConnection) {
      if (systemDeepgramConnection.getReadyState() === 1) {
        systemDeepgramConnection.send(chunk);
      } else {
        systemAudioQueue.push(chunk);
      }
    }
  });

  socket.on("stop-system-transcribing", () => {
    console.log("Stopping system audio Deepgram connection...");
    if (systemDeepgramConnection) {
      clearInterval(systemKeepAlive);
      systemDeepgramConnection.finish();
      systemDeepgramConnection = null;
    }
    systemAudioQueue = [];
    currentSystemSpeechBubble = null;
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    if (deepgramConnection) {
      clearInterval(keepAlive);
      deepgramConnection.finish();
    }
    if (systemDeepgramConnection) {
      clearInterval(systemKeepAlive);
      systemDeepgramConnection.finish();
    }
    audioQueue = [];
    systemAudioQueue = [];
    currentSpeechBubble = null;
    currentSystemSpeechBubble = null;
  });
  });
}

// ==============================
// ROOT ROUTE
// ==============================

fastify.get("/", async () => {
  return {
    message: "Server running",
  };
});

// ==============================
// SESSIONS
// ==============================

// GET sessions
fastify.get(
  "/sessions",
  async (request, reply) => {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM sessions ORDER BY updatedAt DESC, id DESC",
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }
);

// CREATE session
fastify.post(
  "/sessions",
  async (request, reply) => {
    const { title } = request.body;
    const createdAt = new Date().toLocaleTimeString();
    const updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(
        `
        INSERT INTO sessions
        (title, createdAt, updatedAt)
        VALUES (?, ?, ?)
        `,
        [title, createdAt, updatedAt],
        function (err) {
          if (err) return reject(err);

          resolve({
            id: this.lastID,
            title,
            createdAt,
          });
        }
      );
    });
  }
);

// DELETE session
fastify.delete(
  "/sessions/:id",
  async (request, reply) => {
    const { id } = request.params;

    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM sessions WHERE id = ?",
        [id],
        function (err) {
          if (err) return reject(err);

          // Also delete messages
          db.run("DELETE FROM messages WHERE sessionId = ?", [id]);

          resolve({ success: true });
        }
      );
    });
  }
);

// CLEAR messages in session
fastify.delete(
  "/sessions/:id/messages",
  async (request, reply) => {
    const { id } = request.params;

    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM messages WHERE sessionId = ?",
        [id],
        function (err) {
          if (err) return reject(err);

          // Update session updatedAt
          db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), id]);

          resolve({ success: true });
        }
      );
    });
  }
);

// RENAME session
fastify.put(
  "/sessions/:id",
  async (request, reply) => {
    const { id } = request.params;
    const { title } = request.body;

    return new Promise((resolve, reject) => {
      db.run(
        `
        UPDATE sessions
        SET title = ?
        WHERE id = ?
        `,
        [title, id],
        function (err) {
          if (err) return reject(err);

          resolve({ id, title });
        }
      );
    });
  }
);

// GET messages
fastify.get(
  "/messages",
  async (request, reply) => {
    const { sessionId } = request.query;

    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT * FROM messages
        WHERE sessionId = ?
        ORDER BY id ASC
        `,
        [sessionId],
        (err, rows) => {
          if (err) return reject(err);

          resolve(rows);
        }
      );
    });
  }
);

// POST message
fastify.post(
  "/messages",
  async (request, reply) => {
    const { sessionId, speaker, text } = request.body;
    const createdAt = new Date().toLocaleTimeString();

    return new Promise((resolve, reject) => {
      db.run(
        `
        INSERT INTO messages
        (sessionId, speaker, text, createdAt)
        VALUES (?, ?, ?, ?)
        `,
        [sessionId, speaker, text, createdAt],
        function (err) {
          if (err) return reject(err);

          db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [new Date().toISOString(), sessionId]);

          const newMessage = {
            id: this.lastID,
            sessionId,
            speaker,
            text,
            createdAt,
          };

          io.emit("message", newMessage);
          resolve({ data: newMessage });
        }
      );
    });
  }
);


// ==============================
// UPLOAD & TRANSCRIBE (pre-recorded)
// ==============================

fastify.post("/upload", { bodyLimit: 500 * 1024 * 1024 }, async (request, reply) => {
  console.log("📥 /upload hit");

  let fileBuffer = null;
  let mimetype = "audio/webm";
  let sid = null;
  let sockId = null;
  let fileName = "";

  try {
    // Iterate all parts (fields + file) from the multipart form
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file") {
        fileName = part.filename || "upload";
        mimetype = part.mimetype || "audio/webm";
        const chunks = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        console.log(`📦 File received: "${fileName}" (${(fileBuffer.length / 1024).toFixed(1)} KB, ${mimetype})`);
      } else {
        // Text field
        if (part.fieldname === "sessionId") sid = part.value ? Number(part.value) : null;
        if (part.fieldname === "socketId") sockId = part.value || null;
        console.log(`🏷️  Field: ${part.fieldname} = ${part.value}`);
      }
    }
  } catch (parseErr) {
    console.error("❌ Multipart parse error:", parseErr);
    return reply.status(400).send({ error: "Could not parse upload" });
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    console.error("❌ No file data received");
    return reply.status(400).send({ error: "No file uploaded" });
  }

  console.log(`🔑 sessionId=${sid}  socketId=${sockId}`);
  console.log(`🚀 Sending to Deepgram (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)…`);

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fileBuffer,
      {
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        mimetype,
      }
    );

    if (error) {
      console.error("❌ Deepgram error:", JSON.stringify(error));
      return reply.status(500).send({ error: "Deepgram transcription failed" });
    }

    console.log("✅ Deepgram responded");

    // Debug: log the raw result structure
    const alt = result?.results?.channels?.[0]?.alternatives?.[0];
    console.log("📝 Full transcript length:", alt?.transcript?.length ?? 0);
    console.log("📝 Paragraphs:", alt?.paragraphs?.paragraphs?.length ?? "none");

    const paragraphs = alt?.paragraphs?.paragraphs;
    const fullTranscript = alt?.transcript ?? "";

    const segments = [];

    if (paragraphs && paragraphs.length > 0) {
      for (const para of paragraphs) {
        const text = para.sentences?.map((s) => s.text).join(" ") ?? "";
        if (text.trim()) segments.push(text.trim());
      }
    } else if (fullTranscript.trim()) {
      // Split into ~sentence-sized chunks for readability
      const sentences = fullTranscript.match(/[^.!?]+[.!?]+/g) ?? [fullTranscript];
      let chunk = "";
      for (const s of sentences) {
        chunk += s;
        if (chunk.trim().length > 200) {
          segments.push(chunk.trim());
          chunk = "";
        }
      }
      if (chunk.trim()) segments.push(chunk.trim());
    }

    console.log(`💬 Segments to emit: ${segments.length}`);

    if (segments.length === 0) {
      console.warn("⚠️  No speech detected in file");
      if (sockId && io) io.to(sockId).emit("upload-done", { empty: true });
      return { success: true, segments: 0 };
    }

    const createdAt = new Date().toLocaleTimeString();

    for (let i = 0; i < segments.length; i++) {
      const text = segments[i];

      // Stagger: wait 350ms between each segment so they stream in like realtime
      if (i > 0) {
        await new Promise(r => setTimeout(r, 350));
      }

      if (!sid) {
        if (sockId && io) {
          const msgId = Date.now() + Math.random();
          io.to(sockId).emit("message", {
            id: msgId,
            sessionId: null,
            speaker: "Upload",
            text,
            createdAt,
          });
        }
      } else {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO messages (sessionId, speaker, text, createdAt) VALUES (?, ?, ?, ?)`,
            [sid, "Upload", text, createdAt],
            function (err) {
              if (err) return reject(err);
              const msg = {
                id: this.lastID,
                sessionId: sid,
                speaker: "Upload",
                text,
                createdAt,
              };
              if (sockId && io) io.to(sockId).emit("message", msg);
              db.run(`UPDATE sessions SET updatedAt = ? WHERE id = ?`, [
                new Date().toISOString(),
                sid,
              ]);
              resolve(null);
            }
          );
        });
      }
    }

    if (sockId && io) io.to(sockId).emit("upload-done", { segments: segments.length });
    console.log(`✅ Done — emitted ${segments.length} segments`);

    return { success: true, segments: segments.length };
  } catch (err) {
    console.error("❌ Upload transcription error:", err);
    if (sockId && io) io.to(sockId).emit("upload-done", { empty: true });
    return reply.status(500).send({ error: "Internal error during transcription" });
  }
});

// ==============================
// START SERVER
// ==============================

const start = async () => {
  try {
    await fastify.listen({
      port: 3000,
    });

    // ✅ Attach Socket.IO AFTER the HTTP server is fully listening
    setupSocketIO();

    console.log("Server running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();