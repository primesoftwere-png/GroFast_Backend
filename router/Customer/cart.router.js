const express = require("express");
const router = express.Router();
const cartController = require("../../controllers/Customer/cart.controller");
const authMiddleware = require("../../middlewere/user.middlewere");

// Create full cart (checkout)
router.post(
  "/create-cart",
  authMiddleware.userMiddlewere,
  cartController.createCart
);

// Add item (single product)
router.post(
  "/add-item",
  authMiddleware.userMiddlewere,
  cartController.addCartItem
);

// Add multiple items to cart
router.post(
  "/add-multiple-items",
  authMiddleware.userMiddlewere,
  cartController.addMultipleCartItems
);

// Remove item
router.post(
  "/remove-item",
  authMiddleware.userMiddlewere,
  cartController.removeCartItem
);
router.get("/get-cart", authMiddleware.userMiddlewere, cartController.getCart);

// Get cart by user (refresh)
router.get(
  "/user/:userId",
  authMiddleware.userMiddlewere,
  cartController.getCartByUser
);

// Get cart summary - returns only productId and quantity (for home screen)
router.get(
  "/summary/:userId",
  authMiddleware.userMiddlewere,
  cartController.getCartSummary
);

// Get cart products - returns only productId and quantity (simple format)
router.get(
  "/products/:userId",
  authMiddleware.userMiddlewere,
  cartController.getCartProducts
);

module.exports = router;
