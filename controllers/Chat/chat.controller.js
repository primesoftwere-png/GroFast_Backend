const Conversation = require("../../models/Chat/Conversation");
const ChatMessage = require("../../models/Chat/ChatMessage");
const User = require("../../models/user.model"); // Assuming user.model.js exports 'User'

module.exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "fullname email role profileImage")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    // Format the response so the client knows who they are talking to
    const formattedConversations = conversations.map(conv => {
      // Find the other participant
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId.toString());
      return {
        _id: conv._id,
        otherParticipant,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt
      };
    });

    res.status(200).json({ success: true, conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Verify the user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized to view this conversation" });
    }

    const messages = await ChatMessage.find({ conversationId })
      .populate("senderId", "fullname email role")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, messageText } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !messageText) {
      return res.status(400).json({ success: false, message: "receiverId and messageText are required" });
    }

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId]
      });
      await conversation.save();
    }

    const newMessage = new ChatMessage({
      conversationId: conversation._id,
      senderId,
      messageText
    });

    await newMessage.save();

    // Update conversation last message
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    res.status(201).json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
