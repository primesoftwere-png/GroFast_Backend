// Updated router (admin routes) - No changes needed here, but ensure auth sets req.user.role correctly
// If 403 persists, check: 1) User's role in DB/token (e.g., via console.log(req.user) in authMiddleware)
// 2) Token decoding in authMiddleware. 3) Ensure login/register sets role as "admin" or "superadmin"
const express = require("express");
const router = express.Router();
const upload = require("../../middlewere/uploadMiddleware");
const adminController = require("../../controllers/Admin/admin.controller");
const authMiddleware = require("../../middlewere/user.middlewere");
const roleMiddleware = require("../../middlewere/role.middleware");

// Apply role middleware to ensure only 'admin' and 'superadmin' can access these routes
// (Placed after authMiddleware to ensure req.user is set)

router.post(
  "/add-product",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  upload.single("productImage"),
  adminController.addProduct
);

router.post(
  "/add-category",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  upload.single("categoryImage"),
  adminController.addCategory
);

router.put(
  "/update-product/:productId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  upload.single("productImage"),
  adminController.updateProduct
);

router.put(
  "/update-category/:categoryId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  upload.single("categoryImage"),
  adminController.updateCategory
);

router.get(
  "/get-products/:createdBy",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getProductsByUserId
);

router.get(
  "/get-product/:productId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getByProductId
);

router.get(
  "/get-categories",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getCategories
);

// NEW: Added GET route for single category
router.get(
  "/get-category/:categoryId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getCategoryById
);

router.get(
  "/get-product/:categoryId/:userId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getProductByCategoryIdAndUserId
);

router.get(
  "/get-all-categories-with-products/:userId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.getAllCategoriesWithProducts
);

router.delete(
  "/delete-product/:productId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.deleteProduct
);

router.delete(
  "/delete-category/:categoryId",
  authMiddleware.userMiddlewere,
  roleMiddleware.authorizeRoles("admin", "superadmin"),
  adminController.deleteCategory
);

module.exports = router;