// scripts/fix-all-shopkeeper-indexes.js
// This script removes ALL problematic indexes from shopkeepers collection

const mongoose = require('mongoose');
require('dotenv').config();

async function fixAllIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('shopkeepers');

    // Get all indexes
    console.log('\n=== Current Indexes on Shopkeepers Collection ===');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('Index:', index.name, '- Keys:', JSON.stringify(index.key), '- Unique:', index.unique || false);
    });

    // List of problematic indexes to drop (not in the model)
    const indexesToDrop = ['email_1', 'phone_1'];
    
    console.log('\n=== Dropping Problematic Indexes ===');
    for (const indexName of indexesToDrop) {
      const indexExists = indexes.find(idx => idx.name === indexName);
      
      if (indexExists) {
        console.log(`Dropping ${indexName}...`);
        try {
          await collection.dropIndex(indexName);
          console.log(`✅ Successfully dropped ${indexName}`);
        } catch (error) {
          console.log(`⚠️ Could not drop ${indexName}:`, error.message);
        }
      } else {
        console.log(`✓ ${indexName} does not exist (already clean)`);
      }
    }

    // Remove email and phone fields from all shopkeepers
    console.log('\n=== Cleaning Shopkeeper Documents ===');
    const result = await collection.updateMany(
      { $or: [{ email: { $exists: true } }, { phone: { $exists: true } }] },
      { $unset: { email: "", phone: "" } }
    );
    console.log(`✅ Cleaned ${result.modifiedCount} shopkeeper documents`);

    // Show final indexes
    console.log('\n=== Final Indexes ===');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log('Index:', index.name, '- Keys:', JSON.stringify(index.key));
    });

    // Show shopkeeper count
    const totalShopkeepers = await collection.countDocuments();
    console.log('\n=== Summary ===');
    console.log('Total shopkeepers:', totalShopkeepers);

    await mongoose.disconnect();
    console.log('\n✅ Database cleanup complete!');
    console.log('You can now register shopkeepers without any conflicts.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAllIndexes();
