# 👥 ADMIN MANAGEMENT APIs - Complete Documentation

## 📋 Table of Contents
1. [Category Management](#category-management)
2. [Product Management](#product-management)
3. [User Management](#user-management)
4. [Shopkeeper Management](#shopkeeper-management)
5. [Delivery Boy Management](#delivery-boy-management)
6. [KYC Management](#kyc-management)

---

## 📦 CATEGORY MANAGEMENT

### POST /api/admin/add-category
**Description:** Create a new category  
**Auth:** Required (Admin, SuperAdmin)  
**Body:**
```json
{
  "categoryName": "Fresh Fruits",
  "description": "Fresh seasonal fruits",
  "parentCategoryId": "optional_id",
  "status": "active",
  "createdBy": "admin_user_id"
}
```

### PUT /api/admin/update-category/:categoryId
**Description:** Update an existing category  
**Auth:** Required (Admin, SuperAdmin)  
**Body:**
```json
{
  "categoryName": "Updated Fruits",
  "description": "Updated seasonal fruits",
  "parentCategoryId": "optional_id",
  "status": "active"
}
```

### GET /api/admin/get-categories
**Description:** Get all active categories  
**Auth:** Required (Admin, SuperAdmin)  

### GET /api/admin/get-category/:categoryId
**Description:** Get category by ID  
**Auth:** Required (Admin, SuperAdmin)  

### GET /api/admin/get-all-categories-with-products/:userId
**Description:** Get all categories including products for a specific user  
**Auth:** Required (Admin, SuperAdmin)  

### DELETE /api/admin/delete-category/:categoryId
**Description:** Delete a category by ID  
**Auth:** Required (Admin, SuperAdmin)  

---

## 🛒 PRODUCT MANAGEMENT

### POST /api/admin/add-product
**Description:** Create a new product (multipart/form-data)  
**Auth:** Required (Admin, SuperAdmin)  
**Body (FormData):**
- `productCode` (String)
- `productName` (String)
- `productDescription` (String)
- `productPrice` (Number)
- `productCategory` (ObjectId)
- `productQuantity` (Number)
- `productUnit` (String)
- `createdBy` (ObjectId)
- `productImage` (File)

### PUT /api/admin/update-product/:productId
**Description:** Update an existing product (multipart/form-data)  
**Auth:** Required (Admin, SuperAdmin)  
**Body (FormData - all optional):**
- `productName` (String)
- `productDescription` (String)
- `productPrice` (Number)
- `productQuantity` (Number)
- `productUnit` (String)
- `productImage` (File)

### GET /api/admin/get-products/:createdBy
**Description:** Get all products by User ID  
**Auth:** Required (Admin, SuperAdmin)  

### GET /api/admin/get-product/:productId
**Description:** Get product by ID  
**Auth:** Required (Admin, SuperAdmin)  

### GET /api/admin/get-product/:categoryId/:userId
**Description:** Get products by Category ID and User ID  
**Auth:** Required (Admin, SuperAdmin)  

### DELETE /api/admin/delete-product/:productId
**Description:** Delete a product by ID  
**Auth:** Required (Admin, SuperAdmin)  

---

## 👤 USER MANAGEMENT

### GET /api/admin/users
**Description:** Get all users (customers) with pagination  
**Auth:** Required (SuperAdmin)  
**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by account status (active, blocked, pending)
- `search` (optional) - Search by name, email, or phone

**Example Request:**
```
GET http://localhost:8000/api/admin/users?page=1&limit=20&status=active&search=john
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "role": "user",
      "accountStatus": "active",
      "createdAt": "2026-05-10T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5000,
    "pages": 250
  }
}
```

### GET /api/admin/users/:id
**Description:** Get user by ID  
**Auth:** Required (SuperAdmin)  

**Example Request:**
```
GET http://localhost:8000/api/admin/users/60d5ec49f1b2c72b8c8e4f1a
Headers:
  Authorization: Bearer YOUR_TOKEN
```

### PATCH /api/admin/users/:id/block
**Description:** Block user  
**Auth:** Required (SuperAdmin)  
**Body:**
```json
{
  "reason": "Violation of terms"
}
```

**Example Request:**
```
PATCH http://localhost:8000/api/admin/users/60d5ec49f1b2c72b8c8e4f1a/block
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
Body:
{
  "reason": "Violation of terms"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User blocked successfully",
  "data": {
    "_id": "user_id",
    "fullname": "John Doe",
    "accountStatus": "blocked"
  }
}
```

### PATCH /api/admin/users/:id/unblock
**Description:** Unblock user  
**Auth:** Required (SuperAdmin)  

**Example Request:**
```
PATCH http://localhost:8000/api/admin/users/60d5ec49f1b2c72b8c8e4f1a/unblock
Headers:
  Authorization: Bearer YOUR_TOKEN
```

---

## 🏪 SHOPKEEPER MANAGEMENT

### GET /api/admin/shopkeepers
**Description:** Get all shopkeepers with pagination  
**Auth:** Required (SuperAdmin)  
**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by status (active, pending, blocked)
- `search` (optional) - Search by name, email, phone, or shop name

**Example Request:**
```
GET http://localhost:8000/api/admin/shopkeepers?page=1&limit=20&status=pending
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "shopkeeper_id",
      "fullname": "Shop Owner",
      "email": "shop@example.com",
      "phone": "9876543210",
      "role": "admin",
      "accountStatus": "active",
      "roleDetails": {
        "admin": {
          "shopName": "Fresh Mart",
          "shopGST": "GST123456",
          "shopAddress": "123 Main St"
        },
        "shopkeeper": {
          "status": "pending"
        }
      },
      "shopkeeperProfile": {
        "_id": "profile_id",
        "userId": "shopkeeper_id"
      },
      "productCount": 150,
      "createdAt": "2026-05-10T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### GET /api/admin/shopkeepers/:id
**Description:** Get shopkeeper by ID  
**Auth:** Required (SuperAdmin)  

### PATCH /api/admin/shopkeepers/:id/approve
**Description:** Approve shopkeeper  
**Auth:** Required (SuperAdmin)  

**Example Request:**
```
PATCH http://localhost:8000/api/admin/shopkeepers/60d5ec49f1b2c72b8c8e4f1a/approve
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Shopkeeper approved successfully",
  "data": {
    "_id": "shopkeeper_id",
    "fullname": "Shop Owner",
    "roleDetails": {
      "shopkeeper": {
        "status": "active"
      }
    },
    "accountStatus": "active"
  }
}
```

### PATCH /api/admin/shopkeepers/:id/reject
**Description:** Reject shopkeeper  
**Auth:** Required (SuperAdmin)  
**Body:**
```json
{
  "reason": "Incomplete documents"
}
```

**Example Request:**
```
PATCH http://localhost:8000/api/admin/shopkeepers/60d5ec49f1b2c72b8c8e4f1a/reject
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
Body:
{
  "reason": "Incomplete documents"
}
```

---

## 🛵 DELIVERY BOY MANAGEMENT

### GET /api/admin/delivery-boys
**Description:** Get all delivery boys with pagination  
**Auth:** Required (SuperAdmin)  
**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by status (active, inactive)
- `search` (optional) - Search by name, email, or phone

**Example Request:**
```
GET http://localhost:8000/api/admin/delivery-boys?page=1&limit=20&status=active
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "delivery_boy_id",
      "fullname": "Raj Kumar",
      "email": "raj@example.com",
      "phone": "5555555555",
      "role": "deliveryBoy",
      "accountStatus": "active",
      "roleDetails": {
        "deliveryBoy": {
          "vehicleNumber": "MH01AB1234",
          "drivingLicense": "DL123456",
          "deliveryBoyStatus": "active"
        }
      },
      "deliveryBoyProfile": {
        "_id": "profile_id",
        "userId": "delivery_boy_id",
        "isOnline": true,
        "isAvailable": true,
        "totalDeliveries": 250
      },
      "createdAt": "2026-05-10T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 200,
    "pages": 10
  }
}
```

### GET /api/admin/delivery-boys/:id
**Description:** Get delivery boy by ID  
**Auth:** Required (SuperAdmin)  

### PATCH /api/admin/delivery-boys/:id/approve
**Description:** Approve delivery boy  
**Auth:** Required (SuperAdmin)  

**Example Request:**
```
PATCH http://localhost:8000/api/admin/delivery-boys/60d5ec49f1b2c72b8c8e4f1a/approve
Headers:
  Authorization: Bearer YOUR_TOKEN
```

### PATCH /api/admin/delivery-boys/:id/reject
**Description:** Reject delivery boy  
**Auth:** Required (SuperAdmin)  
**Body:**
```json
{
  "reason": "Invalid documents"
}
```

---

## 📄 KYC MANAGEMENT

### GET /api/admin/kyc/shopkeepers
**Description:** Get all shopkeeper KYC requests with pagination  
**Auth:** Required (SuperAdmin)  
**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by status (pending, approved, rejected)

**Example Request:**
```
GET http://localhost:8000/api/admin/kyc/shopkeepers?page=1&limit=20&status=pending
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "kyc_id",
      "shopkeeperId": {
        "_id": "shopkeeper_id",
        "fullname": "Shop Owner",
        "email": "shop@example.com",
        "phone": "9876543210"
      },
      "status": "pending",
      "documents": {
        "aadharCard": "url_to_aadhar",
        "panCard": "url_to_pan",
        "gstCertificate": "url_to_gst"
      },
      "createdAt": "2026-05-10T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### PATCH /api/admin/kyc/shopkeepers/:id/approve
**Description:** Approve shopkeeper KYC  
**Auth:** Required (SuperAdmin)  

**Example Request:**
```
PATCH http://localhost:8000/api/admin/kyc/shopkeepers/60d5ec49f1b2c72b8c8e4f1a/approve
Headers:
  Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Shopkeeper KYC approved successfully",
  "data": {
    "_id": "kyc_id",
    "status": "approved",
    "verifiedAt": "2026-05-10T10:30:00Z"
  }
}
```

### PATCH /api/admin/kyc/shopkeepers/:id/reject
**Description:** Reject shopkeeper KYC  
**Auth:** Required (SuperAdmin)  
**Body:**
```json
{
  "reason": "Documents not clear"
}
```

**Example Request:**
```
PATCH http://localhost:8000/api/admin/kyc/shopkeepers/60d5ec49f1b2c72b8c8e4f1a/reject
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
Body:
{
  "reason": "Documents not clear"
}
```

### GET /api/admin/kyc/delivery-boys
**Description:** Get all delivery boy KYC requests with pagination  
**Auth:** Required (SuperAdmin)  
**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `status` (optional) - Filter by status (pending, approved, rejected)

**Example Request:**
```
GET http://localhost:8000/api/admin/kyc/delivery-boys?page=1&limit=20&status=pending
Headers:
  Authorization: Bearer YOUR_TOKEN
```

### PATCH /api/admin/kyc/delivery-boys/:id/approve
**Description:** Approve delivery boy KYC  
**Auth:** Required (SuperAdmin)  

### PATCH /api/admin/kyc/delivery-boys/:id/reject
**Description:** Reject delivery boy KYC  
**Auth:** Required (SuperAdmin)  
**Body:**
```json
{
  "reason": "Invalid driving license"
}
```

---

## 📊 Complete API Summary

### Category APIs (6)
- POST `/api/admin/add-category` - Add new category
- PUT `/api/admin/update-category/:categoryId` - Update category
- GET `/api/admin/get-categories` - List categories
- GET `/api/admin/get-category/:categoryId` - Get category by ID
- GET `/api/admin/get-all-categories-with-products/:userId` - Get categories with products
- DELETE `/api/admin/delete-category/:categoryId` - Delete category

### Product APIs (6)
- POST `/api/admin/add-product` - Add new product
- PUT `/api/admin/update-product/:productId` - Update product
- GET `/api/admin/get-products/:createdBy` - List products by user
- GET `/api/admin/get-product/:productId` - Get product by ID
- GET `/api/admin/get-product/:categoryId/:userId` - Get product by category & user
- DELETE `/api/admin/delete-product/:productId` - Delete product

### User APIs (4)
- GET `/api/admin/users` - List with pagination
- GET `/api/admin/users/:id` - Get by ID
- PATCH `/api/admin/users/:id/block` - Block user
- PATCH `/api/admin/users/:id/unblock` - Unblock user

### Shopkeeper APIs (4)
- GET `/api/admin/shopkeepers` - List with pagination
- GET `/api/admin/shopkeepers/:id` - Get by ID
- PATCH `/api/admin/shopkeepers/:id/approve` - Approve
- PATCH `/api/admin/shopkeepers/:id/reject` - Reject

### Delivery Boy APIs (4)
- GET `/api/admin/delivery-boys` - List with pagination
- GET `/api/admin/delivery-boys/:id` - Get by ID
- PATCH `/api/admin/delivery-boys/:id/approve` - Approve
- PATCH `/api/admin/delivery-boys/:id/reject` - Reject

### KYC APIs (6)
- GET `/api/admin/kyc/shopkeepers` - List shopkeeper KYC
- PATCH `/api/admin/kyc/shopkeepers/:id/approve` - Approve
- PATCH `/api/admin/kyc/shopkeepers/:id/reject` - Reject
- GET `/api/admin/kyc/delivery-boys` - List delivery boy KYC
- PATCH `/api/admin/kyc/delivery-boys/:id/approve` - Approve
- PATCH `/api/admin/kyc/delivery-boys/:id/reject` - Reject

**Total: 30 APIs**

---

## 🔐 Authentication

All APIs require:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Get token from login API:
```
POST /api/admin/login
```

---

## 📝 Common Query Parameters

All list APIs support:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status
- `search` - Search term

---

## 📄 Response Format

### Success Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

---

**Last Updated:** May 10, 2026  
**Version:** 1.0.0
