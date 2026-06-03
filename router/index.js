// Centralized route setup for modularity
// Import all routers here for easy management
const userRouter = require("../router/Auth/user.router.js");
const customerRouter = require("../router/Customer/customer.router.js");
const cartRouter = require("../router/Customer/cart.router.js");
const paymentRouter = require("../router/Customer/payment.router.js");
const orderRouter = require("../router/Customer/order.router.js");
const deliveryRouter = require("../router/Delivery/delivery.router.js");
const superadminRouter = require("../router/SuperAdmin/superadmin.router.js");
const shopkeeperRoutes = require("../router/Shopkeeper/index.js");
const adminRouter = require("../router/Admin/index.js");
const aiRouter = require("../router/AI/ai.router.js");

// Import customer controller for direct product routes
const customerController = require("../controllers/Customer/customer.controller");

/**
 * Configures all application routes on the provided Express app instance.
 * @param {Express} app - The Express application instance.
 */
const configureRoutes = (app) => {

  const apiPrefix = "/api";

  // User Authentication Routes
  app.use(`${apiPrefix}/user`, userRouter);
  app.use(`${apiPrefix}/auth`, userRouter); // Alias: /api/auth/login also works for customer panel
  app.use(`${apiPrefix}/customer`, customerRouter);
  app.use(`${apiPrefix}/cart`, cartRouter);
  app.use(`${apiPrefix}/payment`, paymentRouter);
  app.use(`${apiPrefix}/order`, orderRouter);
  app.use(`${apiPrefix}/admin`, adminRouter);
  app.use(`${apiPrefix}/shopkeeper`, shopkeeperRoutes);
  app.use(`${apiPrefix}/delivery`, deliveryRouter);
  app.use(`${apiPrefix}/superadmin`, superadminRouter);
  app.use(`${apiPrefix}/ai`, aiRouter);

  // Direct product routes (for convenience)
  app.get(`${apiPrefix}/products/bestsellers`, customerController.getBestsellerProducts);
  app.get(`${apiPrefix}/products`, customerController.getAllProducts);
  app.get(`${apiPrefix}/products/:id`, customerController.getProductById);

  // Direct category routes (for convenience)
  app.get(`${apiPrefix}/categories/with-count`, customerController.getCategoriesWithProductCount);
  app.get(`${apiPrefix}/categories/structured`, customerController.getStructuredCategories);
  app.get(`${apiPrefix}/categories/:id`, customerController.getCategoryById);
  app.get(`${apiPrefix}/categories`, customerController.getAllCategories);

  console.log("All routes configured successfully");
};

module.exports = configureRoutes;
