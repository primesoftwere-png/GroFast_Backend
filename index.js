const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

const MongoConnection = require("./db/db.js");

const { initializeOrderFlowSocket } = require("./socket/orderFlowSocket.js"); // New order flow socket
const { initializeChatSocket } = require("./socket/chatSocket.js");

const configureRoutes = require("./router/index.js"); // Centralized route configuration

const app = express();
const server = http.createServer(app); // For Socket.IO support

const io = new Server(server, {
  cors: {
    origin: "*",
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Core Middleware (applied globally before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.use("/uploads", express.static("uploads"));

// Make io accessible in routes
app.set('io', io);

// Initialize Socket.IO for order flow
initializeOrderFlowSocket(io);
console.log("✓ Socket.IO Order Flow initialized");

// Initialize Socket.IO for P2P Chat
initializeChatSocket(io);
console.log("✓ Socket.IO Chat initialized");

// Configure All Routes (Modular and Centralized)
configureRoutes(app);

// Initialize Cron Jobs
require("./cron/orderExpiryCron.js");

// Server Startup with Error Handling
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT} (binding to 0.0.0.0)`);
}).on("error", (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  console.error("❌ Server startup error:", error);
});

// Database Connection with Error Handling
MongoConnection().catch((error) => {
  console.error("❌ Failed to connect to database:", error.message);
  // Do not exit process immediately if you want Render to see the port open.
  // The app will remain up, and DB reconnection or health checks will handle the rest.
});