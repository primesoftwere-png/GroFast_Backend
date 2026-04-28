// Migration Script: Update Cart Schema
// Run this script to clear old cart data and prepare for new schema
// Usage: node scripts/migrate-cart-schema.js

const mongoose = require('mongoose');
require('dotenv').config();

const migrateCartSchema = async () => {
  try {
    // Connect to database
    const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database');

    // Get the cart collection
    const db = mongoose.connection.db;
    const cartCollection = db.collection('cart');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'cart' }).toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️  Cart collection does not exist. No migration needed.');
      process.exit(0);
    }

    // Count existing documents
    const count = await cartCollection.countDocuments();
    console.log(`📊 Found ${count} cart documents`);

    if (count > 0) {
      console.log('⚠️  WARNING: This will delete all existing cart data!');
      console.log('⚠️  Old cart schema is incompatible with new schema.');
      
      // Drop the collection
      await cartCollection.drop();
      console.log('✅ Old cart collection dropped');
      
      // Create new collection with new schema
      await db.createCollection('cart');
      console.log('✅ New cart collection created');
      
      // Create indexes
      await cartCollection.createIndex({ userId: 1 }, { unique: true });
      await cartCollection.createIndex({ 'products.productId': 1 });
      console.log('✅ Indexes created');
    }

    console.log('✅ Migration completed successfully!');
    console.log('ℹ️  Users will need to add products to cart again.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run migration
migrateCartSchema();
