// controllers/Admin/adminExtended.controller.js
const Order = require('../../models/Customer/Order');
const Product = require('../../models/Product.model');
const Category = require('../../models/ProductCategory.model');
const Coupon = require('../../models/Customer/Coupon');
const User = require('../../models/user.model');
const ShopkeeperWallet = require('../../models/ShopKeeper/ShopkeeperWallet');
const AppSettings = require('../../models/Admin/AppSettings');
const SupportTicket = require('../../models/Admin/SupportTicket');

// ==================== ORDERS ====================
module.exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.orderStatus = status.toUpperCase();
    const orders = await Order.find(query)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname roleDetails')
      .populate('deliveryBoyId', 'fullname phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await Order.countDocuments(query);
    res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname roleDetails')
      .populate('deliveryBoyId', 'fullname phone');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.assignDelivery = async (req, res) => {
  try {
    const { deliveryBoyId } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { deliveryBoyId, deliveryBoyAssignedAt: new Date(), orderStatus: 'ASSIGNED' }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Delivery boy assigned', data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: 'CANCELLED', cancellationReason: reason, cancelledAt: new Date() }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== PRODUCTS ====================
module.exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const query = {};
    if (search) query.productName = { $regex: search, $options: 'i' };
    if (category) query.productCategory = category;
    const products = await Product.find(query)
      .populate('productCategory', 'categoryName')
      .populate('createdBy', 'fullname')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await Product.countDocuments(query);
    res.json({ success: true, data: products, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('productCategory', 'categoryName').populate('createdBy', 'fullname');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== CATEGORIES CRUD ====================
module.exports.createCategory = async (req, res) => {
  try {
    const { categoryName, description, parentCategoryId } = req.body;
    if (!categoryName) return res.status(400).json({ success: false, message: 'Category name is required' });
    const category = new Category({ categoryName, description, parentCategoryId: parentCategoryId || null, createdBy: req.user._id });
    await category.save();
    res.status(201).json({ success: true, message: 'Category created', data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updateCategory = async (req, res) => {
  try {
    const { categoryName, description } = req.body;
    const category = await Category.findByIdAndUpdate(req.params.id, { categoryName, description }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category updated', data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== COUPONS ====================
module.exports.getCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status) query.status = status;
    const coupons = await Coupon.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).skip((parseInt(page) - 1) * parseInt(limit)).lean();
    const total = await Coupon.countDocuments(query);
    res.json({ success: true, data: coupons, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.createCoupon = async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.activateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon activated', data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.deactivateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deactivated', data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== PAYMENTS ====================
module.exports.getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, method } = req.query;
    const query = {};
    if (status) query.paymentStatus = status;
    if (method) query.paymentMethod = method;
    const orders = await Order.find(query)
      .populate('customerId', 'fullname email phone')
      .populate('shopId', 'fullname')
      .select('orderNumber paymentMethod paymentStatus totalAmount createdAt customerId shopId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await Order.countDocuments(query);
    const totalRevenue = await Order.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
    res.json({ success: true, data: orders, totalRevenue: totalRevenue[0]?.total || 0, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getPaymentById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('customerId', 'fullname email phone').populate('shopId', 'fullname');
    if (!order) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.refundPayment = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: 'REFUNDED' }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Refund processed', data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const orders = await Order.find({ paymentStatus: { $ne: 'PENDING' } })
      .populate('customerId', 'fullname')
      .select('orderNumber paymentMethod paymentStatus totalAmount createdAt customerId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await Order.countDocuments({ paymentStatus: { $ne: 'PENDING' } });
    res.json({ success: true, data: orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== WALLETS ====================
module.exports.getWallets = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const wallets = await ShopkeeperWallet.find()
      .populate('shopkeeperId', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await ShopkeeperWallet.countDocuments();
    res.json({ success: true, data: wallets, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getWalletById = async (req, res) => {
  try {
    const wallet = await ShopkeeperWallet.findById(req.params.id).populate('shopkeeperId', 'fullname email');
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    res.json({ success: true, data: wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.creditWallet = async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const wallet = await ShopkeeperWallet.findById(req.params.id);
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    wallet.balance += amount;
    wallet.totalEarnings += amount;
    await wallet.save();
    res.json({ success: true, message: 'Wallet credited', data: wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.debitWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const wallet = await ShopkeeperWallet.findById(req.params.id);
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    if (wallet.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });
    wallet.balance -= amount;
    wallet.totalWithdrawn += amount;
    await wallet.save();
    res.json({ success: true, message: 'Wallet debited', data: wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getWalletTransactions = async (req, res) => {
  try {
    const wallet = await ShopkeeperWallet.findById(req.params.id).populate('shopkeeperId', 'fullname email');
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
    res.json({ success: true, data: wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== WITHDRAW REQUESTS ====================
const WithdrawRequest = require('../../models/ShopKeeper/WithdrawRequest');

module.exports.getWithdrawRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = status ? { status } : {};
    const requests = await WithdrawRequest.find(query)
      .populate('shopkeeperId', 'fullname email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await WithdrawRequest.countDocuments(query);
    const totalPending = await WithdrawRequest.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ success: true, data: requests, totalPending: totalPending[0]?.total || 0, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getWithdrawRequestById = async (req, res) => {
  try {
    const request = await WithdrawRequest.findById(req.params.id).populate('shopkeeperId', 'fullname email phone');
    if (!request) return res.status(404).json({ success: false, message: 'Withdraw request not found' });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.approveWithdraw = async (req, res) => {
  try {
    const request = await WithdrawRequest.findByIdAndUpdate(req.params.id, { status: 'approved', processedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Withdraw approved', data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.rejectWithdraw = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await WithdrawRequest.findByIdAndUpdate(req.params.id, { status: 'rejected', rejectionReason: reason, processedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Withdraw rejected', data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== REPORTS ====================
module.exports.getSalesReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = { orderStatus: 'DELIVERED' };
    if (from || to) { match.createdAt = {}; if (from) match.createdAt.$gte = new Date(from); if (to) match.createdAt.$lte = new Date(to); }
    const data = await Order.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }, { $sort: { _id: 1 } }]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getRevenueReport = async (req, res) => {
  try {
    const data = await Order.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getOrdersReport = async (req, res) => {
  try {
    const data = await Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getUsersReport = async (req, res) => {
  try {
    const data = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    const recent = await User.find().sort({ createdAt: -1 }).limit(10).select('fullname email role createdAt').lean();
    res.json({ success: true, data, recentUsers: recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.exportReport = async (req, res) => {
  try {
    const { type = 'orders' } = req.query;
    let data = [];
    if (type === 'orders') data = await Order.find().populate('customerId', 'fullname').select('orderNumber orderStatus totalAmount paymentMethod createdAt').lean();
    if (type === 'users') data = await User.find({ role: 'user' }).select('fullname email phone createdAt').lean();
    res.json({ success: true, data, type });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== SETTINGS ====================
const DEFAULT_SETTINGS = {
  general: { appName: 'GroFast', supportEmail: 'support@grofast.app', supportPhone: '+91 1800-GROFAST', currency: 'INR', timezone: 'Asia/Kolkata' },
  payment: { commissionPercent: 12, deliveryCharge: 35, platformFee: 5, minWithdrawAmount: 500 },
  notification: { newOrderAlert: true, riderOffline: true, withdrawRequests: true, kycSubmissions: true, dailySummaryEmail: true }
};

module.exports.getSettings = async (req, res) => {
  try {
    const docs = await AppSettings.find().lean();
    const settings = { ...DEFAULT_SETTINGS };
    docs.forEach(d => { settings[d.key] = d.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updateSettings = async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await AppSettings.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getGeneralSettings = async (req, res) => {
  try {
    const doc = await AppSettings.findOne({ key: 'general' }).lean();
    res.json({ success: true, data: doc?.value || DEFAULT_SETTINGS.general });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updatePaymentSettings = async (req, res) => {
  try {
    const existing = await AppSettings.findOne({ key: 'payment' }).lean();
    const merged = { ...(existing?.value || DEFAULT_SETTINGS.payment), ...req.body };
    await AppSettings.findOneAndUpdate({ key: 'payment' }, { key: 'payment', value: merged }, { upsert: true });
    res.json({ success: true, message: 'Payment settings updated', data: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.updateNotificationSettings = async (req, res) => {
  try {
    const existing = await AppSettings.findOne({ key: 'notification' }).lean();
    const merged = { ...(existing?.value || DEFAULT_SETTINGS.notification), ...req.body };
    await AppSettings.findOneAndUpdate({ key: 'notification' }, { key: 'notification', value: merged }, { upsert: true });
    res.json({ success: true, message: 'Notification settings updated', data: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== SUPPORT TICKETS ====================
module.exports.createTicket = async (req, res) => {
  try {
    const { userId, userType, subject, description, priority } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });
    const ticket = new SupportTicket({ userId, userType, subject, description, priority });
    await ticket.save();
    res.status(201).json({ success: true, message: 'Ticket created', data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    const tickets = await SupportTicket.find(query)
      .populate('userId', 'fullname email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    const total = await SupportTicket.countDocuments(query);
    res.json({ success: true, data: tickets, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('userId', 'fullname email phone');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.replyToTicket = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $push: { messages: { from: 'admin', message, sentAt: new Date() } }, status: 'in_progress' },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Reply sent', data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.closeTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket closed', data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
