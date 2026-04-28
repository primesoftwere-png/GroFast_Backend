# User Registration API - Fixed & Perfect

## ✅ COMPLETELY FIXED - Ready to Use!

The registration API has been completely fixed to match the exact schema structure.

---

## 📍 Registration Endpoint

**POST** `http://localhost:8000/api/user/register`

### Minimal Request (Customer):

```json
{
  "fullname": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890"
}
```

### Required Fields:
- `fullname` - User's full name
- `email` - Valid email address
- `password` - Minimum 6 characters
- `phone` - 10-15 digits only

### Optional Fields:
- `role` - Default: "user" (Options: user, admin, deliveryBoy, superadmin)
- `roleDetails` - Role-specific information

---

## 📋 Complete Examples by Role

### 1. Register Customer (User)
```json
{
  "fullname": "Customer Name",
  "email": "customer@example.com",
  "password": "password123",
  "phone": "1234567890",
  "role": "user",
  "roleDetails": {
    "user": {
      "userAddress": "123 Main Street"
    }
  }
}
```
**Status**: Active immediately ✅  
**Can Login**: Yes

---

### 2. Register Shopkeeper (Admin)
```json
{
  "fullname": "Shop Owner",
  "email": "shop@example.com",
  "password": "password123",
  "phone": "9876543210",
  "role": "admin",
  "roleDetails": {
    "admin": {
      "shopName": "My Shop",
      "shopGST": "GST123456",
      "shopAddress": "123 Shop Street"
    }
  }
}
```
**Status**: Pending approval ⏳  
**Can Login**: No (needs superadmin approval)

---

### 3. Register Delivery Boy
```json
{
  "fullname": "Delivery Person",
  "email": "delivery@example.com",
  "password": "password123",
  "phone": "5555555555",
  "role": "deliveryBoy",
  "roleDetails": {
    "deliveryBoy": {
      "vehicleNumber": "ABC123",
      "drivingLicense": "DL123456",
      "deliveryBoyAddress": "456 Delivery Lane",
      "deliveryBoyPhone": "5555555555",
      "Coordinates": {
        "lat": 19.0760,
        "lng": 72.8777
      }
    }
  }
}
```
**Status**: Active but delivery inactive ⏳  
**Can Login**: No (needs admin to activate delivery status)

---

### 4. Register Superadmin
```json
{
  "fullname": "Super Admin",
  "email": "superadmin@example.com",
  "password": "password123",
  "phone": "9999999999",
  "role": "superadmin"
}
```
**Status**: Active immediately ✅  
**Can Login**: Yes

---

## ✅ Success Response (201)

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullname": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "user",
    "accountStatus": "active",
    "roleDetails": {
      "user": {
        "userAddress": ""
      }
    },
    "createdAt": "2026-04-26T10:30:00.000Z",
    "updatedAt": "2026-04-26T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## ❌ Error Responses

### Missing Required Fields
```json
{
  "success": false,
  "message": "All fields are required: fullname, email, password, phone"
}
```

### Invalid Email
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

### Invalid Phone
```json
{
  "success": false,
  "message": "Invalid phone number format (10-15 digits required)"
}
```

### Password Too Short
```json
{
  "success": false,
  "message": "Password must be at least 6 characters"
}
```

### Duplicate Email
```json
{
  "success": false,
  "message": "User already exists with this email"
}
```

### Duplicate Phone
```json
{
  "success": false,
  "message": "User already exists with this phone number"
}
```

### Invalid Role
```json
{
  "success": false,
  "message": "Invalid role. Allowed roles: user, admin, deliveryBoy, superadmin"
}
```

---

## 🧪 Quick Test Commands

### Test 1: Simple Customer Registration
```bash
curl -X POST http://localhost:8000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "phone": "1234567890"
  }'
```

### Test 2: Shopkeeper Registration
```bash
curl -X POST http://localhost:8000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "Shop Owner",
    "email": "shop@example.com",
    "password": "shop123",
    "phone": "9876543210",
    "role": "admin",
    "roleDetails": {
      "admin": {
        "shopName": "Test Shop",
        "shopGST": "GST123",
        "shopAddress": "123 Street"
      }
    }
  }'
```

---

## 🔧 What Was Fixed

### Issue 1: roleDetails Structure ❌ → ✅
**Before**: Setting `roleDetails.shopkeeper` directly  
**After**: Properly structured with nested objects matching schema

### Issue 2: Password Hashing ❌ → ✅
**Before**: Inconsistent hashing  
**After**: Always hash before saving

### Issue 3: Role-Specific Setup ❌ → ✅
**Before**: Incomplete roleDetails initialization  
**After**: Complete initialization for each role type

### Issue 4: Validation Order ❌ → ✅
**Before**: Checked duplicates before validation  
**After**: Validate fields first, then check duplicates

---

## 🎯 Key Features

✅ **Proper Schema Matching** - roleDetails structure matches model exactly  
✅ **Password Security** - Bcrypt hashing with salt  
✅ **Email Normalization** - Lowercase and trimmed  
✅ **Phone Validation** - 10-15 digits only  
✅ **Duplicate Prevention** - Checks email and phone  
✅ **JWT Token** - Secure authentication token  
✅ **HTTP-Only Cookie** - Secure cookie storage  
✅ **Role-Based Status** - Different statuses per role  
✅ **Complete Error Handling** - Clear error messages  

---

## 🚀 100% Ready to Use!

The API is now completely fixed and tested. All schema fields match perfectly, and all validations work correctly.
