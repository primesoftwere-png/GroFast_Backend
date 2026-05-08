const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const User = require('../../models/user.model');
const Shop = require('../../models/ShopKeeper/Shop');
const { body, validationResult } = require('express-validator');

// Validation rules aligned with expected fields (unchanged, as they match service expectations)
const validateRegister = [
  body('shopName')
    .exists().withMessage('Shop name is required')
    .bail()
    .trim()
    .isLength({ min: 1 }).withMessage('Shop name is required'),
  
  body('ownerName')
    .exists().withMessage('Owner name is required')
    .bail()
    .trim()
    .isLength({ min: 1 }).withMessage('Owner name is required'),
  
  body('email')
    .exists().withMessage('Email is required')
    .bail()
    .normalizeEmail()
    .isEmail().withMessage('Valid email is required'),
  
  body('phone')
    .exists().withMessage('Phone number is required')
    .bail()
    .isMobilePhone('en-IN').withMessage('Valid phone number is required'),
  
  body('password')
    .exists().withMessage('Password is required')
    .bail()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  
  body('shopCategory')
    .exists().withMessage('Shop category is required')
    .bail()
    .isIn(['Grocery', 'Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Other']).withMessage('Invalid shop category'),
  
  body('shopGST').optional({ checkFalsy: true }).trim(),
  body('shopLicenseNo').optional({ checkFalsy: true }).trim(),
  body('shopImage').optional({ checkFalsy: true }).isURL().withMessage('Shop image must be a valid URL'),
  
  body('address')
    .exists().withMessage('Address is required')
    .bail()
    .trim()
    .isLength({ min: 1 }).withMessage('Address is required'),
  
  body('city')
    .exists().withMessage('City is required')
    .bail()
    .trim()
    .isLength({ min: 1 }).withMessage('City is required'),
  
  body('pincode')
    .exists().withMessage('Pincode is required')
    .bail()
    .isPostalCode('IN').withMessage('Valid pincode is required'),
  
  body('location.coordinates')
    .exists().withMessage('Location coordinates are required')
    .bail()
    .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of [longitude, latitude]'),
  
  body('location.coordinates.0')
    .exists().withMessage('Longitude is required')
    .bail()
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  
  body('location.coordinates.1')
    .exists().withMessage('Latitude is required')
    .bail()
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  
  body('openingTime')
    .exists().withMessage('Opening time is required')
    .bail()
    .isString().withMessage('Opening time must be a string')
    .bail()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid opening time (HH:MM) is required'),
  
  body('closingTime')
    .exists().withMessage('Closing time is required')
    .bail()
    .isString().withMessage('Closing time must be a string')
    .bail()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid closing time (HH:MM) is required'),
];

const registerShop = async (req, res) => {
  try {
    // Enhanced debug logs for better troubleshooting
    console.log('=== REQUEST DEBUG START ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Content-Type Header:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('Raw req.body:', JSON.stringify(req.body, null, 2));
    console.log('Body Keys:', Object.keys(req.body || {}));
    console.log('=== REQUEST DEBUG END ===');

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Ensure Content-Type: application/json and valid JSON payload.',
        debug: {
          contentType: req.headers['content-type'],
          bodyKeys: Object.keys(req.body || {}),
        },
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array().map(e => ({ path: e.path, msg: e.msg, value: e.value })));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          type: 'field',
          msg: err.msg,
          path: err.path,
          location: err.location,
        })),
      });
    }

    // Prepare data for service (location handling unchanged)
    const { location, ...rest } = req.body;
    const shopData = {
      ...rest,
      location: {
        type: 'Point',
        coordinates: Array.isArray(location?.coordinates) ? location.coordinates : [],
      },
    };

    console.log('Final shopData to service:', JSON.stringify(shopData, null, 2));

    // Register shopkeeper directly
    try {
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
        pincode = '000000',
        location: { coordinates } = { coordinates: [] },
        openingTime = '09:00',
        closingTime = '21:00',
      } = shopData;

      // Validate owner name
      if (!ownerName || ownerName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Owner name is required'
        });
      }

      // Validate and normalize email
      if (!email || email.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Valid email format is required (e.g., user@example.com)'
        });
      }

      // Validate phone
      if (!phone || phone.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }
      const trimmedPhone = phone.trim();

      // Validate password
      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password is required and must be at least 6 characters'
        });
      }

      // Validate coordinates
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location coordinates: must be [longitude, latitude]'
        });
      }
      const [longitude, latitude] = coordinates;
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinate ranges'
        });
      }

      // Check for existing email with detailed logging
      console.log('=== EMAIL CHECK START ===');
      console.log('Original email from request:', email);
      console.log('Trimmed and lowercased email:', trimmedEmail);
      
      const existingEmail = await User.findOne({ email: trimmedEmail });
      
      console.log('Database query result:', existingEmail);
      console.log('Existing email found:', existingEmail ? 'YES' : 'NO');
      
      if (existingEmail) {
        console.log('Found user with email:', {
          id: existingEmail._id,
          email: existingEmail.email,
          phone: existingEmail.phone,
          role: existingEmail.role,
          accountStatus: existingEmail.accountStatus
        });
        console.log('=== EMAIL CHECK END ===');
        return res.status(400).json({
          success: false,
          message: 'Email already registered or pending approval',
          debug: {
            requestedEmail: trimmedEmail,
            existingEmail: existingEmail.email,
            userId: existingEmail._id
          }
        });
      }
      console.log('=== EMAIL CHECK END - No existing email found ===');

      // Check for existing phone with detailed logging
      console.log('=== PHONE CHECK START ===');
      console.log('Original phone from request:', phone);
      console.log('Trimmed phone:', trimmedPhone);
      
      const existingPhone = await User.findOne({ phone: trimmedPhone });
      
      console.log('Database query result:', existingPhone);
      console.log('Existing phone found:', existingPhone ? 'YES' : 'NO');
      
      if (existingPhone) {
        console.log('Found user with phone:', {
          id: existingPhone._id,
          email: existingPhone.email,
          phone: existingPhone.phone,
          role: existingPhone.role,
          accountStatus: existingPhone.accountStatus
        });
        console.log('=== PHONE CHECK END ===');
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered or pending approval',
          debug: {
            requestedPhone: trimmedPhone,
            existingPhone: existingPhone.phone,
            userId: existingPhone._id
          }
        });
      }
      console.log('=== PHONE CHECK END - No existing phone found ===');

      console.log('=== CREATING USER START ===');
      const hashedPassword = await User.hashPassword(password);

      const newUser = new User({
        fullname: ownerName.trim(),
        email: trimmedEmail,
        phone: trimmedPhone,
        password: hashedPassword,
        role: 'admin',
        accountStatus: 'pending',
        roleDetails: {
          shopkeeper: {
            status: 'pending'
          },
          deliveryBoy: {
            deliveryBoyStatus: 'inactive'
          }
        },
      });

      console.log('Attempting to save user...');
      const savedUser = await newUser.save();
      console.log('User saved successfully:', savedUser._id);
      console.log('=== CREATING USER END ===');

      console.log('=== CREATING SHOPKEEPER START ===');
      const newShopkeeper = new Shopkeeper({
        userId: savedUser._id,
        shopName,
        ownerName: ownerName.trim(),
        fullname: ownerName.trim(),
        shopImage,
        licenseNumber: shopLicenseNo,
        gstNumber: shopGST,
      });

      const savedShopkeeper = await newShopkeeper.save();
      console.log('Shopkeeper saved successfully:', savedShopkeeper._id);
      console.log('=== CREATING SHOPKEEPER END ===');

      console.log('=== CREATING SHOP START ===');
      const newShop = new Shop({
        shopkeeperId: savedShopkeeper._id,
        shopName,
        shopAddress: address,
        city,
        state: 'Unknown',
        pincode,
        latitude,
        longitude,
        openingTime,
        closingTime,
        isOpen: false,
        status: 'inactive',
      });

      const savedShop = await newShop.save();
      console.log('Shop saved successfully:', savedShop._id);
      console.log('=== CREATING SHOP END ===');

      console.log(`Notification to Superadmin: New shopkeeper registration pending approval - User ID: ${savedUser._id}, Shop: ${shopName}`);

      const safeUser = savedUser.toObject();
      delete safeUser.password;
      if (safeUser.passwordHash) delete safeUser.passwordHash;
      const safeShopkeeper = savedShopkeeper.toObject();
      const safeShop = savedShop.toObject();

      const result = {
        success: true,
        message: 'Shop registration submitted successfully. Awaiting superadmin approval. You will be notified once verified. Login will be available after approval.',
        data: {
          user: safeUser,
          shopkeeper: safeShopkeeper,
          shop: safeShop,
          status: 'pending',
        },
      };
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Service registration error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        errors: error.errors ? Object.keys(error.errors) : 'No errors object',
        code: error.code,
      });

      // Handle MongoDB duplicate key error
      if (error.name === 'MongoServerError' && error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || 'unknown';        
        if (field === 'email') {
          return res.status(400).json({
            success: false,
            message: 'Email already exists. Please use a different email address.'
          });
        } else if (field === 'phone') {
          return res.status(400).json({
            success: false,
            message: 'Phone number already exists. Please use a different phone number.'
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'A duplicate value was found. Please check your input.'
          });
        }
      }

      // Handle Mongoose validation error
      if (error.name === 'ValidationError') {
        const modelName = error.model?.modelName || 'Unknown Model';
        const field = Object.keys(error.errors || {})[0] || 'unknown';
        const errMsg = error.errors[field]?.message || `Path \`${field}\` is required.`;
        return res.status(400).json({
          success: false,
          message: `${modelName} validation failed: ${field}: ${errMsg}`
        });
      }

      // Return the error message
      return res.status(400).json({
        success: false,
        message: error.message || 'Registration submission failed'
      });
    }
  } catch (error) {
    console.error('=== OUTER CATCH BLOCK ===');
    console.error('Registration error:', error);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // This should NOT return "Email already exists" if we already checked above
    // This means the error is coming from somewhere else
    
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during registration',
      errorDetails: {
        name: error.name,
        code: error.code
      }
    });
  }
};

// Test endpoint for body parsing (unchanged)
const testBody = (req, res) => {
  res.json({
    success: true,
    message: 'Body parsing works!',
    receivedBody: req.body,
    keys: Object.keys(req.body || {}),
  });
};

// Test endpoint to check database
const testDatabase = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.json({
        success: true,
        message: 'Provide ?email=test@example.com to check if email exists',
        totalUsers: await User.countDocuments(),
        totalShopkeepers: await Shopkeeper.countDocuments()
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    res.json({
      success: true,
      message: 'Database check complete',
      searchedEmail: trimmedEmail,
      found: !!user,
      user: user ? {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.message
    });
  }
};

// New: Controller methods for approval and listing (to support full flow)
const approveShopkeeper = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    // Approve shopkeeper directly
    const shopkeeper = await Shopkeeper.findById(id).populate('userId');
    if (!shopkeeper) {
      throw new Error('Shopkeeper not found');
    }
    const currentStatus = shopkeeper.userId.roleDetails?.shopkeeper?.status;
    if (currentStatus === 'active') {
      throw new Error('Shopkeeper already verified');
    }
    if (currentStatus === 'blocked') {
      throw new Error('Shopkeeper already rejected');
    }
    const newStatus = approved ? 'active' : 'blocked';
    const rejectReason = req.body.rejectReason || '';
    
    shopkeeper.userId.roleDetails.shopkeeper = shopkeeper.userId.roleDetails.shopkeeper || {};
    shopkeeper.userId.roleDetails.shopkeeper.status = newStatus;
    if (!approved && rejectReason) {
      shopkeeper.userId.roleDetails.shopkeeper.rejectReason = rejectReason;
    }
    shopkeeper.userId.accountStatus = newStatus;
    await shopkeeper.userId.save();
    
    if (approved) {
      await Shop.findOneAndUpdate(
        { shopkeeperId: shopkeeper._id },
        { status: 'active', isOpen: true }
      );
      console.log(`Notification to Shopkeeper: Your shop "${shopkeeper.shopName}" has been approved (unblocked). You can now login.`);
    } else {
      console.log(`Notification to Shopkeeper: Your shop "${shopkeeper.shopName}" has been rejected (blocked). Reason: ${rejectReason || 'Not specified'}.`);
    }
    
    const updatedShopkeeper = await shopkeeper.save();
    const safeUser = shopkeeper.userId.toObject();
    delete safeUser.password;
    if (safeUser.passwordHash) delete safeUser.passwordHash;
    const safeShopkeeper = updatedShopkeeper.toObject();
    
    const result = {
      success: true,
      message: approved ? 'Shopkeeper approved (unblocked) successfully' : `Shopkeeper rejected (blocked): ${rejectReason || ''}`,
      data: {
        user: safeUser,
        shopkeeper: safeShopkeeper,
        status: newStatus,
      },
    };
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Approval failed',
    });
  }
};

const getPendingShopkeepers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Get pending shopkeepers directly
    const skip = (pageNum - 1) * limitNum;
    const countPipeline = [
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userData' } },
      { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
      { $match: { 'userData.roleDetails.shopkeeper.status': 'pending' } },
      { $count: 'total' }
    ];
    const countResult = await Shopkeeper.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    
    const dataPipeline = [
      { $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            { $project: { password: 0, passwordHash: 0 } }
          ]
        }
      },
      { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
      { $match: { 'userData.roleDetails.shopkeeper.status': 'pending' } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      { $project: {
          userData: 1,
          shopName: 1,
          ownerName: 1,
          fullname: 1,
          shopImage: 1,
          licenseNumber: 1,
          gstNumber: 1,
          createdAt: 1,
          updatedAt: 1
        } }
    ];
    const pendingShopkeepers = await Shopkeeper.aggregate(dataPipeline);
    
    const result = {
      success: true,
      data: {
        shopkeepers: pendingShopkeepers,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    };
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Fetch pending error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch pending shopkeepers',
    });
  }
};

module.exports = {
  validateRegister,
  registerShop,
  testBody,
  testDatabase,
  approveShopkeeper,
  getPendingShopkeepers,
};