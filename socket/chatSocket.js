const Conversation = require('../models/Chat/Conversation');
const ChatMessage = require('../models/Chat/ChatMessage');
const User = require('../models/user.model');
const { canChat } = require('../utils/chatPermissions');
const cacheService = require('../services/cache.service');
const mongoose = require('mongoose');

module.exports.initializeChatSocket = (io) => {
  io.on('connection', (socket) => {

    // Auto-join user to their personal room for chat notifications
    // socket.userId is set by orderFlowSocket's auth middleware
    if (socket.userId) {
      socket.join(socket.userId);
      console.log(`💬 Chat: User ${socket.userId} auto-joined personal room`);
    }

    // User joins a specific conversation room
    socket.on('join-chat', (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
      }
    });

    // Send a message via Socket
    socket.on('send-message', async (data) => {
      try {
        console.log(`\n💬 [Socket send-message] Received data:`, JSON.stringify(data));
        console.log(`   [Socket send-message] socket.userId: ${socket.userId}`);
        
        // Securely use authenticated socket.userId if senderId isn't explicitly provided
        const senderId = data.senderId || socket.userId;
        const receiverId = data.receiverId;
        const messageText = data.messageText || data.message;

        console.log(`   [Socket send-message] Resolved - senderId: ${senderId}, receiverId: ${receiverId}, text: ${messageText ? messageText.substring(0, 30) : 'EMPTY'}`);

        if (!senderId || !receiverId || !messageText) {
          console.error("❌ [Socket send-message] Missing required chat fields:", { senderId, receiverId, messageText });
          return socket.emit('chat-error', { message: 'Missing required fields' });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
          return socket.emit('chat-error', { message: 'Invalid sender or receiver ID' });
        }

        // Verify roles
        const [sender, receiver] = await Promise.all([
          User.findById(senderId).select('role'),
          User.findById(receiverId).select('role')
        ]);

        if (!sender || !receiver) {
          return socket.emit('chat-error', { message: 'Sender or receiver not found' });
        }

        if (!canChat(sender.role, receiver.role)) {
          return socket.emit('chat-error', { message: 'You do not have permission to chat with this user' });
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

        // Save message to DB
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

        // Populate sender info for the client
        await newMessage.populate('senderId', 'fullname email role profileImage roleDetails');

        // Redis cache logic for 1 day (86400 seconds)
        const convIdStr = conversation._id.toString();
        const cacheKey = `chat_messages:${convIdStr}`;
        let cachedMessages = await cacheService.get(cacheKey);
        if (cachedMessages && Array.isArray(cachedMessages)) {
          cachedMessages.push(newMessage.toJSON());
          await cacheService.setEx(cacheKey, 86400, cachedMessages);
        } else {
          const messages = await ChatMessage.find({ conversationId: conversation._id })
            .populate("senderId", "fullname email role profileImage roleDetails")
            .sort({ createdAt: 1 })
            .lean();
          await cacheService.setEx(cacheKey, 86400, messages);
        }

        // Prepare the message payload
        const messagePayload = {
          ...newMessage.toJSON(),
          conversationId: conversation._id
        };

        // Broadcast to the conversation room
        io.to(convIdStr).emit('receive-message', messagePayload);

        // Broadcast to the receiver's personal room (fallback for shopkeeper panels)
        io.to(receiverId.toString()).emit('receive-message', messagePayload);
        io.to(senderId.toString()).emit('receive-message', messagePayload); // Echo back to sender

        // If the frontend explicitly passed a roomId (like order_chat_123), emit there too
        if (data.roomId) {
          io.to(data.roomId).emit('receive-message', messagePayload);
        }

        // Global notification
        io.emit('new-message-notification', {
          conversationId: conversation._id,
          message: messagePayload,
          receiverId,
          roomId: data.roomId
        });

      } catch (error) {
        console.error('Socket chat error:', error);
        socket.emit('chat-error', { message: 'Failed to send message' });
      }
    });

    // Leave a room
    socket.on('leave-chat', (conversationId) => {
      if (conversationId) {
        socket.leave(conversationId);
        console.log(`Socket ${socket.id} left conversation ${conversationId}`);
      }
    });

  });
};
