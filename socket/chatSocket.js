const Conversation = require('../models/Chat/Conversation');
const ChatMessage = require('../models/Chat/ChatMessage');

module.exports.initializeChatSocket = (io) => {
  io.on('connection', (socket) => {
    
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
        const { senderId, receiverId, messageText } = data;

        if (!senderId || !receiverId || !messageText) return;

        // Find or create conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
          conversation = new Conversation({
            participants: [senderId, receiverId]
          });
          await conversation.save();
        }

        // Save message to DB
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

        // Populate sender info for the client
        await newMessage.populate('senderId', 'fullname email role profileImage');

        // Broadcast to the conversation room
        io.to(conversation._id.toString()).emit('receive-message', newMessage);
        
        // Optionally, if the user hasn't joined the room yet, we can emit to user-specific rooms 
        // if we have them tracking `user_roomId`. We will rely on rooms for now.
        // Fallback: we can emit to global 'new-message' if they are listening to generic events.
        io.emit('new-message-notification', { conversationId: conversation._id, message: newMessage, receiverId });

      } catch (error) {
        console.error('Socket chat error:', error);
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
