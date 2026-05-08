// scripts/check-database.js
// Check what's in the database

const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/Grofast');
    console.log('✓ Connected to database');
    console.log('Database name:', mongoose.connection.db.databaseName);

    console.log('\n========================================');
    console.log('COLLECTIONS IN DATABASE');
    console.log('========================================\n');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Total collections:', collections.length);
    
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }

    console.log('\n========================================');
    console.log('USERS IN DATABASE');
    console.log('========================================\n');

    const User = require('../models/user.model');
    const users = await User.find({}).limit(10);
    console.log(`Total users: ${await User.countDocuments({})}`);
    
    if (users.length > 0) {
      console.log('\nFirst 10 users:');
      for (const user of users) {
        console.log('---');
        console.log('User ID:', user._id);
        console.log('Name:', user.fullname);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
      }
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  }
}

checkDatabase();
