const mongoose = require('mongoose');
require('dotenv').config();

const DeliveryBoyKYC = require('./models/DeliveryBoy/DeliveryBoyKYC');
const ShopkeeperKYC = require('./models/ShopKeeper/ShopkeeperKYC');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log("DB connected");

    const deliveryBoysCount = await DeliveryBoyKYC.countDocuments({});
    console.log("DeliveryBoyKYC total:", deliveryBoysCount);

    const pendingDeliveryBoysCount = await DeliveryBoyKYC.countDocuments({ status: 'pending' });
    console.log("DeliveryBoyKYC pending:", pendingDeliveryBoysCount);

    const shopkeepersCount = await ShopkeeperKYC.countDocuments({});
    console.log("ShopkeeperKYC total:", shopkeepersCount);

    const pendingShopkeepersCount = await ShopkeeperKYC.countDocuments({ kycStatus: 'PENDING' });
    console.log("ShopkeeperKYC pending (kycStatus PENDING):", pendingShopkeepersCount);
    
    // Check how admin KYC controller gets pending shopkeepers:
    const User = require('./models/user.model');
    const pendingUsers = await User.countDocuments({
      role: 'admin',
      'roleDetails.shopkeeper.status': 'pending'
    });
    console.log("Users with role admin and shopkeeper.status pending:", pendingUsers);

    mongoose.disconnect();
}).catch(console.error);
