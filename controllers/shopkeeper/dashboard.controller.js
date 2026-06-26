// controllers/shopkeeper/dashboard.controller.js
const Order = require('../../models/Customer/Order');
const Product = require('../../models/Product.model');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');

module.exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get shopkeeper profile
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found'
      });
    }

    const queryShopId = userId; // Fallback logic if needed, but userId is typical for shopId
    const query = {
      $or: [
        { shopId: queryShopId },
        { shopId: shopkeeper._id },
        { shopId: shopkeeper.userId }
      ]
    };

    // 1. Fetch Recent Orders
    const recentOrdersDb = await Order.find(query)
      .populate('customerId', 'fullname')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentOrders = recentOrdersDb.map(order => ({
      id: `#GF${order.orderId || order._id.toString().substring(0, 6).toUpperCase()}`,
      customer: order.customerId ? order.customerId.fullname : 'Guest User',
      items: order.items ? order.items.length : 0,
      total: `₹${order.totalAmount || 0}`,
      status: order.orderStatus || 'Pending'
    }));

    // 2. Fetch Dashboard Stats
    const totalOrdersCount = await Order.countDocuments(query);
    
    // Low stock alerts
    const lowStockAlerts = await Product.countDocuments({ 
      createdBy: userId, 
      productQuantity: { $gt: 0, $lte: 10 } 
    });

    // Today's & Monthly Income
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get all delivered orders to calculate income
    const deliveredOrders = await Order.find({
      ...query,
      orderStatus: 'DELIVERED'
    });

    let todaysIncome = 0;
    let monthlyIncome = 0;

    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt); // Or deliveredAt if it exists
      if (orderDate >= startOfToday) {
        todaysIncome += order.totalAmount || 0;
      }
      if (orderDate >= startOfMonth) {
        monthlyIncome += order.totalAmount || 0;
      }
    });

    // 3. Weekly Income Data for Chart
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const incomeData = days.map(day => ({ day, income: 0 }));

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0,0,0,0);

    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= startOfWeek) {
        const dayName = days[orderDate.getDay()];
        const dayIndex = incomeData.findIndex(d => d.day === dayName);
        if (dayIndex !== -1) {
          incomeData[dayIndex].income += order.totalAmount || 0;
        }
      }
    });

    // Send response
    res.status(200).json({
      success: true,
      message: 'Dashboard data fetched successfully',
      data: {
        stats: {
          todaysIncome: `₹${todaysIncome.toLocaleString('en-IN')}`,
          monthlyIncome: `₹${monthlyIncome.toLocaleString('en-IN')}`,
          totalOrders: totalOrdersCount,
          lowStockAlerts
        },
        recentOrders,
        incomeData
      }
    });

  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
