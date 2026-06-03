const express = require("express");
const router = express.Router();
const categoryController = require("../../controllers/shopkeeper/category.controller"); // Updated import
const authMiddleware = require("../../middlewere/user.middlewere");
const roleMiddleware = require("../../middlewere/role.middleware");
const upload = require("../../middlewere/uploadMiddleware");

// Apply common middleware to all category routes
router.use(authMiddleware.userMiddlewere, roleMiddleware.authorizeRoles("admin", "superadmin"));

router.post(
  "/add-category",
  upload.single("categoryImage"),
  categoryController.addCategory
);

router.put(
  "/update-category/:categoryId",
  upload.single("categoryImage"),
  categoryController.updateCategory
);

router.get(
  "/get-categories",
  categoryController.getCategories
);

router.get(
  "/get-category/:categoryId",
  categoryController.getCategoryById
);

router.get(
  "/get-all-categories-with-products/:userId",
  categoryController.getAllCategoriesWithProducts
);

router.delete(
  "/delete-category/:categoryId",
  categoryController.deleteCategory
);

module.exports = router;