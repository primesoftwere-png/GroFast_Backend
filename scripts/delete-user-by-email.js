// scripts/delete-user-by-email.js
// Run this to delete a specific user by email
// Usage: node scripts/delete-user-by-email.js email@example.com

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user.model');
const Shopkeeper = require('../models/ShopKeeper/Shopkeeper');
const Shop = require('../models/ShopKeeper/Shop');

async function deleteUserByEmail(email) {
  try {
    if (!email) {
      console.error('Please provide an email as argument');
      console.log('Usage: node scripts/delete-user-by-email.js email@example.com');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Looking for user with email:', trimmedEmail);

    // Find user
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      console.log('User not found with email:', trimmedEmail);
      await mongoose.disconnect();
      return;
    }

    console.log('Found user:', {
      id: user._id,
      email: user.email,
      phone: user.phone,
      fullname: user.fullname,
      role: user.role
    });

    // Find and delete shopkeeper
    const shopkeeper = await Shopkeeper.findOne({ userId: user._id });
    if (shopkeeper) {
      console.log('Found shopkeeper:', shopkeeper._id);
      
      // Find and delete shop
      const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id });
      if (shop) {
        console.log('Found shop:', shop._id);
        await Shop.deleteOne({ _id: shop._id });
        console.log('✓ Shop deleted');
      }
      
      await Shopkeeper.deleteOne({ _id: shopkeeper._id });
      console.log('✓ Shopkeeper deleted');
    }

    // Delete user
    await User.deleteOne({ _id: user._id });
    console.log('✓ User deleted');

    console.log('\n✅ Successfully deleted user and related data');

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
deleteUserByEmail(email);
