const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const User = require('../../models/user.model');
const Shop = require('../../models/ShopKeeper/Shop');

// CLEAN REGISTRATION - NO VALIDATION MIDDLEWARE
const registerShopClean = async (req, res) => {
  try {
    console.log('=== CLEAN REGISTRATION START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      shopName,
      ownerName,
      email,
      phone,
      password,
      shopCategory,
      shopGST = '',
      shopLicenseNo = '',
      shopImage = '',
      address,
      city,
      pincode,
      location,
      openingTime = '09:00',
      closingTime = '21:00',
    } = req.body;

    // Basic validation
    if (!shopName || !ownerName || !email || !phone || !password || !address || !city || !pincode || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['shopName', 'ownerName', 'email', 'phone', 'password', 'address', 'city', 'pincode', 'location']
      });
    }

    // Normalize email and phone
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    console.log('Checking email:', trimmedEmail);
    console.log('Checking phone:', trimmedPhone);

    // Check existing email
    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      console.log('Email already exists:', existingEmail._id);
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        existingUserId: existingEmail._id.toString()
      });
    }

    // Check existing phone
    const existingPhone = await User.findOne({ phone: trimmedPhone });
    if (existingPhone) {
      console.log('Phone already exists:', existingPhone._id);
      return res.status(400).json({
        success: false,
        message: 'Phone already registered',
        existingUserId: existingPhone._id.toString()
      });
    }

    console.log('No existing user found. Creating new user...');

    // Extract coordinates
    const coordinates = location.coordinates || [];
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates format. Expected: [longitude, latitude]'
      });
    }

    const [longitude, latitude] = coordinates;

    // Hash password
    const hashedPassword = await User.hashPassword(password);

    // Create user
    const newUser = await User.create({
      fullname: ownerName.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'pending',
      roleDetails: {
        shopkeeper: {
          status: 'pending'
        }
      }
    });

    console.log('User created:', newUser._id);

    // Create shopkeeper
    const newShopkeeper = await Shopkeeper.create({
      userId: newUser._id,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      shopImage: shopImage || '',
      licenseNumber: shopLicenseNo || '',
      gstNumber: shopGST || ''
    });

    console.log('Shopkeeper created:', newShopkeeper._id);

    // Create shop
    const newShop = await Shop.create({
      shopkeeperId: newShopkeeper._id,
      shopName: shopName.trim(),
      shopAddress: address.trim(),
      city: city.trim(),
      state: 'Unknown',
      pincode: pincode.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      openingTime: openingTime,
      closingTime: closingTime,
      isOpen: false,
      status: 'inactive'
    });

    console.log('Shop created:', newShop._id);
    console.log('=== CLEAN REGISTRATION SUCCESS ===');

    // Return success
    return res.status(201).json({
      success: true,
      message: 'Shop registration submitted successfully. Awaiting admin approval.',
      data: {
        user: {
          _id: newUser._id,
          fullname: newUser.fullname,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          accountStatus: newUser.accountStatus
        },
        shopkeeper: {
          _id: newShopkeeper._id,
          shopName: newShopkeeper.shopName,
          ownerName: newShopkeeper.ownerName
        },
        shop: {
          _id: newShop._id,
          shopName: newShop.shopName,
          city: newShop.city,
          status: newShop.status
        },
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('=== CLEAN REGISTRATION ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate ${field}. This ${field} is already registered.`,
        field: field
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

module.exports = {
  registerShopClean
};
