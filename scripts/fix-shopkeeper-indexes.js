// scripts/fix-shopkeeper-indexes.js
// This script removes the old email index from shopkeepers collection

const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('shopkeepers');

    // Get all indexes
    console.log('\n=== Current Indexes ===');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('Index:', index.name, '- Keys:', JSON.stringify(index.key));
    });

    // Check if email_1 index exists
    const emailIndex = indexes.find(idx => idx.name === 'email_1');
    
    if (emailIndex) {
      console.log('\n❌ Found problematic email_1 index');
      console.log('Dropping email_1 index...');
      
      await collection.dropIndex('email_1');
      console.log('✅ Successfully dropped email_1 index');
    } else {
      console.log('\n✓ No email_1 index found (already clean)');
    }

    // Show final indexes
    console.log('\n=== Final Indexes ===');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log('Index:', index.name, '- Keys:', JSON.stringify(index.key));
    });

    // Count shopkeepers with null email
    const nullEmailCount = await collection.countDocuments({ email: null });
    console.log('\n=== Shopkeepers with null email ===');
    console.log('Count:', nullEmailCount);

    if (nullEmailCount > 0) {
      console.log('\nRemoving email field from all shopkeepers...');
      await collection.updateMany(
        { email: { $exists: true } },
        { $unset: { email: "" } }
      );
      console.log('✅ Removed email field from all shopkeepers');
    }

    await mongoose.disconnect();
    console.log('\n✅ Database cleanup complete!');
    console.log('You can now register shopkeepers without email conflicts.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndexes();
