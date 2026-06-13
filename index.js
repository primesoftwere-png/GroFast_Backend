const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

const MongoConnection = require("./db/db.js");

const { initializeOrderFlowSocket } = require("./socket/orderFlowSocket.js"); // New order flow socket

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

// Database Connection with Error Handling
(async () => {
  try {
    await MongoConnection();
    
    // Make io accessible in routes
    app.set('io', io);

    // Initialize Socket.IO for order flow
    initializeOrderFlowSocket(io);
    console.log("✓ Socket.IO Order Flow initialized");

    // Configure All Routes (Modular and Centralized)
    configureRoutes(app);

    // Server Startup with Error Handling
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    }).on("error", (error) => {
      if (error.syscall !== "listen") {
        throw error;
      }
      console.error("❌ Server startup error:", error);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1); // Exit process on DB failure for production safety
  }
})();