const fs = require("fs");
const path = require("path");

/**
 * Postman Collection Generator for Grofast API
 * 
 * This script generates a complete Postman collection with all API routes
 * organized by role and functionality.
 * 
 * Usage: node generate-postman.js
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Base URL for your API
  baseUrl: process.env.BASE_URL || "http://localhost:8000",
  
  // Output file name
  outputFile: "Grofast_API_Collection.json",
  
  // Collection name
  collectionName: "Grofast API",
  
  // API prefix
  apiPrefix: "/api",
  
  // Whether to include example request bodies
  includeExampleBodies: true,
  
  // Whether to detect and mark protected routes
  detectAuthRoutes: true,
};

// ============================================================================
// ROUTE DEFINITIONS - Complete API Structure
// ============================================================================

const API_ROUTES = {
  // Authentication Routes
  "Auth": {
    description: "User authentication and account management",
    routes: [
      { method: "POST", path: "/user/register", auth: false, body: { name: "John Doe", email: "user@example.com", password: "password123", phone: "1234567890", role: "customer" } },
      { method: "POST", path: "/user/login", auth: false, body: { email: "user@example.com", password: "password123" } },
      { method: "POST", path: "/user/forgot-password", auth: false, body: { email: "user@example.com" } },
      { method: "POST", path: "/user/reset-password/:token", auth: false, body: { password: "newPassword123", confirmPassword: "newPassword123" } },
      { method: "PUT", path: "/user/update-address", auth: true, body: { address: "123 Main St", city: "New York", state: "NY", zipCode: "10001", country: "USA" } },
      { method: "GET", path: "/user/profile", auth: true },
      { method: "GET", path: "/user/logout", auth: true },
    ]
  },

  // Customer Routes
  "Customer - Profile": {
    description: "Customer profile and account management",
    routes: [
      { method: "GET", path: "/customer/profile", auth: true },
      { method: "PUT", path: "/customer/profile", auth: true, body: { name: "John Doe", phone: "1234567890", email: "john@example.com" } },
      { method: "POST", path: "/customer/address", auth: true, body: { street: "123 Main St", city: "New York", state: "NY", zipCode: "10001", country: "USA", isDefault: true } },
      { method: "GET", path: "/customer/addresses", auth: true },
      { method: "PUT", path: "/customer/address/:addressId", auth: true, body: { street: "456 Oak Ave", city: "Los Angeles", state: "CA", zipCode: "90001" } },
      { method: "DELETE", path: "/customer/address/:addressId", auth: true },
    ]
  },

  // Cart Routes
  "Customer - Cart": {
    description: "Shopping cart management",
    routes: [
      { method: "POST", path: "/cart/create-cart", auth: true, body: { items: [{ productId: "product_id_here", quantity: 2, shopId: "shop_id_here" }] } },
      { method: "POST", path: "/cart/add-item", auth: true, body: { productId: "product_id_here", quantity: 1, shopId: "shop_id_here" } },
      { method: "POST", path: "/cart/add-multiple-items", auth: true, body: { items: [{ productId: "product_id_1", quantity: 2, shopId: "shop_id_here" }, { productId: "product_id_2", quantity: 1, shopId: "shop_id_here" }] } },
      { method: "POST", path: "/cart/remove-item", auth: true, body: { productId: "product_id_here" } },
      { method: "GET", path: "/cart/get-cart", auth: true },
      { method: "GET", path: "/cart/user/:userId", auth: true },
      { method: "GET", path: "/cart/summary/:userId", auth: true },
      { method: "GET", path: "/cart/products/:userId", auth: true },
    ]
  },

  // Order Routes
  "Customer - Orders": {
    description: "Order management and tracking",
    routes: [
      { method: "POST", path: "/order/create", auth: true, body: { items: [{ productId: "product_id", quantity: 2, shopId: "shop_id" }], deliveryAddressId: "address_id", paymentMethod: "razorpay" } },
      { method: "GET", path: "/order/my-orders", auth: true },
      { method: "GET", path: "/order/:orderId", auth: true },
      { method: "PUT", path: "/order/:orderId/cancel", auth: true },
      { method: "GET", path: "/order/:orderId/track", auth: true },
      { method: "POST", path: "/order/:orderId/review", auth: true, body: { rating: 5, comment: "Great service!" } },
    ]
  },

  // Payment Routes
  "Customer - Payment": {
    description: "Payment processing with Razorpay",
    routes: [
      { method: "POST", path: "/payment/create-order", auth: true, body: { amount: 1000, currency: "INR", orderId: "order_id_here" } },
      { method: "POST", path: "/payment/verify", auth: true, body: { razorpay_order_id: "order_id", razorpay_payment_id: "payment_id", razorpay_signature: "signature" } },
      { method: "GET", path: "/payment/history", auth: true },
      { method: "GET", path: "/payment/:paymentId", auth: true },
    ]
  },

  // Product Routes (Public)
  "Products - Browse": {
    description: "Browse and search products (Public)",
    routes: [
      { method: "GET", path: "/products", auth: false },
      { method: "GET", path: "/products/:id", auth: false },
      { method: "GET", path: "/products/bestsellers", auth: false },
      { method: "GET", path: "/products/search", auth: false },
      { method: "GET", path: "/products/category/:categoryId", auth: false },
    ]
  },

  // Category Routes (Public)
  "Categories - Browse": {
    description: "Browse product categories (Public)",
    routes: [
      { method: "GET", path: "/categories", auth: false },
      { method: "GET", path: "/categories/:id", auth: false },
      { method: "GET", path: "/categories/with-count", auth: false },
    ]
  },

  // Admin Routes
  "Admin - Authentication": {
    description: "Admin authentication",
    routes: [
      { method: "POST", path: "/admin/login", auth: false, body: { email: "admin@example.com", password: "admin123" } },
      { method: "GET", path: "/admin/profile", auth: true },
      { method: "GET", path: "/admin/logout", auth: true },
    ]
  },

  "Admin - Shopkeeper Management": {
    description: "Manage shopkeepers and shops",
    routes: [
      { method: "POST", path: "/admin/shopkeeper/register", auth: true, body: { name: "Shop Owner", email: "shop@example.com", password: "password123", phone: "1234567890", shopName: "My Shop", shopAddress: "123 Shop St" } },
      { method: "GET", path: "/admin/shopkeeper/all", auth: true },
      { method: "GET", path: "/admin/shopkeeper/:id", auth: true },
      { method: "PUT", path: "/admin/shopkeeper/:id", auth: true, body: { name: "Updated Name", status: "active" } },
      { method: "DELETE", path: "/admin/shopkeeper/:id", auth: true },
      { method: "PUT", path: "/admin/shopkeeper/:id/approve", auth: true },
      { method: "PUT", path: "/admin/shopkeeper/:id/reject", auth: true },
    ]
  },

  "Admin - Dashboard": {
    description: "Admin dashboard and analytics",
    routes: [
      { method: "GET", path: "/admin/dashboard/stats", auth: true },
      { method: "GET", path: "/admin/orders", auth: true },
      { method: "GET", path: "/admin/customers", auth: true },
      { method: "GET", path: "/admin/revenue", auth: true },
    ]
  },

  // Shopkeeper Routes
  "Shopkeeper - Products": {
    description: "Shopkeeper product management",
    routes: [
      { method: "POST", path: "/shopkeeper/product/create", auth: true, body: { name: "Product Name", description: "Product description", price: 99.99, categoryId: "category_id", stock: 100, images: [] }, formData: true },
      { method: "GET", path: "/shopkeeper/product/all", auth: true },
      { method: "GET", path: "/shopkeeper/product/:id", auth: true },
      { method: "PUT", path: "/shopkeeper/product/:id", auth: true, body: { name: "Updated Product", price: 89.99, stock: 150 }, formData: true },
      { method: "DELETE", path: "/shopkeeper/product/:id", auth: true },
      { method: "PUT", path: "/shopkeeper/product/:id/stock", auth: true, body: { stock: 200 } },
    ]
  },

  "Shopkeeper - Categories": {
    description: "Shopkeeper category management",
    routes: [
      { method: "POST", path: "/shopkeeper/category/create", auth: true, body: { name: "Category Name", description: "Category description" } },
      { method: "GET", path: "/shopkeeper/category/all", auth: true },
      { method: "GET", path: "/shopkeeper/category/:id", auth: true },
      { method: "PUT", path: "/shopkeeper/category/:id", auth: true, body: { name: "Updated Category" } },
      { method: "DELETE", path: "/shopkeeper/category/:id", auth: true },
    ]
  },

  "Shopkeeper - Orders": {
    description: "Shopkeeper order management",
    routes: [
      { method: "GET", path: "/shopkeeper/orders", auth: true },
      { method: "GET", path: "/shopkeeper/orders/:id", auth: true },
      { method: "PUT", path: "/shopkeeper/orders/:id/status", auth: true, body: { status: "processing" } },
      { method: "GET", path: "/shopkeeper/orders/pending", auth: true },
      { method: "GET", path: "/shopkeeper/orders/completed", auth: true },
    ]
  },

  "Shopkeeper - Inventory": {
    description: "Shopkeeper inventory management",
    routes: [
      { method: "GET", path: "/shopkeeper/inventory", auth: true },
      { method: "PUT", path: "/shopkeeper/inventory/:productId", auth: true, body: { quantity: 50, action: "add" } },
      { method: "GET", path: "/shopkeeper/inventory/low-stock", auth: true },
      { method: "GET", path: "/shopkeeper/inventory/logs", auth: true },
    ]
  },

  // Delivery Routes
  "Delivery - Authentication": {
    description: "Delivery boy authentication",
    routes: [
      { method: "POST", path: "/delivery/login", auth: false, body: { email: "delivery@example.com", password: "password123" } },
      { method: "GET", path: "/delivery/profile", auth: true },
      { method: "GET", path: "/delivery/logout", auth: true },
    ]
  },

  "Delivery - Orders": {
    description: "Delivery order management",
    routes: [
      { method: "GET", path: "/delivery/orders/available", auth: true },
      { method: "GET", path: "/delivery/orders/assigned", auth: true },
      { method: "POST", path: "/delivery/orders/:orderId/accept", auth: true },
      { method: "PUT", path: "/delivery/orders/:orderId/status", auth: true, body: { status: "picked_up" } },
      { method: "POST", path: "/delivery/orders/:orderId/complete", auth: true },
      { method: "GET", path: "/delivery/orders/history", auth: true },
    ]
  },

  "Delivery - Location": {
    description: "Delivery location tracking",
    routes: [
      { method: "POST", path: "/delivery/location/update", auth: true, body: { latitude: 40.7128, longitude: -74.0060 } },
      { method: "GET", path: "/delivery/location/current", auth: true },
    ]
  },

  // SuperAdmin Routes
  "SuperAdmin - Dashboard": {
    description: "SuperAdmin dashboard and system management",
    routes: [
      { method: "POST", path: "/superadmin/login", auth: false, body: { email: "superadmin@gmail.com", password: "superadmin123" } },
      { method: "GET", path: "/superadmin/dashboard", auth: true },
      { method: "GET", path: "/superadmin/stats", auth: true },
      { method: "GET", path: "/superadmin/users", auth: true },
      { method: "GET", path: "/superadmin/admins", auth: true },
      { method: "POST", path: "/superadmin/admin/create", auth: true, body: { name: "Admin Name", email: "admin@example.com", password: "admin123", phone: "1234567890" } },
    ]
  },

  "SuperAdmin - System Settings": {
    description: "System configuration and settings",
    routes: [
      { method: "GET", path: "/superadmin/settings", auth: true },
      { method: "PUT", path: "/superadmin/settings", auth: true, body: { deliveryFee: 50, taxRate: 0.18, minOrderAmount: 100 } },
      { method: "GET", path: "/superadmin/logs", auth: true },
    ]
  },

  "SuperAdmin - Banners": {
    description: "Banner management for app",
    routes: [
      { method: "POST", path: "/superadmin/banner/create", auth: true, body: { title: "Banner Title", imageUrl: "https://example.com/banner.jpg", link: "/products", isActive: true }, formData: true },
      { method: "GET", path: "/superadmin/banners", auth: true },
      { method: "PUT", path: "/superadmin/banner/:id", auth: true, body: { title: "Updated Banner", isActive: false } },
      { method: "DELETE", path: "/superadmin/banner/:id", auth: true },
    ]
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert path string to array for Postman
 */
function getPathArray(pathStr) {
  return pathStr.split("/").filter(Boolean);
}

/**
 * Create Postman request object
 */
function createPostmanRequest(method, path, isProtected, body = null, isFormData = false) {
  const fullPath = CONFIG.apiPrefix + path;
  
  const headers = [];

  if (!isFormData) {
    headers.push({
      key: "Content-Type",
      value: "application/json",
      type: "text"
    });
  }

  if (isProtected) {
    headers.push({
      key: "Authorization",
      value: "Bearer {{auth_token}}",
      type: "text",
      description: "JWT authentication token"
    });
  }

  // Generate request name from path
  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] || "root";
  const requestName = `${method} ${lastPart.replace(/:/g, "")}`;

  const request = {
    name: requestName,
    request: {
      method: method,
      header: headers,
      url: {
        raw: `{{base_url}}${fullPath}`,
        host: ["{{base_url}}"],
        path: getPathArray(fullPath),
      },
      description: `${method} request to ${fullPath}${isProtected ? " (Protected - Requires Authentication)" : " (Public)"}`
    },
    response: []
  };

  // Add request body if provided
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    if (isFormData) {
      // For file uploads
      const formDataArray = Object.keys(body).map(key => ({
        key: key,
        value: typeof body[key] === 'object' ? JSON.stringify(body[key]) : String(body[key]),
        type: key === 'images' || key === 'image' ? 'file' : 'text'
      }));
      
      request.request.body = {
        mode: "formdata",
        formdata: formDataArray
      };
    } else {
      request.request.body = {
        mode: "raw",
        raw: JSON.stringify(body, null, 2),
        options: {
          raw: {
            language: "json"
          }
        }
      };
    }
  }

  return request;
}

/**
 * Generate Postman collection from route definitions
 */
function generatePostmanCollection() {
  console.log("\n🚀 Grofast API - Postman Collection Generator\n");
  console.log("=" .repeat(70));

  const items = [];
  let totalRequests = 0;

  // Process each route group
  Object.keys(API_ROUTES).forEach((groupName) => {
    const group = API_ROUTES[groupName];
    const folderItems = [];

    group.routes.forEach((route) => {
      const request = createPostmanRequest(
        route.method,
        route.path,
        route.auth,
        route.body || null,
        route.formData || false
      );
      folderItems.push(request);
      totalRequests++;
    });

    items.push({
      name: groupName,
      description: group.description,
      item: folderItems
    });
  });

  // Create collection
  const collection = {
    info: {
      name: CONFIG.collectionName,
      description: `Complete API collection for ${CONFIG.collectionName} - E-commerce Grocery Delivery Platform\n\n` +
                   `This collection includes all API endpoints organized by role:\n` +
                   `- Authentication & User Management\n` +
                   `- Customer Operations (Cart, Orders, Payments)\n` +
                   `- Admin & Shopkeeper Management\n` +
                   `- Delivery Boy Operations\n` +
                   `- SuperAdmin System Management\n\n` +
                   `Base URL: ${CONFIG.baseUrl}\n` +
                   `Generated: ${new Date().toISOString()}`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _postman_id: generateUUID(),
    },
    item: items,
    variable: [
      {
        key: "base_url",
        value: CONFIG.baseUrl,
        type: "string",
        description: "Base URL for the API"
      },
      {
        key: "auth_token",
        value: "",
        type: "string",
        description: "JWT authentication token (set after login)"
      },
      {
        key: "user_id",
        value: "",
        type: "string",
        description: "Current user ID"
      },
      {
        key: "product_id",
        value: "",
        type: "string",
        description: "Sample product ID for testing"
      },
      {
        key: "order_id",
        value: "",
        type: "string",
        description: "Sample order ID for testing"
      },
      {
        key: "shop_id",
        value: "",
        type: "string",
        description: "Sample shop ID for testing"
      }
    ],
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{auth_token}}",
          type: "string"
        }
      ]
    }
  };

  // Write to file
  fs.writeFileSync(
    CONFIG.outputFile,
    JSON.stringify(collection, null, 2),
    "utf8"
  );

  // Summary
  console.log("\n✅ Postman collection generated successfully!\n");
  console.log(`📦 Collection Name: ${CONFIG.collectionName}`);
  console.log(`� Total Folders: ${items.length}`);
  console.log(`📄 Total Requests: ${totalRequests}`);
  console.log(`💾 Output File: ${CONFIG.outputFile}\n`);
  
  console.log("📋 Folder Summary:");
  items.forEach(folder => {
    console.log(`   ✓ ${folder.name} (${folder.item.length} requests)`);
  });
  
  console.log("\n" + "=".repeat(70));
  console.log("\n🎯 Next Steps:");
  console.log("   1. Import the collection into Postman");
  console.log("   2. Set environment variables:");
  console.log("      - base_url: http://localhost:8000");
  console.log("      - auth_token: (will be set after login)");
  console.log("   3. Start with Auth > POST register or POST login");
  console.log("   4. Copy the token from login response to auth_token variable");
  console.log("   5. Test protected endpoints with authentication");
  console.log("\n💡 Tips:");
  console.log("   - Use {{base_url}} variable for easy environment switching");
  console.log("   - Protected routes require valid auth_token");
  console.log("   - Replace :id, :userId, etc. with actual IDs in URLs");
  console.log("   - Check response for IDs to use in subsequent requests\n");
}

/**
 * Generate a simple UUID for Postman collection
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// RUN
// ============================================================================

try {
  generatePostmanCollection();
} catch (error) {
  console.error("\n❌ Error generating collection:");
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
