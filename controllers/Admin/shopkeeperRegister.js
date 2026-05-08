// controllers/Admin/shopkeeperRegister.js
// SIMPLE SHOPKEEPER REGISTRATION - NO ISSUES

const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Shopkeeper = require('../../models/ShopKeeper/Shopkeeper');
const Shop = require('../../models/ShopKeeper/Shop');

const registerShopkeeper = async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('SHOPKEEPER REGISTRATION STARTED');
    console.log('========================================');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    // Extract data
    const {
      shopName,
      ownerName,
      email,
      phone,
      password,
      shopCategory,
      shopGST,
      shopLicenseNo,
      shopImage,
      address,
      city,
      pincode,
      location,
      openingTime,
      closingTime
    } = req.body;

    // Validate required fields
    if (!shopName || !ownerName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: shopName, ownerName, email, phone, password'
      });
    }

    if (!address || !city || !pincode || !location) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: address, city, pincode, location'
      });
    }

    // Normalize data
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    console.log('\n--- Checking for existing users ---');
    console.log('Email to check:', normalizedEmail);
    console.log('Phone to check:', normalizedPhone);

    // Check if email already exists
    const existingUserByEmail = await User.findOne({ email: normalizedEmail });
    if (existingUserByEmail) {
      console.log('❌ Email already exists:', existingUserByEmail._id);
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Please use a different email or login.',
        existingUser: {
          email: existingUserByEmail.email,
          registeredAt: existingUserByEmail.createdAt
        }
      });
    }
    console.log('✓ Email is available');

    // Check if phone already exists
    const existingUserByPhone = await User.findOne({ phone: normalizedPhone });
    if (existingUserByPhone) {
      console.log('❌ Phone already exists:', existingUserByPhone._id);
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered. Please use a different phone number or login.',
        existingUser: {
          phone: existingUserByPhone.phone,
          registeredAt: existingUserByPhone.createdAt
        }
      });
    }
    console.log('✓ Phone is available');

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Extract coordinates
    const coordinates = location?.coordinates || [];
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location format. Expected: { coordinates: [longitude, latitude] }'
      });
    }

    const [longitude, latitude] = coordinates;

    console.log('\n--- Creating new user ---');
    
    // Hash password
    const hashedPassword = await User.hashPassword(password);

    // Create user
    const newUser = new User({
      fullname: ownerName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'pending',
      roleDetails: {
        shopkeeper: {
          status: 'pending'
        }
      }
    });

    await newUser.save();
    console.log('✓ User created:', newUser._id);

    console.log('\n--- Creating shopkeeper profile ---');
    
    // Create shopkeeper (without email field since model doesn't have it)
    const newShopkeeper = new Shopkeeper({
      userId: newUser._id,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      shopImage: shopImage || '',
      licenseNumber: shopLicenseNo || '',
      gstNumber: shopGST || ''
    });

    try {
      await newShopkeeper.save();
      console.log('✓ Shopkeeper created:', newShopkeeper._id);
    } catch (shopkeeperError) {
      // If error is due to email or phone index, try to handle it
      if (shopkeeperError.code === 11000) {
        const problematicField = shopkeeperError.keyPattern ? Object.keys(shopkeeperError.keyPattern)[0] : null;
        console.log('⚠️ Detected duplicate key issue on shopkeepers collection');
        console.log('⚠️ Problematic field:', problematicField);
        console.log('⚠️ Attempting to drop the problematic index...');
        
        try {
          // Try to drop the problematic index
          const db = mongoose.connection.db;
          const collection = db.collection('shopkeepers');
          
          // Drop both email and phone indexes if they exist
          const indexesToDrop = ['email_1', 'phone_1'];
          for (const indexName of indexesToDrop) {
            try {
              await collection.dropIndex(indexName);
              console.log(`✓ Dropped ${indexName} index`);
            } catch (dropError) {
              console.log(`⚠️ ${indexName} index does not exist or already dropped`);
            }
          }
          
          // Retry saving shopkeeper
          await newShopkeeper.save();
          console.log('✓ Shopkeeper created after fixing indexes:', newShopkeeper._id);
        } catch (retryError) {
          console.error('❌ Failed to fix and retry:', retryError.message);
          // Rollback: delete the user we created
          await User.deleteOne({ _id: newUser._id });
          console.log('⚠️ Rolled back user creation');
          throw shopkeeperError; // Throw original error
        }
      } else {
        // Rollback: delete the user we created
        await User.deleteOne({ _id: newUser._id });
        console.log('⚠️ Rolled back user creation');
        throw shopkeeperError;
      }
    }

    console.log('\n--- Creating shop ---');
    
    // Create shop
    const newShop = new Shop({
      shopkeeperId: newShopkeeper._id,
      shopName: shopName.trim(),
      shopAddress: address.trim(),
      city: city.trim(),
      state: 'Unknown',
      pincode: pincode.trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      openingTime: openingTime || '09:00',
      closingTime: closingTime || '21:00',
      isOpen: false,
      status: 'INACTIVE' // Use uppercase as per model enum
    });

    try {
      await newShop.save();
      console.log('✓ Shop created:', newShop._id);
    } catch (shopError) {
      // Rollback: delete user and shopkeeper
      await User.deleteOne({ _id: newUser._id });
      await Shopkeeper.deleteOne({ _id: newShopkeeper._id });
      console.log('⚠️ Rolled back user and shopkeeper creation');
      throw shopError;
    }

    console.log('\n========================================');
    console.log('✅ REGISTRATION SUCCESSFUL');
    console.log('========================================\n');

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Shop registration submitted successfully. Awaiting superadmin approval. You will be notified once verified. Login will be available after approval.',
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

    console.error('\n========================================');
    console.error('❌ REGISTRATION FAILED');
    console.error('========================================');
    console.error('Error Name:', error.name);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Full Error:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const value = error.keyValue ? error.keyValue[field] : 'unknown';
      
      console.error('Duplicate Key Error - Field:', field, 'Value:', value);
      
      return res.status(400).json({
        success: false,
        message: `This ${field} is already registered: ${value}`,
        field: field,
        value: value
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      message: 'Registration failed due to server error',
      error: error.message
    });
  }
};

module.exports = {
  registerShopkeeper
};
