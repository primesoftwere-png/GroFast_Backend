# Address Management API Documentation

Complete API documentation for managing multiple addresses for users.

## Base URL
```
/api/customer
```

---

## 📍 API Endpoints

### 1. Add New Address
**POST** `/addresses`

Add a new delivery address for a user. If this is the first address, it will automatically be set as default.

#### Request Body:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "addressType": "home",
  "addressLine1": "123 Main Street",
  "addressLine2": "Apartment 4B",
  "landmark": "Near Central Park",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "isDefault": true
}
```

#### Required Fields:
- `userId` - User ID
- `addressLine1` - Primary address line
- `city` - City name
- `state` - State name
- `pincode` - Postal code

#### Optional Fields:
- `addressType` - Type of address: `home`, `work`, or `other` (default: `home`)
- `addressLine2` - Secondary address line
- `landmark` - Nearby landmark
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `isDefault` - Set as default address (default: `false`, auto `true` for first address)

#### Response (201):
```json
{
  "success": true,
  "message": "Address added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "customerId": "507f1f77bcf86cd799439011",
    "addressType": "home",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B",
    "landmark": "Near Central Park",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "isDefault": true,
    "createdAt": "2026-04-26T10:30:00.000Z",
    "updatedAt": "2026-04-26T10:30:00.000Z"
  }
}
```

---

### 2. Get All Addresses for User
**GET** `/addresses/user/:userId`

Retrieve all addresses for a specific user. Addresses are sorted with default address first.

#### URL Parameters:
- `userId` - User ID

#### Response (200):
```json
{
  "success": true,
  "message": "Addresses retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "customerId": "507f1f77bcf86cd799439011",
      "addressType": "home",
      "addressLine1": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "isDefault": true,
      "createdAt": "2026-04-26T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "customerId": "507f1f77bcf86cd799439011",
      "addressType": "work",
      "addressLine1": "456 Office Plaza",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400002",
      "isDefault": false,
      "createdAt": "2026-04-25T09:15:00.000Z"
    }
  ],
  "count": 2
}
```

---

### 3. Get Default Address
**GET** `/addresses/default/:userId`

Retrieve the default delivery address for a user.

#### URL Parameters:
- `userId` - User ID

#### Response (200):
```json
{
  "success": true,
  "message": "Default address retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "customerId": "507f1f77bcf86cd799439011",
    "addressType": "home",
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "isDefault": true
  }
}
```

---

### 4. Get Single Address by ID
**GET** `/addresses/:addressId`

Retrieve details of a specific address.

#### URL Parameters:
- `addressId` - Address ID

#### Response (200):
```json
{
  "success": true,
  "message": "Address retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "customerId": "507f1f77bcf86cd799439011",
    "addressType": "home",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B",
    "landmark": "Near Central Park",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "isDefault": true,
    "createdAt": "2026-04-26T10:30:00.000Z",
    "updatedAt": "2026-04-26T10:30:00.000Z"
  }
}
```

---

### 5. Update Address
**PUT** `/addresses/:addressId`

Update an existing address. All fields are optional - only send fields you want to update.

#### URL Parameters:
- `addressId` - Address ID

#### Request Body (all fields optional):
```json
{
  "addressType": "work",
  "addressLine1": "789 New Street",
  "addressLine2": "Floor 5",
  "landmark": "Near Metro Station",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400003",
  "latitude": 19.0800,
  "longitude": 72.8800,
  "isDefault": false
}
```

#### Response (200):
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "customerId": "507f1f77bcf86cd799439011",
    "addressType": "work",
    "addressLine1": "789 New Street",
    "addressLine2": "Floor 5",
    "landmark": "Near Metro Station",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400003",
    "latitude": 19.0800,
    "longitude": 72.8800,
    "isDefault": false,
    "updatedAt": "2026-04-26T11:45:00.000Z"
  }
}
```

---

### 6. Delete Address
**DELETE** `/addresses/:addressId`

Delete an address. If the deleted address was the default, another address will automatically be set as default.

#### URL Parameters:
- `addressId` - Address ID

#### Response (200):
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

---

### 7. Set Address as Default
**PATCH** `/addresses/:addressId/set-default`

Set a specific address as the default delivery address. All other addresses will be unmarked as default.

#### URL Parameters:
- `addressId` - Address ID

#### Request Body:
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

#### Response (200):
```json
{
  "success": true,
  "message": "Default address updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "customerId": "507f1f77bcf86cd799439011",
    "addressType": "home",
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "isDefault": true,
    "updatedAt": "2026-04-26T12:00:00.000Z"
  }
}
```

---

## 🔐 Authentication

All endpoints require authentication. Include the JWT token in the request header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 📋 Address Types

The `addressType` field accepts the following values:
- `home` - Home address (default)
- `work` - Work/office address
- `other` - Other address type

---

## ✨ Features

### Automatic Default Management
- First address added is automatically set as default
- When an address is set as default, all other addresses are unmarked
- When default address is deleted, the most recent address becomes default

### Validation
- All endpoints validate MongoDB ObjectId format
- Required fields are enforced
- User existence is verified before adding addresses
- Address ownership is verified before updates

### Sorting
- Addresses are returned with default address first
- Then sorted by creation date (newest first)

---

## 🚨 Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Address Line 1, City, State, and Pincode are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Address not found"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Unauthorized: Address does not belong to this user"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to add address",
  "error": "Error details here"
}
```

---

## 📱 Usage Examples

### Example 1: Add First Address (Auto Default)
```javascript
POST /api/customer/addresses
{
  "userId": "507f1f77bcf86cd799439011",
  "addressLine1": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
// Response: isDefault will be true automatically
```

### Example 2: Add Second Address
```javascript
POST /api/customer/addresses
{
  "userId": "507f1f77bcf86cd799439011",
  "addressType": "work",
  "addressLine1": "456 Office Plaza",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400002",
  "isDefault": false
}
```

### Example 3: Change Default Address
```javascript
PATCH /api/customer/addresses/507f1f77bcf86cd799439013/set-default
{
  "userId": "507f1f77bcf86cd799439011"
}
// This address becomes default, previous default is unmarked
```

### Example 4: Update Address Partially
```javascript
PUT /api/customer/addresses/507f1f77bcf86cd799439012
{
  "addressLine2": "New Apartment Number",
  "landmark": "Updated Landmark"
}
// Only specified fields are updated
```

---

## 🎯 Integration with Order API

When creating an order using the cart-to-order API, use the address ID:

```javascript
POST /api/order/cart-to-order
{
  "userId": "507f1f77bcf86cd799439011",
  "shopId": "507f1f77bcf86cd799439012",
  "deliveryAddressId": "507f1f77bcf86cd799439012", // Address ID from address management
  "paymentMethod": "cod"
}
```

---

## 📊 Database Schema

The `CustomerAddress` model includes:
- `customerId` - Reference to User
- `addressType` - Enum: home, work, other
- `addressLine1` - Required
- `addressLine2` - Optional
- `landmark` - Optional
- `city` - Required
- `state` - Required
- `pincode` - Required
- `latitude` - Optional (for GPS)
- `longitude` - Optional (for GPS)
- `isDefault` - Boolean
- `createdAt` - Timestamp
- `updatedAt` - Timestamp
