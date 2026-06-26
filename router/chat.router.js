const express = require("express");
const router = express.Router();
const chatController = require("../controllers/Chat/chat.controller");
const authMiddleware = require("../middlewere/user.middlewere"); // Uses user auth

// All chat routes require authentication
router.use(authMiddleware.userMiddlewere);

// Get all conversations for the logged in user
router.get("/conversations", chatController.getConversations);

// Get all messages for a specific conversation
router.get("/messages/:conversationId", chatController.getMessages);

// Send a message (REST API fallback)
router.post("/send", chatController.sendMessage);

module.exports = router;
