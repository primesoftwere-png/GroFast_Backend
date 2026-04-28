const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  orders: {
    type: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        orderDate: {
          type: Date,
          default: Date.now,
        },
        orderStatus: {
          type: String,
          enum: ["Pending", "Shipped", "Delivered", "Cancelled"],
          default: "Pending",
        },
      },
    ],
    required: false,
  },
  deliveryDetails: {
    type: [
      {
        buildingName: {
          type: String,
          required: true,
        },
        floorNumber: {
          type: String,
          required: true,
        },
        towerWing: {
          type: String,
          required: true,
        },
        Landmark: {
          type: String,
          required: true,
        },
      },
    ],
    required: false,
  },
  recipientDetails: {
    type: [
      {
        name: {
          type: String,
          required: true,
        },
        phoneNumber: {
          type: String,
          required: true,
        },
      },
    ],
    required: false,
  },

  wishlist: {
    type: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        addedDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    required: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CustomerModel = mongoose.model("Customer", customerSchema);
module.exports = CustomerModel;
