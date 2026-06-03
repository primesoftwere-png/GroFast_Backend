const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewere/user.middlewere");

const customerController = require("../../controllers/Customer/customer.controller");

// ✅ Get bestseller products (must be before /products/:id to avoid route conflict)
router.get(
  "/products/bestsellers",
  customerController.getBestsellerProducts
);

// ✅ Get all products with filters and pagination
router.get(
  "/products",
  customerController.getAllProducts
);

// ✅ Get all products (legacy endpoint)
router.get(
  "/get-products",
  customerController.getAllProducts
);

// ✅ Get product by ID
router.get(
  "/get-products/:id",
  customerController.getProductById
);

// ✅ Get product by ID (new endpoint)
router.get(
  "/products/:id",
  customerController.getProductById
);

// ✅ Get all active categories
router.get(
  "/categories",
  customerController.getAllCategories
);

// ✅ Get categories with product counts
router.get(
  "/categories/with-count",
  customerController.getCategoriesWithProductCount
);

// ✅ Get structured categories (parents with nested children)
router.get(
  "/categories/structured",
  customerController.getStructuredCategories
);

// ✅ Get category by ID
router.get(
  "/categories/:id",
  customerController.getCategoryById
);

// ✅ Get profile by ID
router.get(
  "/get-profile/:id",
  customerController.getProfileById
);

// ==================== ADDRESS MANAGEMENT ROUTES ====================

// ✅ Add new address
router.post(
  "/addresses",
  authMiddleware.userMiddlewere,
  customerController.addAddress
);

// ✅ Get all addresses for user
router.get(
  "/addresses/user/:userId",
  authMiddleware.userMiddlewere,
  customerController.getUserAddresses
);

// ✅ Get default address for user
router.get(
  "/addresses/default/:userId",
  authMiddleware.userMiddlewere,
  customerController.getDefaultAddress
);

// ✅ Get single address by ID
router.get(
  "/addresses/:addressId",
  authMiddleware.userMiddlewere,
  customerController.getAddressById
);

// ✅ Update address
router.put(
  "/addresses/:addressId",
  authMiddleware.userMiddlewere,
  customerController.updateAddress
);

// ✅ Delete address
router.delete(
  "/addresses/:addressId",
  authMiddleware.userMiddlewere,
  customerController.deleteAddress
);

// ✅ Set address as default
router.patch(
  "/addresses/:addressId/set-default",
  authMiddleware.userMiddlewere,
  customerController.setDefaultAddress
);

module.exports = router;
