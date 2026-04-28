const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

const MongoConnection = require("./db/db.js");

const orderSocket = require("./socket/orderSocket.js"); // Socket logic for orders
// const locationSocket = require("./socket/locationSocket.js"); // Uncomment and integrate if needed

const configureRoutes = require("./router/index.js"); // Centralized route configuration

const app = express();
const server = http.createServer(app); // For Socket.IO support

const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

// Core Middleware (applied globally before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use("/uploads", express.static("uploads"));

// Database Connection with Error Handling (Reverted to try-catch for compatibility)
try {
  MongoConnection();
  console.log("MongoDB connected successfully");
} catch (error) {
  console.error("MongoDB connection error:", error);
  process.exit(1); // Exit process on DB failure for production safety
}

// Configure All Routes (Modular and Centralized)
configureRoutes(app);

// Socket.IO Handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  orderSocket(io, socket); // Order socket logic
  // If needed: locationSocket(io, socket); // Location socket logic

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Server Startup with Error Handling
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on("error", (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  console.error("Server startup error:", error);
});