const express = require("express");
const router = express.Router();
const upload = require("../../middlewere/uploadMiddleware");
const productController = require("../../controllers/shopkeeper/product.controller"); // Updated import
const authMiddleware = require("../../middlewere/user.middlewere");
const roleMiddleware = require("../../middlewere/role.middleware");

// Apply common middleware to all product routes
router.use(
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin")
);

router.post(
  "/add-product",
  upload.single("productImage"),
  productController.addProduct
);

router.put(
  "/update-product/:productId",
  upload.single("productImage"),
  productController.updateProduct
);

router.get("/get-all-products", productController.getProducts);
router.get("/get-products/:createdBy", productController.getProductsByUserId);

router.get("/get-product/:productId", productController.getByProductId);

router.get(
  "/get-product/:categoryId/:userId",
  productController.getProductByCategoryIdAndUserId
);

router.delete("/delete-product/:productId", productController.deleteProduct);

module.exports = router;
