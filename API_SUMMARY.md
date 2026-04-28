# Cart Summary API - Quick Reference

## 🎯 Purpose
Lightweight API endpoint designed specifically for home screen to display cart information with minimal data transfer.

## 📍 Endpoint
```
GET /api/cart/summary/:userId
```

## 🔐 Authentication
Required - Bearer Token in Authorization header

## 📥 Request

### URL Parameters
- `userId` (required): MongoDB ObjectId (24 character hex string)

### Example Request
```javascript
// Using fetch
const userId = "507f1f77bcf86cd799439011";
const token = "your_jwt_token_here";

fetch(`http://localhost:3000/api/cart/summary/${userId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));

// Using axios
axios.get(`/api/cart/summary/${userId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => console.log(response.data));
```

## 📤 Response

### Success Response (Cart with Items)
```json
{
  "success": true,
  "message": "Cart summary retrieved successfully",
  "data": {
    "products": [
      {
        "productId": "507f191e810c19729de860ea",
        "quantity": 2
      },
      {
        "productId": "507f191e810c19729de860eb",
        "quantity": 5
      }
    ],
    "totalItems": 7,
    "totalProducts": 2
  }
}
```

### Success Response (Empty Cart)
```json
{
  "success": true,
  "message": "Cart is empty",
  "data": {
    "products": [],
    "totalItems": 0,
    "totalProducts": 0
  }
}
```

### Error Response (Invalid User ID)
```json
{
  "success": false,
  "message": "Invalid user ID format"
}
```

## 📊 Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if request was successful |
| `message` | string | Human-readable message |
| `data.products` | array | Array of cart items with productId and quantity |
| `data.products[].productId` | string | MongoDB ObjectId of the product |
| `data.products[].quantity` | number | Quantity of this product in cart |
| `data.totalItems` | number | Sum of all quantities (total items count) |
| `data.totalProducts` | number | Number of unique products in cart |

## 💡 Use Cases

### 1. Display Cart Badge on Home Screen
```javascript
// Show cart item count in badge
const response = await getCartSummary(userId);
const cartBadge = document.getElementById('cart-badge');
cartBadge.textContent = response.data.totalItems;
```

### 2. Check if Product is in Cart
```javascript
const response = await getCartSummary(userId);
const productInCart = response.data.products.find(
  item => item.productId === currentProductId
);

if (productInCart) {
  console.log(`Product is in cart with quantity: ${productInCart.quantity}`);
}
```

### 3. Display Cart Summary
```javascript
const response = await getCartSummary(userId);
console.log(`You have ${response.data.totalProducts} products (${response.data.totalItems} items) in your cart`);
```

## ⚡ Performance Benefits

1. **Lightweight Response**: Only returns product IDs and quantities (no full product details)
2. **Fast Query**: Uses MongoDB lean() for better performance
3. **Minimal Data Transfer**: Perfect for mobile apps and slow connections
4. **No Population**: Doesn't populate product details, reducing database load

## 🔄 Related Endpoints

For full cart details with product information, use:
```
GET /api/cart/user/:userId
```

This returns complete product details including name, price, images, etc.

## 🧪 Testing

Run the test script:
```bash
node scripts/test-cart-summary-api.js
```

Make sure to update the test file with:
- Valid user ID from your database
- Valid JWT token

## 📝 Notes

- Returns empty cart structure if user has no cart
- User ID must be a valid MongoDB ObjectId (24 hex characters)
- Requires authentication token
- Does not create a cart if one doesn't exist
- `totalItems` = sum of all product quantities
- `totalProducts` = count of unique products

## 🎨 Frontend Integration Example

### React Component
```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function CartBadge({ userId, token }) {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const fetchCartSummary = async () => {
      try {
        const response = await axios.get(
          `/api/cart/summary/${userId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (response.data.success) {
          setCartCount(response.data.data.totalItems);
        }
      } catch (error) {
        console.error('Error fetching cart:', error);
      }
    };

    fetchCartSummary();
  }, [userId, token]);

  return (
    <div className="cart-icon">
      🛒
      {cartCount > 0 && (
        <span className="badge">{cartCount}</span>
      )}
    </div>
  );
}
```

### Vue Component
```vue
<template>
  <div class="cart-icon">
    🛒
    <span v-if="cartCount > 0" class="badge">{{ cartCount }}</span>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cartCount: 0
    }
  },
  async mounted() {
    try {
      const response = await this.$axios.get(
        `/api/cart/summary/${this.userId}`,
        {
          headers: { 'Authorization': `Bearer ${this.token}` }
        }
      );
      
      if (response.data.success) {
        this.cartCount = response.data.data.totalItems;
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  }
}
</script>
```

---

**Created:** 2024
**Endpoint:** `/api/cart/summary/:userId`
**Method:** GET
**Authentication:** Required
