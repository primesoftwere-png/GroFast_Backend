const express = require("express");
const router = express.Router();
const wishlistController = require("../../controllers/Customer/wishlist.controller");

// ✅ Route: POST /api/wishlist/add
router.post("/add", wishlistController.addToWishlist);

// ✅ Route: DELETE /api/wishlist/remove
router.delete("/remove", wishlistController.removeFromWishlist);

// ✅ Route: GET /api/wishlist/:customerId
router.get("/:customerId", wishlistController.getWishlist);

module.exports = router;
