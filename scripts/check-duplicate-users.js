// scripts/check-duplicate-users.js
// Run this to find duplicate emails/phones in database

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/user.model');

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Find duplicate emails
    const duplicateEmails = await User.aggregate([
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log('\n=== DUPLICATE EMAILS ===');
    if (duplicateEmails.length === 0) {
      console.log('No duplicate emails found');
    } else {
      console.log('Found', duplicateEmails.length, 'duplicate emails:');
      duplicateEmails.forEach(dup => {
        console.log(`Email: ${dup._id}, Count: ${dup.count}, IDs:`, dup.ids);
      });
    }

    // Find duplicate phones
    const duplicatePhones = await User.aggregate([
      {
        $group: {
          _id: '$phone',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log('\n=== DUPLICATE PHONES ===');
    if (duplicatePhones.length === 0) {
      console.log('No duplicate phones found');
    } else {
      console.log('Found', duplicatePhones.length, 'duplicate phones:');
      duplicatePhones.forEach(dup => {
        console.log(`Phone: ${dup._id}, Count: ${dup.count}, IDs:`, dup.ids);
      });
    }

    // List all users with admin role
    const adminUsers = await User.find({ role: 'admin' }).select('email phone fullname accountStatus createdAt');
    console.log('\n=== ALL ADMIN USERS (Shopkeepers) ===');
    console.log('Total:', adminUsers.length);
    adminUsers.forEach(user => {
      console.log(`- ${user.email} | ${user.phone} | ${user.fullname} | ${user.accountStatus} | ${user.createdAt}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDuplicates();
