const Conversation = require("../../models/Chat/Conversation");
const ChatMessage = require("../../models/Chat/ChatMessage");
const User = require("../../models/user.model"); // Assuming user.model.js exports 'User'
const { canChat } = require("../../utils/chatPermissions");
const cacheService = require("../../services/cache.service");
const mongoose = require("mongoose");

module.exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`\n💬 [getConversations] userId from JWT: ${userId} (type: ${typeof userId})`);

    // Use ObjectId for the query to ensure proper matching
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      console.log(`❌ [getConversations] Invalid userId: ${userId}`);
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const conversations = await Conversation.find({ participants: userObjectId })
      .populate("participants", "fullname email role profileImage roleDetails")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    console.log(`✅ [getConversations] Found ${conversations.length} conversations for user ${userId}`);

    // Format the response so the client knows who they are talking to
    const formattedConversations = conversations.map(conv => {
      // Find the other participant
      const otherParticipant = conv.participants.find(p => p._id.toString() !== userId.toString());
      return {
        _id: conv._id,
        conversationId: conv._id,
        otherParticipant,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt
      };
    });

    res.status(200).json({ success: true, conversations: formattedConversations });
  } catch (error) {
    console.error("❌ [getConversations] Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    console.log(`\n💬 [getMessages] param: ${conversationId}, userId: ${userId}`);

    let conversation = null;

    // First try: find conversation by its own _id
    if (mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId);
      console.log(`   [getMessages] findById result: ${conversation ? 'found' : 'not found'}`);
    }

    // Second try: maybe 'conversationId' param is actually a receiverId (user ID)
    // This happens when the customer clicks "Chat" on the order page using shopId._id
    if (!conversation && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findOne({
        participants: {
          $all: [
            new mongoose.Types.ObjectId(userId),
            new mongoose.Types.ObjectId(conversationId)
          ]
        }
      });
      console.log(`   [getMessages] findByParticipants result: ${conversation ? 'found' : 'not found'}`);
    }

    // If still no conversation, they haven't chatted yet. Return empty messages.
    if (!conversation) {
      console.log(`   [getMessages] No conversation found, returning empty`);
      return res.status(200).json({ success: true, messages: [], conversationId: null });
    }

    // Authorization: verify the user is part of this conversation
    const isParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      console.log(`   [getMessages] User ${userId} NOT a participant`);
      return res.status(403).json({ success: false, message: "Not authorized to view this conversation" });
    }

    const convIdStr = conversation._id.toString();
    const cacheKey = `chat_messages:${convIdStr}`;
    let messages = await cacheService.get(cacheKey);
    console.log(`   [getMessages] Redis cache ${messages ? 'HIT (' + messages.length + ' msgs)' : 'MISS'}`);

    if (!messages) {
      messages = await ChatMessage.find({ conversationId: conversation._id })
        .populate("senderId", "fullname email role profileImage roleDetails")
        .sort({ createdAt: 1 })
        .lean();

      console.log(`   [getMessages] DB returned ${messages.length} messages`);
      // Cache for 1 day (86400 seconds)
      await cacheService.setEx(cacheKey, 86400, messages);
    }

    res.status(200).json({ success: true, messages, conversationId: conversation._id });
  } catch (error) {
    console.error("❌ [getMessages] Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports.sendMessage = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const messageText = req.body.messageText || req.body.message;
    const senderId = req.user._id;

    console.log(`\n💬 [sendMessage] senderId: ${senderId}, receiverId: ${receiverId}, text: ${messageText ? messageText.substring(0, 30) : 'EMPTY'}`);
    console.log(`   [sendMessage] req.body keys:`, Object.keys(req.body));

    if (!receiverId || !messageText) {
      console.log(`❌ [sendMessage] Missing fields - receiverId: ${receiverId}, messageText: ${messageText}`);
      return res.status(400).json({ success: false, message: "receiverId and message or messageText are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ success: false, message: "Invalid receiverId" });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select('role'),
      User.findById(receiverId).select('role')
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: "Sender or receiver not found" });
    }

    if (!canChat(sender.role, receiver.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to chat with this user" });
    }

    // Find or create conversation using ObjectIds
    const senderObjId = new mongoose.Types.ObjectId(senderId);
    const receiverObjId = new mongoose.Types.ObjectId(receiverId);

    let conversation = await Conversation.findOne({
      participants: { $all: [senderObjId, receiverObjId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderObjId, receiverObjId]
      });
      await conversation.save();
    }

    const newMessage = new ChatMessage({
      conversationId: conversation._id,
      senderId: senderObjId,
      messageText
    });

    await newMessage.save();

    // Update conversation last message
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    await newMessage.populate("senderId", "fullname email role profileImage roleDetails");

    // Update Redis cache
    const convIdStr = conversation._id.toString();
    const cacheKey = `chat_messages:${convIdStr}`;
    let cachedMessages = await cacheService.get(cacheKey);
    if (cachedMessages && Array.isArray(cachedMessages)) {
      cachedMessages.push(newMessage.toJSON());
      await cacheService.setEx(cacheKey, 86400, cachedMessages);
    } else {
      // Build fresh cache from DB
      const messages = await ChatMessage.find({ conversationId: conversation._id })
        .populate("senderId", "fullname email role profileImage roleDetails")
        .sort({ createdAt: 1 })
        .lean();
      await cacheService.setEx(cacheKey, 86400, messages);
    }

    res.status(201).json({
      success: true,
      message: newMessage,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
