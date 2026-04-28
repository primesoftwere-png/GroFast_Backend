const useModel = require("../../models/user.model");
const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

module.exports.updateDeliveryBoyStatus = async (req, res) => {
  const { deliveryId } = req.params;
  const { status } = req.body;

  try {
    // Update delivery boy status directly
    const updatedDelivery = await useModel.findByIdAndUpdate(
      deliveryId,
      { "roleDetails.deliveryBoy.deliveryBoyStatus": status },
      { new: true }
    );
    
    if (!updatedDelivery) {
      return res.status(404).json({
        message: "Delivery boy not found",
      });
    }
    
    return res.status(200).json({
      message: "Delivery status updated successfully",
      delivery: updatedDelivery,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating delivery status",
      error: error.message,
    });
  }
};