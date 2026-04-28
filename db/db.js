const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");

const MongoConnection = () => {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("MongoDB connected successfully");
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error);
    });
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
