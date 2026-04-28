module.exports = (io, socket) => {
  console.log("Socket connected:", socket.id);
  console.log("Socket connected to orderSocket");
  
  // Customer sends order request to shopkeeper
  socket.on("sendOrderRequest", (orderData) => {
    console.log("Order request received:", orderData);

    // Optional: save to DB here
    // Emit to specific shopkeeper room/socket
    orderData.shopkeeperId.forEach((element) => {
      console.log("Emitting to shopkeeper:", element);
      const result = io.to(element).emit("receiveOrderRequest", orderData);
      console.log("Emit result:", result);
    });
  });

  // Enhanced reject order - send message to customer
  socket.on("rejectOrder", (data) => {
    console.log("Order rejected:", data);

    // Send rejection message to CUSTOMER
    const customerMessage = {
      type: "order_rejection",
      orderId: data.orderId,
      message: data.rejectionReason || `Your order ${data.orderId} has been rejected by the shopkeeper`,
      timestamp: new Date().toISOString(),
      adminId: data.shopkeeperId || socket.id,
      action: "reject"
    };

    // Notify customer with detailed message
    io.to(data.customerId).emit("orderStatus", {
      status: "rejected",
      orderId: data.orderId,
      adminMessage: customerMessage,
      timestamp: new Date().toISOString()
    });

    // Send admin notification message to customer
    io.to(data.customerId).emit("adminNotification", customerMessage);
    
    console.log(`Rejection message sent to customer: ${data.customerId}`);

    // Broadcast to all connected admins/shopkeepers
    socket.broadcast.emit("adminActionUpdate", {
      action: "reject",
      orderId: data.orderId,
      customerId: data.customerId,
      shopkeeperId: data.shopkeeperId,
      timestamp: new Date().toISOString()
    });
  });

  // Enhanced approve order - send message to delivery boy
  socket.on("approveOrder", (data) => {
    console.log("Order approved:", data);

    // Send approval message to DELIVERY BOY
    const deliveryMessage = {
      type: "new_delivery_assignment",
      orderId: data.orderId,
      customerId: data.customerId,
      customerAddress: data.customerAddress,
      customerPhone: data.customerPhone,
      orderDetails: data.orderDetails,
      message: `New delivery assigned: Order ${data.orderId}`,
      timestamp: new Date().toISOString(),
      shopkeeperId: data.shopkeeperId || socket.id,
      estimatedTime: data.estimatedTime || "30 minutes"
    };

    // Send to delivery boy(s)
    if (data.deliveryBoyId) {
      // Send to specific delivery boy
      io.to(data.deliveryBoyId).emit("newDeliveryAssignment", deliveryMessage);
      io.to(data.deliveryBoyId).emit("deliveryNotification", deliveryMessage);
      console.log(`Delivery assignment sent to delivery boy: ${data.deliveryBoyId}`);
    } else {
      // Broadcast to all available delivery boys
      socket.broadcast.emit("newDeliveryAssignment", deliveryMessage);
      console.log("Delivery assignment broadcasted to all delivery boys");
    }

    // Also notify customer that order is approved
    const customerMessage = {
      type: "order_approval",
      orderId: data.orderId,
      message: `Your order ${data.orderId} has been approved and assigned for delivery`,
      timestamp: new Date().toISOString(),
      adminId: data.shopkeeperId || socket.id,
      action: "approve"
    };

    io.to(data.customerId).emit("orderStatus", {
      status: "approved",
      orderId: data.orderId,
      adminMessage: customerMessage,
      timestamp: new Date().toISOString()
    });

    io.to(data.customerId).emit("adminNotification", customerMessage);

    // Broadcast to all connected admins/shopkeepers
    socket.broadcast.emit("adminActionUpdate", {
      action: "approve",
      orderId: data.orderId,
      customerId: data.customerId,
      shopkeeperId: data.shopkeeperId,
      deliveryBoyId: data.deliveryBoyId,
      timestamp: new Date().toISOString()
    });
  });

  // New event: Admin/Shopkeeper sends custom message to customer
  socket.on("sendAdminMessage", (data) => {
    console.log("Admin message received:", data);

    const adminMessage = {
      type: "admin_message",
      orderId: data.orderId,
      message: data.message,
      timestamp: new Date().toISOString(),
      adminId: data.adminId || socket.id,
      customerId: data.customerId
    };

    // Send message to specific customer
    io.to(data.customerId).emit("adminNotification", adminMessage);

    // Confirm message sent to admin
    socket.emit("messageSent", {
      success: true,
      messageId: adminMessage.timestamp,
      customerId: data.customerId
    });
  });

  // New event: Customer requests admin approval
  socket.on("requestAdminApproval", (data) => {
    console.log("Admin approval requested:", data);

    const approvalRequest = {
      type: "approval_request",
      orderId: data.orderId,
      customerId: data.customerId || socket.id,
      message: data.message || `Customer requests approval for order ${data.orderId}`,
      timestamp: new Date().toISOString(),
      productDetails: data.productDetails
    };

    // Send to all shopkeepers/admins
    if (data.shopkeeperIds && data.shopkeeperIds.length > 0) {
      data.shopkeeperIds.forEach((shopkeeperId) => {
        io.to(shopkeeperId).emit("approvalRequest", approvalRequest);
      });
    } else {
      // Broadcast to all connected shopkeepers
      socket.broadcast.emit("approvalRequest", approvalRequest);
    }

    // Confirm request sent to customer
    socket.emit("approvalRequestSent", {
      success: true,
      orderId: data.orderId,
      timestamp: new Date().toISOString()
    });
  });

  // New event: Admin responds to approval request
  socket.on("respondToApproval", (data) => {
    console.log("Admin response to approval:", data);

    const response = {
      type: "approval_response",
      orderId: data.orderId,
      status: data.status, // "approved" or "rejected"
      message: data.message || `Order ${data.orderId} has been ${data.status}`,
      timestamp: new Date().toISOString(),
      adminId: data.adminId || socket.id,
      customerId: data.customerId
    };

    // Send response to customer
    io.to(data.customerId).emit("approvalResponse", response);

    // Also send via orderStatus for backward compatibility
    io.to(data.customerId).emit("orderStatus", {
      status: data.status,
      orderId: data.orderId,
      adminMessage: response,
      timestamp: new Date().toISOString()
    });
  });

  // New event: Bulk message to multiple customers
  socket.on("sendBulkMessage", (data) => {
    console.log("Bulk message received:", data);

    const bulkMessage = {
      type: "bulk_message",
      message: data.message,
      timestamp: new Date().toISOString(),
      adminId: data.adminId || socket.id,
      subject: data.subject || "Important Update"
    };

    // Send to multiple customers
    if (data.customerIds && data.customerIds.length > 0) {
      data.customerIds.forEach((customerId) => {
        io.to(customerId).emit("adminNotification", {
          ...bulkMessage,
          customerId: customerId
        });
      });
    }

    // Confirm bulk message sent
    socket.emit("bulkMessageSent", {
      success: true,
      recipientCount: data.customerIds ? data.customerIds.length : 0,
      timestamp: new Date().toISOString()
    });
  });

  // Join personal room for shopkeeper or customer
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User with ID ${userId} joined room ${userId}`);
  });

  // Join delivery boy room
  socket.on("joinAsDeliveryBoy", (deliveryBoyId) => {
    socket.join(deliveryBoyId);
    socket.join("delivery_boys"); // Join general delivery boys room
    console.log(`Delivery boy ${deliveryBoyId} joined rooms`);
  });

  // Enhanced location update with admin notification
  socket.on("location", (data) => {
    console.log("Location data received:", data);
    
    // Send location update to customer
    io.to(data.customerId).emit("locationUpdate", {
      status: "in-progress",
      location: data.location,
      orderId: data.orderId,
      timestamp: new Date().toISOString()
    });

    // Send admin notification about location update
    const locationMessage = {
      type: "location_update",
      orderId: data.orderId,
      message: `Your order ${data.orderId} is on the way`,
      timestamp: new Date().toISOString(),
      location: data.location,
      deliveryStatus: "in-progress"
    };

    io.to(data.customerId).emit("adminNotification", locationMessage);
  });

  // New event: Order status update with admin message
  socket.on("updateOrderStatus", (data) => {
    console.log("Order status update:", data);

    const statusMessage = {
      type: "status_update",
      orderId: data.orderId,
      status: data.status,
      message: data.message || `Your order ${data.orderId} status has been updated to ${data.status}`,
      timestamp: new Date().toISOString(),
      adminId: data.adminId || socket.id
    };

    // Send to customer
    io.to(data.customerId).emit("orderStatus", {
      status: data.status,
      orderId: data.orderId,
      adminMessage: statusMessage,
      timestamp: new Date().toISOString()
    });

    // Send admin notification
    io.to(data.customerId).emit("adminNotification", statusMessage);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
};
