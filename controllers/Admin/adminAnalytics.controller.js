// controllers/Admin/adminAnalytics.controller.js
// 📈 ADMIN ANALYTICS APIs

const Order = require('../../models/Customer/Order');
const User = require('../../models/user.model');
const Transaction = require('../../models/SuperAdmin/Transaction');

/**
 * GET /api/admin/analytics/revenue
 * Revenue analytics with time-based breakdown
 */
module.exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query; // day, week, month, year

    let groupBy;
    let dateRange = new Date();

    switch (period) {
      case 'day':
        groupBy = { $hour: '$deliveredAt' };
        dateRange.setHours(0, 0, 0, 0);
        break;
      case 'week':
        groupBy = { $dayOfWeek: '$deliveredAt' };
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case 'month':
        groupBy = { $dayOfMonth: '$deliveredAt' };
        dateRange.setMonth(dateRange.getMonth() - 1);
        break;
      case 'year':
        groupBy = { $month: '$deliveredAt' };
        dateRange.setFullYear(dateRange.getFullYear() - 1);
        break;
      default:
        groupBy = { $dayOfWeek: '$deliveredAt' };
        dateRange.setDate(dateRange.getDate() - 7);
    }

    const revenueData = await Order.aggregate([
      {
        $match: {
          orderStatus: 'DELIVERED',
          paymentStatus: 'PAID',
          deliveredAt: { $gte: dateRange }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period: period,
      data: revenueData
    });

  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/orders
 * Order analytics with status breakdown
 */
module.exports.getOrderAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateRange = new Date();
    switch (period) {
      case 'day':
        dateRange.setHours(0, 0, 0, 0);
        break;
      case 'week':
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case 'month':
        dateRange.setMonth(dateRange.getMonth() - 1);
        break;
      case 'year':
        dateRange.setFullYear(dateRange.getFullYear() - 1);
        break;
    }

    const orderStats = await Order.aggregate([
      { $match: { createdAt: { $gte: dateRange } } },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const orderTrend = await Order.aggregate([
      { $match: { createdAt: { $gte: dateRange } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period: period,
      data: {
        statusBreakdown: orderStats,
        trend: orderTrend
      }
    });

  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order analytics',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/users
 * User growth analytics
 */
module.exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateRange = new Date();
    switch (period) {
      case 'week':
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case 'month':
        dateRange.setMonth(dateRange.getMonth() - 1);
        break;
      case 'year':
        dateRange.setFullYear(dateRange.getFullYear() - 1);
        break;
    }

    const userGrowth = await User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: dateRange } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const userStats = {
      total: await User.countDocuments({ role: 'user' }),
      active: await User.countDocuments({ role: 'user', accountStatus: 'active' }),
      blocked: await User.countDocuments({ role: 'user', accountStatus: 'blocked' }),
      newInPeriod: userGrowth.reduce((sum, day) => sum + day.newUsers, 0)
    };

    res.json({
      success: true,
      period: period,
      data: {
        stats: userStats,
        growth: userGrowth
      }
    });

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/heatmap
 * Order heatmap by area/time
 */
module.exports.getOrderHeatmap = async (req, res) => {
  try {
    const heatmapData = await Order.aggregate([
      { $match: { orderStatus: 'DELIVERED' } },
      {
        $lookup: {
          from: 'customeraddresses',
          localField: 'deliveryAddressId',
          foreignField: '_id',
          as: 'address'
        }
      },
      { $unwind: '$address' },
      {
        $group: {
          _id: {
            city: '$address.city',
            pincode: '$address.pincode'
          },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 50 }
    ]);

    res.json({
      success: true,
      data: heatmapData
    });

  } catch (error) {
    console.error('Error fetching heatmap:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heatmap data',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/analytics/peak-hours
 * Peak order timing analytics
 */
module.exports.getPeakHours = async (req, res) => {
  try {
    const peakHours = await Order.aggregate([
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const peakDays = await Order.aggregate([
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        hourly: peakHours,
        daily: peakDays
      }
    });

  } catch (error) {
    console.error('Error fetching peak hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch peak hours data',
      error: error.message
    });
  }
};
