// scripts/approve-kyc-simple.js
// Simple script to approve delivery boy KYC using native MongoDB driver

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'grofast';

/**
 * Approve KYC for a specific delivery boy
 */
async function approveKYCByPhone(phoneNumber) {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('\n========================================');
    console.log('APPROVING KYC FOR DELIVERY BOY');
    console.log('========================================');
    console.log('Phone Number:', phoneNumber);
    console.log('Database:', DB_NAME);
    console.log('');

    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Step 1: Check if delivery boy exists
    console.log('\nStep 1: Checking if delivery boy exists...');
    const deliveryBoy = await db.collection('deliveryboys').findOne({ phoneNumber: phoneNumber });

    if (!deliveryBoy) {
      console.log('✗ No delivery boy found with phone number:', phoneNumber);
      console.log('');
      console.log('Available delivery boys:');
      const allDeliveryBoys = await db.collection('deliveryboys').find({}).toArray();
      if (allDeliveryBoys.length === 0) {
        console.log('  (No delivery boys registered yet)');
        console.log('');
        console.log('Register a delivery boy first using:');
        console.log('  POST http://localhost:8000/api/delivery/auth/register');
      } else {
        allDeliveryBoys.forEach((db, index) => {
          console.log(`  ${index + 1}. ${db.fullName || 'N/A'} - ${db.phoneNumber}`);
        });
      }
      console.log('');
      return false;
    }

    console.log('✓ Delivery boy found:', deliveryBoy.fullName || 'N/A');

    // Step 2: Update KYC document
    console.log('\nStep 2: Updating KYC document...');
    const kycResult = await db.collection('deliveryboykycs').updateOne(
      { phoneNumber: phoneNumber },
      { 
        $set: { 
          kycStatus: 'approved',
          verifiedAt: new Date(),
          verifiedBy: 'admin',
          remarks: 'Approved via script for testing',
          updatedAt: new Date()
        }
      }
    );

    if (kycResult.matchedCount === 0) {
      console.log('⚠️  No KYC document found - Creating one...');
      
      // Create KYC document if it doesn't exist
      await db.collection('deliveryboykycs').insertOne({
        deliveryBoyId: deliveryBoy._id,
        userId: deliveryBoy.userId,
        fullName: deliveryBoy.fullName,
        phoneNumber: deliveryBoy.phoneNumber,
        email: deliveryBoy.email,
        kycStatus: 'approved',
        verifiedAt: new Date(),
        verifiedBy: 'admin',
        remarks: 'Auto-approved via script for testing',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✓ KYC document created and approved');
    } else {
      console.log(`✓ KYC document updated (${kycResult.modifiedCount} document)`);
    }

    // Step 3: Update delivery boy status
    console.log('\nStep 3: Updating delivery boy status...');
    const dbResult = await db.collection('deliveryboys').updateOne(
      { phoneNumber: phoneNumber },
      { 
        $set: { 
          kycStatus: 'approved',
          isAvailable: true,
          isOnline: true,
          updatedAt: new Date()
        }
      }
    );

    console.log(`✓ Delivery boy status updated (${dbResult.modifiedCount} document)`);

    // Step 4: Verify the update
    console.log('\nStep 4: Verifying update...');
    const updatedDeliveryBoy = await db.collection('deliveryboys').findOne({ phoneNumber: phoneNumber });

    console.log('\n✅ KYC APPROVED SUCCESSFULLY!');
    console.log('========================================');
    console.log('Delivery Boy Details:');
    console.log('  Name:', updatedDeliveryBoy.fullName || 'N/A');
    console.log('  Phone:', updatedDeliveryBoy.phoneNumber);
    console.log('  Email:', updatedDeliveryBoy.email || 'N/A');
    console.log('  KYC Status:', updatedDeliveryBoy.kycStatus);
    console.log('  Available:', updatedDeliveryBoy.isAvailable);
    console.log('  Online:', updatedDeliveryBoy.isOnline);
    console.log('  Vehicle:', updatedDeliveryBoy.vehicleType || 'N/A');
    console.log('  Vehicle Number:', updatedDeliveryBoy.vehicleNumber || 'N/A');
    console.log('========================================');
    console.log('\n✓ Delivery boy can now accept orders!');
    console.log('');

    return true;
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('');
    return false;
  } finally {
    await client.close();
  }
}

/**
 * Approve all pending KYCs
 */
async function approveAllPendingKYCs() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('\n========================================');
    console.log('APPROVING ALL PENDING KYCs');
    console.log('========================================');
    console.log('Database:', DB_NAME);
    console.log('');

    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Step 1: Get all delivery boys with pending KYC
    console.log('\nStep 1: Finding delivery boys with pending KYC...');
    const pendingDeliveryBoys = await db.collection('deliveryboys').find({
      $or: [
        { kycStatus: 'pending' },
        { kycStatus: { $exists: false } }
      ]
    }).toArray();

    if (pendingDeliveryBoys.length === 0) {
      console.log('✓ No pending KYCs found');
      console.log('');
      
      // Show all approved
      const approvedCount = await db.collection('deliveryboys').countDocuments({ kycStatus: 'approved' });
      console.log(`All delivery boys are already approved (${approvedCount} total)`);
      console.log('');
      return true;
    }

    console.log(`Found ${pendingDeliveryBoys.length} delivery boys with pending KYC`);

    // Step 2: Approve each one
    console.log('\nStep 2: Approving KYCs...');
    let approvedCount = 0;

    for (const deliveryBoy of pendingDeliveryBoys) {
      console.log(`  Approving: ${deliveryBoy.fullName || 'N/A'} (${deliveryBoy.phoneNumber})`);

      // Update or create KYC document
      await db.collection('deliveryboykycs').updateOne(
        { phoneNumber: deliveryBoy.phoneNumber },
        { 
          $set: { 
            kycStatus: 'approved',
            verifiedAt: new Date(),
            verifiedBy: 'admin',
            remarks: 'Bulk approved via script for testing',
            updatedAt: new Date()
          },
          $setOnInsert: {
            deliveryBoyId: deliveryBoy._id,
            userId: deliveryBoy.userId,
            fullName: deliveryBoy.fullName,
            phoneNumber: deliveryBoy.phoneNumber,
            email: deliveryBoy.email,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      // Update delivery boy status
      await db.collection('deliveryboys').updateOne(
        { _id: deliveryBoy._id },
        { 
          $set: { 
            kycStatus: 'approved',
            isAvailable: true,
            isOnline: true,
            updatedAt: new Date()
          }
        }
      );

      approvedCount++;
    }

    console.log(`\n✓ Approved ${approvedCount} delivery boys`);

    // Step 3: Show all approved delivery boys
    console.log('\nStep 3: Listing all approved delivery boys...');
    const approvedDeliveryBoys = await db.collection('deliveryboys').find(
      { kycStatus: 'approved' }
    ).toArray();

    console.log('\n✅ ALL KYCs APPROVED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`Total Approved Delivery Boys: ${approvedDeliveryBoys.length}`);
    console.log('========================================\n');

    approvedDeliveryBoys.forEach((db, index) => {
      console.log(`${index + 1}. ${db.fullName || 'N/A'}`);
      console.log(`   Phone: ${db.phoneNumber}`);
      console.log(`   Email: ${db.email || 'N/A'}`);
      console.log(`   Vehicle: ${db.vehicleType || 'N/A'}`);
      console.log(`   Available: ${db.isAvailable}`);
      console.log(`   Online: ${db.isOnline}`);
      console.log('');
    });

    console.log('✓ All delivery boys can now accept orders!');
    console.log('');

    return true;
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('');
    return false;
  } finally {
    await client.close();
  }
}

/**
 * List all delivery boys
 */
async function listAllDeliveryBoys() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('\n========================================');
    console.log('ALL DELIVERY BOYS');
    console.log('========================================');
    console.log('Database:', DB_NAME);
    console.log('');

    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const deliveryBoys = await db.collection('deliveryboys').find({}).sort({ createdAt: -1 }).toArray();

    if (deliveryBoys.length === 0) {
      console.log('❌ No delivery boys found in database');
      console.log('');
      console.log('To register a delivery boy, use:');
      console.log('  POST http://localhost:8000/api/delivery/auth/register');
      console.log('');
      console.log('Example request body:');
      console.log('{');
      console.log('  "fullname": "Raj Kumar",');
      console.log('  "email": "raj@example.com",');
      console.log('  "phone": "9123456789",');
      console.log('  "password": "password123",');
      console.log('  "vehicleType": "bike",');
      console.log('  "vehicleNumber": "GJ01AB1234"');
      console.log('}');
      console.log('');
      return;
    }

    deliveryBoys.forEach((db, index) => {
      const statusIcon = db.kycStatus === 'approved' ? '✅' : 
                        db.kycStatus === 'pending' ? '⏳' : 
                        db.kycStatus === 'rejected' ? '❌' : '❓';
      
      console.log(`${index + 1}. ${statusIcon} ${db.fullName || 'N/A'}`);
      console.log(`   Phone: ${db.phoneNumber}`);
      console.log(`   Email: ${db.email || 'N/A'}`);
      console.log(`   KYC Status: ${db.kycStatus || 'not submitted'}`);
      console.log(`   Available: ${db.isAvailable || false}`);
      console.log(`   Online: ${db.isOnline || false}`);
      console.log(`   Vehicle: ${db.vehicleType || 'N/A'} - ${db.vehicleNumber || 'N/A'}`);
      console.log('');
    });

    console.log('========================================');
    console.log(`Total: ${deliveryBoys.length} delivery boys`);
    
    const approvedCount = deliveryBoys.filter(db => db.kycStatus === 'approved').length;
    const pendingCount = deliveryBoys.filter(db => db.kycStatus === 'pending' || !db.kycStatus).length;
    
    console.log(`Approved: ${approvedCount} | Pending: ${pendingCount}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('');
  } finally {
    await client.close();
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const phoneNumber = args[1];

  console.log('');

  if (!command) {
    console.log('========================================');
    console.log('DELIVERY BOY KYC APPROVAL SCRIPT');
    console.log('========================================\n');
    console.log('Usage:');
    console.log('  node scripts/approve-kyc-simple.js <command> [phone]');
    console.log('');
    console.log('Commands:');
    console.log('  approve <phone>  - Approve KYC for specific phone number');
    console.log('  approve-all      - Approve all pending KYCs');
    console.log('  list             - List all delivery boys with status');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/approve-kyc-simple.js approve 9123456789');
    console.log('  node scripts/approve-kyc-simple.js approve-all');
    console.log('  node scripts/approve-kyc-simple.js list');
    console.log('');
    process.exit(0);
  }

  let success = false;

  switch (command) {
    case 'approve':
      if (!phoneNumber) {
        console.log('✗ Error: Phone number is required');
        console.log('Usage: node scripts/approve-kyc-simple.js approve <phone>\n');
      } else {
        success = await approveKYCByPhone(phoneNumber);
      }
      break;

    case 'approve-all':
      success = await approveAllPendingKYCs();
      break;

    case 'list':
      await listAllDeliveryBoys();
      success = true;
      break;

    default:
      console.log(`✗ Unknown command: ${command}`);
      console.log('Use: approve, approve-all, or list\n');
  }

  process.exit(success ? 0 : 1);
}

// Run the script
main().catch(error => {
  console.error('\n✗ Fatal error:', error.message);
  console.error('');
  process.exit(1);
});
