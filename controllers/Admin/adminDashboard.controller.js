// controllers/Admin/adminDashboard.controller.js
// 📊 ADMIN DASHBOARD APIs

const Order = require('../../models/Customer/Order');
const User = require('../../models/user.model');
const DeliveryBoy = require('../../models/DeliveryBoy/DeliveryBoy');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Product = require('../../models/Product.model');
const Transaction = require('../../models/SuperAdmin/Transaction');

/**
 * GET /api/admin/dashboard
 * Main dashboard statistics
 */
module.exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Order Statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'PENDING' });
    const confirmedOrders = await Order.countDocuments({ orderStatus: 'CONFIRMED' });
    const assignedOrders = await Order.countDocuments({ orderStatus: 'ASSIGNED' });
    const inTransitOrders = await Order.countDocuments({ orderStatus: 'IN_TRANSIT' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'DELIVERED' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'CANCELLED' });
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });

    // Revenue Statistics
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: 'DELIVERED', paymentStatus: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const todayRevenue = await Order.aggregate([
      { 
        $match: { 
          orderStatus: 'DELIVERED', 
          paymentStatus: 'PAID',
          deliveredAt: { $gte: today }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // User Statistics
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activeUsers = await User.countDocuments({ role: 'user', accountStatus: 'active' });
    const todayUsers = await User.countDocuments({ role: 'user', createdAt: { $gte: today } });

    // Shopkeeper Statistics
    const totalShopkeepers = await User.countDocuments({ role: 'admin' });
    const activeShopkeepers = await User.countDocuments({ 
      role: 'admin', 
      'roleDetails.shopkeeper.status': 'active' 
    });
    const pendingShopkeepers = await User.countDocuments({ 
      role: 'admin', 
      'roleDetails.shopkeeper.status': 'pending' 
    });

    // Delivery Boy Statistics
    const totalDeliveryBoys = await User.countDocuments({ role: 'deliveryBoy' });
    const onlineDeliveryBoys = await DeliveryBoy.countDocuments({ isOnline: true });
    const availableDeliveryBoys = await DeliveryBoy.countDocuments({ 
      isOnline: true, 
      isAvailable: true 
    });
    const busyDeliveryBoys = await DeliveryBoy.countDocuments({ 
      isOnline: true, 
      isAvailable: false 
    });

    // Product Statistics
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ productQuantity: { $lt: 10 } });

    res.json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          confirmed: confirmedOrders,
          assigned: assignedOrders,
          inTransit: inTransitOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
          today: todayOrders
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          today: todayRevenue[0]?.total || 0
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          today: todayUsers
        },
        shopkeepers: {
          total: totalShopkeepers,
          active: activeShopkeepers,
          pending: pendingShopkeepers
        },
        deliveryBoys: {
          total: totalDeliveryBoys,
          online: onlineDeliveryBoys,
          available: availableDeliveryBoys,
          busy: busyDeliveryBoys
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/live-orders
 * Get all live orders (not delivered/cancelled)
 */
module.exports.getLiveOrders = async (req, res) => {
  try {
    const liveOrders = await Order.find({
      orderStatus: { $in: ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
    })
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname phone roleDetails.admin.shopName address')
      .populate('deliveryBoyId', 'fullname phone')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: liveOrders.length,
      data: liveOrders
    });

  } catch (error) {
    console.error('Error fetching live orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live orders',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/recent-transactions
 * Get recent transactions
 */
module.exports.getRecentTransactions = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'fullname email phone')
      .populate('orderId', 'orderNumber totalAmount');

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/live-activities
 * Get real-time activity feed
 */
module.exports.getLiveActivities = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Get recent orders with activity
    const recentOrders = await Order.find()
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .populate('customerId', 'fullname')
      .populate('shopId', 'fullname roleDetails.admin.shopName')
      .populate('deliveryBoyId', 'fullname')
      .select('orderNumber orderStatus updatedAt totalAmount');

    const activities = recentOrders.map(order => ({
      type: 'order',
      status: order.orderStatus,
      orderNumber: order.orderNumber,
      customer: order.customerId?.fullname,
      shop: order.shopId?.roleDetails?.admin?.shopName || order.shopId?.fullname,
      deliveryBoy: order.deliveryBoyId?.fullname,
      amount: order.totalAmount,
      timestamp: order.updatedAt
    }));

    res.json({
      success: true,
      count: activities.length,
      data: activities
    });

  } catch (error) {
    console.error('Error fetching live activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live activities',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/top-products
 * Get top selling products
 */
module.exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topProducts = await Order.aggregate([
      { $match: { orderStatus: 'DELIVERED' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);

    res.json({
      success: true,
      count: topProducts.length,
      data: topProducts
    });

  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/top-shopkeepers
 * Get top performing shopkeepers
 */
module.exports.getTopShopkeepers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topShopkeepers = await Order.aggregate([
      { $match: { orderStatus: 'DELIVERED' } },
      {
        $group: {
          _id: '$shopId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'shopkeeper'
        }
      },
      { $unwind: '$shopkeeper' }
    ]);

    res.json({
      success: true,
      count: topShopkeepers.length,
      data: topShopkeepers
    });

  } catch (error) {
    console.error('Error fetching top shopkeepers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top shopkeepers',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/active-delivery-boys
 * Get currently active delivery boys with location
 */
module.exports.getActiveDeliveryBoys = async (req, res) => {
  try {
    const activeDeliveryBoys = await DeliveryBoy.find({ isOnline: true })
      .populate('userId', 'fullname phone email')
      .populate('activeOrderId', 'orderNumber orderStatus');

    res.json({
      success: true,
      count: activeDeliveryBoys.length,
      data: activeDeliveryBoys
    });

  } catch (error) {
    console.error('Error fetching active delivery boys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active delivery boys',
      error: error.message
    });
  }
};
