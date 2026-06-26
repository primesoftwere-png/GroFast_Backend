const mongoose = require("mongoose");
const Shop = require("./models/ShopKeeper/Shop");
const Product = require("./models/Product.model");
const User = require("./models/Auth/User");

mongoose.connect("mongodb+srv://developer:developer@cluster0.oayz0.mongodb.net/grofast?retryWrites=true&w=majority")
  .then(async () => {
    console.log("Connected to MongoDB");
    // Find shop by ID if provided, or any shop
    const shop = await Shop.findOne({}).populate('shopkeeperId').lean();
    console.log("Found shop:", shop ? shop._id : "none");
    if (shop && shop.shopkeeperId) {
        console.log("Shopkeeper ID:", shop.shopkeeperId._id);
        const products = await Product.find({ createdBy: shop.shopkeeperId._id }).populate('productCategory').lean();
        console.log(`Found ${products.length} products for this shopkeeper.`);
        if (products.length > 0) {
            console.log("Sample product:", JSON.stringify(products[0], null, 2));
        }
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
