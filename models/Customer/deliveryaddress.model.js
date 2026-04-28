const mogoose = require("mongoose");

const deliveryAddressSchema = new mogoose.Schema({
  userId: {
    type: mogoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
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
  landmark: {
    type: String,
    required: true,
  },
  recipientDetails: [
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
});
const DeliveryAddressModel = mogoose.model(
  "DeliveryAddress",
  deliveryAddressSchema
);
module.exports = DeliveryAddressModel;
