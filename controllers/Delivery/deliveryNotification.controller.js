// controllers/Delivery/deliveryNotification.controller.js
const DeliveryBoyNotification = require("../../models/DeliveryBoy/DeliveryBoyNotification");

// ✅ Get Notifications
module.exports.getNotifications = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { page = 1, limit = 20, isRead, type, priority } = req.query;

    // Build query
    const query = { deliveryBoyId };

    if (typeof isRead !== 'undefined') {
      query.isRead = isRead === 'true';
    }

    if (type) {
      const validTypes = [
        'order_assigned', 'order_cancelled', 'payment_received', 
        'settlement_approved', 'settlement_rejected', 'kyc_approved', 
        'kyc_rejected', 'account_blocked', 'account_unblocked', 
        'system', 'promotional'
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Allowed: ${validTypes.join(', ')}`
        });
      }
      query.type = type;
    }

    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
        });
      }
      query.priority = priority;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await DeliveryBoyNotification.find(query)
      .populate('orderId', 'orderNumber totalAmount orderStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalNotifications = await DeliveryBoyNotification.countDocuments(query);
    const totalPages = Math.ceil(totalNotifications / parseInt(limit));

    // Get unread count
    const unreadCount = await DeliveryBoyNotification.countDocuments({
      deliveryBoyId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications: notifications,
        unreadCount: unreadCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalNotifications: totalNotifications,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Mark Notification as Read
module.exports.markNotificationAsRead = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required"
      });
    }

    const notification = await DeliveryBoyNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    // Check if notification belongs to this delivery boy
    if (notification.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this notification"
      });
    }

    // Mark as read
    notification.isRead = true;
    notification.readAt = Date.now();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: {
        notification: notification
      }
    });

  } catch (error) {
    console.error("Mark notification as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Mark All Notifications as Read
module.exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const result = await DeliveryBoyNotification.updateMany(
      { 
        deliveryBoyId: deliveryBoyId,
        isRead: false
      },
      {
        isRead: true,
        readAt: Date.now()
      }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        updatedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Delete Notification
module.exports.deleteNotification = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required"
      });
    }

    const notification = await DeliveryBoyNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    // Check if notification belongs to this delivery boy
    if (notification.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this notification"
      });
    }

    await DeliveryBoyNotification.findByIdAndDelete(notificationId);

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Unread Count
module.exports.getUnreadCount = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const unreadCount = await DeliveryBoyNotification.countDocuments({
      deliveryBoyId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      message: "Unread count retrieved successfully",
      data: {
        unreadCount: unreadCount
      }
    });

  } catch (error) {
    console.error("Get unread count error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
