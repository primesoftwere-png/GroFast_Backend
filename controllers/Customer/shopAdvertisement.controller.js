// controllers/Customer/shopAdvertisement.controller.js
const ShopAdvertisement = require('../../models/Shopkeeper/ShopAdvertisement');

exports.getActiveAds = async (req, res) => {
  try {
    const { shopId, type } = req.query;
    
    let query = { status: 'active' };
    
    // Optionally filter by specific shop
    if (shopId) {
      query.shopId = shopId;
    }
    
    // Optionally filter by type ('banner' or 'ad')
    if (type) {
      query.type = type;
    }
    
    // Check validity dates
    const currentDate = new Date();
    query.$or = [
      { validUntil: { $exists: false } },
      { validUntil: null },
      { validUntil: { $gte: currentDate } }
    ];

    const ads = await ShopAdvertisement.find(query)
      .populate('shopId', 'shopName shopImage city pincode isVerified')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.error('Get Active Ads error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
