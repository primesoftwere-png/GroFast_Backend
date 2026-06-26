// controllers/Shopkeeper/advertisement.controller.js
const ShopAdvertisement = require('../../models/ShopKeeper/ShopAdvertisement');
const Shop = require('../../models/ShopKeeper/Shop');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');

exports.createAd = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming auth middleware sets req.user
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shopkeeper not found' });
    }
    const shopkeeperId = shopkeeper._id;
    const { title, type, targetUrl, status, validFrom, validUntil } = req.body;
    
    // Find shop associated with this shopkeeper
    const shop = await Shop.findOne({ shopkeeperId });
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found for this shopkeeper' });
    }

    let image = '';
    if (req.file) {
      image = req.file.filename;
    } else {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const newAd = new ShopAdvertisement({
      shopkeeperId,
      shopId: shop._id,
      title,
      image,
      type: type || 'banner',
      targetUrl,
      status: status || 'active',
      validFrom,
      validUntil
    });

    await newAd.save();

    res.status(201).json({
      success: true,
      message: 'Advertisement created successfully',
      data: newAd
    });
  } catch (error) {
    console.error('Create Ad error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAds = async (req, res) => {
  try {
    const userId = req.user._id;
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shopkeeper not found' });
    }
    const shopkeeperId = shopkeeper._id;
    const ads = await ShopAdvertisement.find({ shopkeeperId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.error('Get Ads error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAdById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shopkeeper not found' });
    }
    const shopkeeperId = shopkeeper._id;

    const ad = await ShopAdvertisement.findOne({ _id: id, shopkeeperId });

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    res.status(200).json({
      success: true,
      data: ad
    });
  } catch (error) {
    console.error('Get Ad by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shopkeeper not found' });
    }
    const shopkeeperId = shopkeeper._id;
    const { title, type, targetUrl, status, validFrom, validUntil } = req.body;

    let ad = await ShopAdvertisement.findOne({ _id: id, shopkeeperId });

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    ad.title = title || ad.title;
    ad.type = type || ad.type;
    ad.targetUrl = targetUrl || ad.targetUrl;
    ad.status = status || ad.status;
    
    if (validFrom) ad.validFrom = validFrom;
    if (validUntil) ad.validUntil = validUntil;

    if (req.file) {
      ad.image = req.file.filename;
    }

    ad.updatedAt = Date.now();
    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Advertisement updated successfully',
      data: ad
    });
  } catch (error) {
    console.error('Update Ad error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shopkeeper not found' });
    }
    const shopkeeperId = shopkeeper._id;

    const ad = await ShopAdvertisement.findOneAndDelete({ _id: id, shopkeeperId });

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully'
    });
  } catch (error) {
    console.error('Delete Ad error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
