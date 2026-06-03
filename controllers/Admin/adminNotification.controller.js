// controllers/Admin/adminNotification.controller.js
// 🔔 ADMIN NOTIFICATION APIs

const Notification = require('../../models/Customer/Notification');
const DeliveryBoyNotification = require('../../models/DeliveryBoy/DeliveryBoyNotification');
const User = require('../../models/user.model');

/**
 * POST /api/admin/notifications/send
 * Send notification to users
 */
module.exports.sendNotification = async (req, res) => {
  try {
    const { 
      title, 
      message, 
      type, // 'all', 'users', 'shopkeepers', 'deliveryBoys', 'specific'
      userIds, // for specific users
      priority = 'normal' // 'low', 'normal', 'high'
    } = req.body;

    if (!title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and type are required'
      });
    }

    let targetUsers = [];

    // Determine target users based on type
    switch (type) {
      case 'all':
        targetUsers = await User.find({}).select('_id role');
        break;
      case 'users':
        targetUsers = await User.find({ role: 'user' }).select('_id');
        break;
      case 'shopkeepers':
        targetUsers = await User.find({ role: 'admin' }).select('_id');
        break;
      case 'deliveryBoys':
        targetUsers = await User.find({ role: 'deliveryBoy' }).select('_id');
        break;
      case 'specific':
        if (!userIds || userIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'User IDs are required for specific notification'
          });
        }
        targetUsers = await User.find({ _id: { $in: userIds } }).select('_id role');
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid notification type'
        });
    }

    // Create notifications for each user
    const notifications = [];
    for (const user of targetUsers) {
      if (user.role === 'deliveryBoy') {
        notifications.push({
          deliveryBoyId: user._id,
          title: title,
          message: message,
          type: 'admin',
          priority: priority,
          isRead: false
        });
      } else {
        notifications.push({
          userId: user._id,
          title: title,
          message: message,
          type: 'admin',
          priority: priority,
          isRead: false
        });
      }
    }

    // Bulk insert notifications
    const userNotifications = notifications.filter(n => n.userId);
    const deliveryNotifications = notifications.filter(n => n.deliveryBoyId);

    if (userNotifications.length > 0) {
      await Notification.insertMany(userNotifications);
    }

    if (deliveryNotifications.length > 0) {
      await DeliveryBoyNotification.insertMany(deliveryNotifications);
    }

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      targetUsers.forEach(user => {
        io.to(user._id.toString()).emit('notification', {
          title: title,
          message: message,
          type: 'admin',
          priority: priority,
          timestamp: new Date()
        });
      });
    }

    res.json({
      success: true,
      message: 'Notifications sent successfully',
      data: {
        sentCount: targetUsers.length,
        type: type
      }
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/notifications/logs
 * Get notification logs
 */
module.exports.getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;

    const query = {};
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .populate('userId', 'fullname email phone role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching notification logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification logs',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/notifications/push
 * Send push notification (FCM/APNS)
 */
module.exports.sendPushNotification = async (req, res) => {
  try {
    const { title, body, userIds, data } = req.body;

    // TODO: Integrate with Firebase Cloud Messaging (FCM)
    // or Apple Push Notification Service (APNS)
    
    // For now, just log and return success
    console.log('Push notification:', { title, body, userIds, data });

    res.json({
      success: true,
      message: 'Push notification sent successfully',
      data: {
        sentCount: userIds?.length || 0
      }
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send push notification',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/sms/send
 * Send SMS notification
 */
module.exports.sendSMS = async (req, res) => {
  try {
    const { phone, message, userIds } = req.body;

    // TODO: Integrate with SMS gateway (Twilio, AWS SNS, etc.)
    
    console.log('SMS notification:', { phone, message, userIds });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      data: {
        sentCount: userIds?.length || 1
      }
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/email/send
 * Send email notification
 */
module.exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, body, userIds } = req.body;

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    
    console.log('Email notification:', { to, subject, body, userIds });

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        sentCount: userIds?.length || 1
      }
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};
