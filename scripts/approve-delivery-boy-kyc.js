// scripts/approve-delivery-boy-kyc.js
// Quick script to approve delivery boy KYC for testing

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/grofast';

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => {
  console.log('✓ Connected to MongoDB');
}).catch(err => {
  console.error('✗ MongoDB connection error:', err.message);
  console.error('');
  console.error('Make sure:');
  console.error('1. MongoDB is running');
  console.error('2. Connection string in .env is correct');
  console.error('3. Database name is correct');
  console.error('');
  process.exit(1);
});

// Define schemas (flexible for any structure)
const DeliveryBoyKYCSchema = new mongoose.Schema({}, { 
  collection: 'deliveryboykycs', 
  strict: false 
});

const DeliveryBoySchema = new mongoose.Schema({}, { 
  collection: 'deliveryboys', 
  strict: false 
});

const DeliveryBoyKYC = mongoose.model('DeliveryBoyKYC', DeliveryBoyKYCSchema);
const DeliveryBoy = mongoose.model('DeliveryBoy', DeliveryBoySchema);

/**
 * Approve KYC for a specific delivery boy
 */
async function approveKYCByPhone(phoneNumber) {
  try {
    console.log('\n========================================');
    console.log('APPROVING KYC FOR DELIVERY BOY');
    console.log('========================================');
    console.log('Phone Number:', phoneNumber);
    console.log('');

    // Step 1: Find and update KYC document
    console.log('Step 1: Updating KYC document...');
    const kycResult = await DeliveryBoyKYC.updateOne(
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
      console.log('✗ No KYC document found for this phone number');
      console.log('');
      console.log('Possible reasons:');
      console.log('1. Delivery boy has not registered yet');
      console.log('2. Delivery boy has not submitted KYC yet');
      console.log('3. Phone number is incorrect');
      console.log('');
      console.log('To check all delivery boys, run:');
      console.log('  node scripts/approve-delivery-boy-kyc.js list');
      console.log('');
      return false;
    }

    console.log(`✓ KYC document updated (${kycResult.modifiedCount} document)`);

    // Step 2: Find and update delivery boy document
    console.log('\nStep 2: Updating delivery boy status...');
    const dbResult = await DeliveryBoy.updateOne(
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

    if (dbResult.matchedCount === 0) {
      console.log('✗ No delivery boy found for this phone number');
      return false;
    }

    console.log(`✓ Delivery boy status updated (${dbResult.modifiedCount} document)`);

    // Step 3: Verify the update
    console.log('\nStep 3: Verifying update...');
    const deliveryBoy = await DeliveryBoy.findOne({ phoneNumber: phoneNumber });
    
    if (deliveryBoy) {
      console.log('\n✅ KYC APPROVED SUCCESSFULLY!');
      console.log('========================================');
      console.log('Delivery Boy Details:');
      console.log('  Name:', deliveryBoy.fullName || 'N/A');
      console.log('  Phone:', deliveryBoy.phoneNumber);
      console.log('  Email:', deliveryBoy.email || 'N/A');
      console.log('  KYC Status:', deliveryBoy.kycStatus);
      console.log('  Available:', deliveryBoy.isAvailable);
      console.log('  Online:', deliveryBoy.isOnline);
      console.log('  Vehicle:', deliveryBoy.vehicleType || 'N/A');
      console.log('  Vehicle Number:', deliveryBoy.vehicleNumber || 'N/A');
      console.log('========================================');
      console.log('\n✓ Delivery boy can now accept orders!');
      console.log('');
      return true;
    }

    return false;
  } catch (error) {
    console.error('\n✗ Error approving KYC:', error.message);
    return false;
  }
}

/**
 * Approve all pending KYCs
 */
async function approveAllPendingKYCs() {
  try {
    console.log('\n========================================');
    console.log('APPROVING ALL PENDING KYCs');
    console.log('========================================\n');

    // Step 1: Update all pending KYCs
    console.log('Step 1: Updating all pending KYC documents...');
    const kycResult = await DeliveryBoyKYC.updateMany(
      { kycStatus: 'pending' },
      { 
        $set: { 
          kycStatus: 'approved',
          verifiedAt: new Date(),
          verifiedBy: 'admin',
          remarks: 'Bulk approved via script for testing',
          updatedAt: new Date()
        }
      }
    );

    console.log(`✓ Updated ${kycResult.modifiedCount} KYC documents`);

    // Step 2: Update all delivery boys with pending KYC
    console.log('\nStep 2: Updating all delivery boy statuses...');
    const dbResult = await DeliveryBoy.updateMany(
      { kycStatus: 'pending' },
      { 
        $set: { 
          kycStatus: 'approved',
          isAvailable: true,
          isOnline: true,
          updatedAt: new Date()
        }
      }
    );

    console.log(`✓ Updated ${dbResult.modifiedCount} delivery boy documents`);

    // Step 3: Show all approved delivery boys
    console.log('\nStep 3: Listing all approved delivery boys...');
    const approvedDeliveryBoys = await DeliveryBoy.find(
      { kycStatus: 'approved' },
      { fullName: 1, phoneNumber: 1, email: 1, vehicleType: 1, isAvailable: 1, isOnline: 1 }
    );

    console.log('\n✅ ALL KYCs APPROVED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`Total Approved Delivery Boys: ${approvedDeliveryBoys.length}`);
    console.log('========================================\n');

    if (approvedDeliveryBoys.length > 0) {
      approvedDeliveryBoys.forEach((db, index) => {
        console.log(`${index + 1}. ${db.fullName || 'N/A'}`);
        console.log(`   Phone: ${db.phoneNumber}`);
        console.log(`   Email: ${db.email || 'N/A'}`);
        console.log(`   Vehicle: ${db.vehicleType || 'N/A'}`);
        console.log(`   Available: ${db.isAvailable}`);
        console.log(`   Online: ${db.isOnline}`);
        console.log('');
      });
    }

    console.log('✓ All delivery boys can now accept orders!');
    console.log('');
    return true;
  } catch (error) {
    console.error('\n✗ Error approving KYCs:', error.message);
    return false;
  }
}

/**
 * List all delivery boys with their KYC status
 */
async function listAllDeliveryBoys() {
  try {
    console.log('\n========================================');
    console.log('ALL DELIVERY BOYS');
    console.log('========================================\n');

    const deliveryBoys = await DeliveryBoy.find(
      {},
      { fullName: 1, phoneNumber: 1, email: 1, kycStatus: 1, isAvailable: 1, isOnline: 1 }
    ).sort({ createdAt: -1 });

    if (deliveryBoys.length === 0) {
      console.log('❌ No delivery boys found in database');
      console.log('');
      console.log('This means:');
      console.log('1. No delivery boys have registered yet');
      console.log('2. You need to register a delivery boy first');
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
      console.log(`   KYC Status: ${db.kycStatus || 'N/A'}`);
      console.log(`   Available: ${db.isAvailable || false}`);
      console.log(`   Online: ${db.isOnline || false}`);
      console.log('');
    });

    console.log('========================================');
    console.log(`Total: ${deliveryBoys.length} delivery boys`);
    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ Error listing delivery boys:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const phoneNumber = args[1];

  if (!command) {
    console.log('\n========================================');
    console.log('DELIVERY BOY KYC APPROVAL SCRIPT');
    console.log('========================================\n');
    console.log('Usage:');
    console.log('  node scripts/approve-delivery-boy-kyc.js <command> [phone]');
    console.log('');
    console.log('Commands:');
    console.log('  approve <phone>  - Approve KYC for specific phone number');
    console.log('  approve-all      - Approve all pending KYCs');
    console.log('  list             - List all delivery boys with status');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/approve-delivery-boy-kyc.js approve 9123456789');
    console.log('  node scripts/approve-delivery-boy-kyc.js approve-all');
    console.log('  node scripts/approve-delivery-boy-kyc.js list');
    console.log('');
    mongoose.connection.close();
    return;
  }

  let success = false;

  switch (command) {
    case 'approve':
      if (!phoneNumber) {
        console.log('\n✗ Error: Phone number is required');
        console.log('Usage: node scripts/approve-delivery-boy-kyc.js approve <phone>\n');
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
      console.log(`\n✗ Unknown command: ${command}`);
      console.log('Use: approve, approve-all, or list\n');
  }

  mongoose.connection.close();
  process.exit(success ? 0 : 1);
}

// Run the script
main();
