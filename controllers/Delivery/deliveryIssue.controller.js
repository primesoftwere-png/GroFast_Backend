// controllers/Delivery/deliveryIssue.controller.js
const DeliveryBoyIssue = require("../../models/DeliveryBoy/DeliveryBoyIssue");
const DeliveryBoy = require("../../models/DeliveryBoy/DeliveryBoy");

// ✅ Report Issue
module.exports.reportIssue = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { orderId, issueType, title, description, priority, attachments } = req.body;

    // Validation
    if (!issueType) {
      return res.status(400).json({
        success: false,
        message: "Issue type is required"
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Issue title is required"
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Issue description is required"
      });
    }

    const validIssueTypes = [
      'order_issue', 'payment_issue', 'customer_issue', 
      'vehicle_breakdown', 'accident', 'app_issue', 'other'
    ];

    if (!validIssueTypes.includes(issueType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid issue type. Allowed: ${validIssueTypes.join(', ')}`
      });
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
        });
      }
    }

    // Create issue
    const issue = await DeliveryBoyIssue.create({
      deliveryBoyId: deliveryBoyId,
      orderId: orderId || null,
      issueType: issueType,
      title: title.trim(),
      description: description.trim(),
      priority: priority || 'normal',
      attachments: attachments || [],
      status: 'open'
    });

    return res.status(201).json({
      success: true,
      message: "Issue reported successfully. Our team will review it shortly.",
      data: {
        issue: issue
      }
    });

  } catch (error) {
    console.error("Report issue error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Issues
module.exports.getIssues = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { page = 1, limit = 20, status, issueType, priority } = req.query;

    // Build query
    const query = { deliveryBoyId };

    if (status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
        });
      }
      query.status = status;
    }

    if (issueType) {
      const validIssueTypes = [
        'order_issue', 'payment_issue', 'customer_issue', 
        'vehicle_breakdown', 'accident', 'app_issue', 'other'
      ];
      if (!validIssueTypes.includes(issueType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid issue type. Allowed: ${validIssueTypes.join(', ')}`
        });
      }
      query.issueType = issueType;
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

    const issues = await DeliveryBoyIssue.find(query)
      .populate('orderId', 'orderNumber totalAmount orderStatus')
      .populate('resolvedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalIssues = await DeliveryBoyIssue.countDocuments(query);
    const totalPages = Math.ceil(totalIssues / parseInt(limit));

    // Get open issues count
    const openIssuesCount = await DeliveryBoyIssue.countDocuments({
      deliveryBoyId,
      status: { $in: ['open', 'in_progress'] }
    });

    return res.status(200).json({
      success: true,
      message: "Issues retrieved successfully",
      data: {
        issues: issues,
        openIssuesCount: openIssuesCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalIssues: totalIssues,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error("Get issues error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Issue Details
module.exports.getIssueDetails = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;
    const { issueId } = req.params;

    if (!issueId) {
      return res.status(400).json({
        success: false,
        message: "Issue ID is required"
      });
    }

    const issue = await DeliveryBoyIssue.findById(issueId)
      .populate('orderId', 'orderNumber totalAmount orderStatus')
      .populate('resolvedBy', 'fullname email');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check if issue belongs to this delivery boy
    if (issue.deliveryBoyId.toString() !== deliveryBoyId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this issue"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Issue details retrieved successfully",
      data: {
        issue: issue
      }
    });

  } catch (error) {
    console.error("Get issue details error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get Block Status
module.exports.getBlockStatus = async (req, res) => {
  try {
    const deliveryBoyId = req.user._id;

    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy profile not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Block status retrieved successfully",
      data: {
        isBlocked: deliveryBoy.isBlocked,
        blockReason: deliveryBoy.blockReason,
        canGoOnline: !deliveryBoy.isBlocked
      }
    });

  } catch (error) {
    console.error("Get block status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
