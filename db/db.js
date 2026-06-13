const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const dns = require("dns");

// Use Google's Public DNS to avoid querySrv ECONNREFUSED errors from local DNS issues
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const MongoConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

module.exports = MongoConnection;


// const { Sequelize } = require("sequelize");

// // Create a new Sequelize instance
// const sequelize = new Sequelize(
//   process.env.MYSQL_DATABASE, // Database name
//   process.env.MYSQL_USER, // Username
//   process.env.MYSQL_PASSWORD, // Password
//   {
//     host: process.env.MYSQL_HOST, // e.g., localhost or your cloud host
//     dialect: "mysql",
//     logging: false, // disable logging queries
//   }
// );

// // Connect function
// const connectDB = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log("✅ MySQL connected successfully");
//   } catch (error) {
//     console.error("❌ MySQL connection error:", error);
//   }
// };

// module.exports = { sequelize, connectDB };
