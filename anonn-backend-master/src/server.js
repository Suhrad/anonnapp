import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import connectDB from "./config/database.js";
import mongoose from "mongoose";
import errorHandler from "./middleware/errorHandler.js";
import { swaggerSpec, swaggerUi, swaggerUiOptions } from "./config/swagger.js";
import { validateEnv } from "./config/envValidation.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import {
  requestId,
  checkRequestSize,
  sanitizeData,
  xssProtection,
  preventParamPollution,
  securityHeaders,
} from "./middleware/security.js";

// Import routes
import authRoutes from "./routes/auth.js";
import ethAuthRoutes from "./routes/ethAuth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import pollRoutes from "./routes/polls.js";
import communityRoutes from "./routes/communities.js";
import bowlRoutes from "./routes/bowls.js";
import companyRoutes from "./routes/companies.js";
import notificationRoutes from "./routes/notifications.js";
import feedRoutes from "./routes/feed.js";
import walletRoutes from "./routes/wallet.js";
import commentRoutes from "./routes/comments.js";
import chatRoutes from "./routes/chat.js";
import marketRoutes from "./routes/markets.js";
import anonRoutes from "./routes/anonymous.js";
import { verifyAccessToken } from "./utils/jwt.js";
import User from "./models/User.js";
import ChatGroup from "./models/ChatGroup.js";
import {
  registerConnection,
  unregisterConnection,
  subscribeSocketToGroup,
  unsubscribeSocketFromGroup,
  sendToSocket,
} from "./realtime/chatHub.js";

// Load environment variables
dotenv.config();

// Validate environment variables
try {
  validateEnv();
  console.log("✅ Environment variables validated");
} catch (error) {
  console.error("❌ Environment validation failed:", error.message);
  process.exit(1);
}

// Initialize Express app
const app = express();

// Connect to database
connectDB();

// Security Middleware
app.use(requestId);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrcElem: ["'self'", "https://unpkg.com", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        scriptSrcElem: ["'self'", "https://unpkg.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(securityHeaders);
app.use(checkRequestSize);
app.use(sanitizeData);
app.use(xssProtection);
app.use(preventParamPollution);

// Request sanitization (redundant with sanitizeData but keeping for safety if sanitizeData changes)
// app.use(mongoSanitize());

// CORS - Enhanced configuration

// CORS - Enhanced configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);

    // Default allowed origins (including production frontend)
    const defaultOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://anonn-frontend-psi.vercel.app",
      "https://anonn-frontend.vercel.app",
    ];

    // Parse allowed origins from environment variable (comma-separated)
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : defaultOrigins;

    // Check if the origin is in the allowed list or if wildcard is set
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `⚠️  CORS: Request from non-whitelisted origin: ${origin}`
        );
        callback(null, true);
      } else {
        // In production, block non-whitelisted origins
        console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Access-Token",
    "X-Refresh-Token",
    "X-Requested-With",
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Origin",
    "Access-Control-Expose-Headers",
    "Access-Control-Request-Headers",
    "Access-Control-Request-Method",
  ], // Explicitly allow Authorization and common headers
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // Cache preflight for 24 hours
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// Handle preflight OPTIONS requests before any other middleware
app.options("*", cors(corsOptions));

app.use(cors(corsOptions));

// Explicit preflight handling for all routes
app.options("*", cors(corsOptions));

// Body parsing

// JSON body parser with error handling
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Catch JSON parse errors and return JSON instead of HTML
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
      errorCode: "INVALID_JSON",
      requestId: req.id,
    });
  }
  next(err);
});

import { readFileSync } from "fs";
import path from "path";

if (process.env.VERCEL === "1") {
  // On Vercel, serve static swagger.html at /api-docs
  app.get("/api-docs", (req, res) => {
    const swaggerHtmlPath = path.join(
      process.cwd(),
      "src",
      "public",
      "swagger.html"
    );
    let html = readFileSync(swaggerHtmlPath, "utf8");
    // Optionally inject the OpenAPI spec URL dynamically
    html = html.replace('"/openapi.json"', '"/api-docs/openapi.json"');
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });
  // Serve the OpenAPI spec as JSON for Swagger UI
  app.get("/api-docs/openapi.json", (req, res) => {
    res.json(swaggerSpec);
  });
} else {
  // Local/dev: use swagger-ui-express middleware
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );
}

// API version info
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Anonn Backend API",
    version: "1.0.0",
    documentation: "/api-docs",
    health: "/health",
  });
});

// Health check endpoint (for Render and monitoring)
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: process.uptime(),
  });
});

// Apply rate limiting to all API routes
app.use("/api", apiLimiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth/eth", ethAuthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/bowls", bowlRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/anon", anonRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server (only in non-serverless environments)
const PORT = process.env.PORT || 8000;

// For Vercel serverless, don't start the server
if (process.env.VERCEL !== "1") {
  const server = app.listen(PORT, () => {
    console.log(
      `\n🚀 Server running in ${
        process.env.NODE_ENV || "development"
      } mode on port ${PORT}`
    );
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`📚 API Documentation at http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
  });

  // --- WebSocket server for /api/ws ---
  import("ws").then(({ WebSocketServer }) => {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname === "/api/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on("connection", async (ws, request) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get("token");
      let currentAnonymousId = null;

      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          const user = await User.findById(decoded.id).select("_id anonymousId");
          if (user) {
            currentAnonymousId = decoded.anonymousId || user.anonymousId;
            if (currentAnonymousId) {
              registerConnection(currentAnonymousId, ws);
            }
          }
        } catch (error) {
          sendToSocket(ws, {
            type: "warning",
            message: "WebSocket auth failed. Connect again with a valid token.",
          });
        }
      }

      sendToSocket(ws, {
        type: "connected",
        message: "WebSocket connection established",
        authenticated: Boolean(currentAnonymousId),
      });

      ws.on("message", async (rawMsg) => {
        let msg = null;
        try {
          msg = JSON.parse(rawMsg.toString());
        } catch (error) {
          sendToSocket(ws, { type: "error", message: "Invalid JSON message" });
          return;
        }

        if (msg?.type === "ping") {
          sendToSocket(ws, { type: "pong", timestamp: new Date().toISOString() });
          return;
        }

        if (!currentAnonymousId) {
          sendToSocket(ws, { type: "error", message: "Authentication required for this action" });
          return;
        }

        if (msg?.type === "subscribe_group" && msg.groupId) {
          const group = await ChatGroup.findOne({
            _id: msg.groupId,
            isActive: true,
            "members.anonUserId": currentAnonymousId,
          }).select("_id");

          if (!group) {
            sendToSocket(ws, { type: "error", message: "Group not found or access denied" });
            return;
          }

          subscribeSocketToGroup(ws, msg.groupId);
          sendToSocket(ws, { type: "subscribed_group", groupId: msg.groupId });
          return;
        }

        if (msg?.type === "unsubscribe_group" && msg.groupId) {
          unsubscribeSocketFromGroup(ws, msg.groupId);
          sendToSocket(ws, { type: "unsubscribed_group", groupId: msg.groupId });
          return;
        }
      });

      ws.on("close", () => {
        unregisterConnection(ws);
      });
    });
    console.log("🟢 WebSocket server listening on /api/ws");
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });
}

// Export for Vercel serverless
export default app;
