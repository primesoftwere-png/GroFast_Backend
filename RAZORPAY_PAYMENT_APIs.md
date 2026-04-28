# Razorpay Payment APIs

Complete list of all Razorpay and payment-related APIs with request payloads.

---

## Base URL
```
/api/payment
```

---

## 1. Create Payment Intent (Order)

**Endpoint:**
```
POST /api/payment/create-payment-intent
```

**Authentication:** Required (Bearer Token)

**Request Payload:**
```json
{
  "amount": 500
}
```

**Field Details:**
- `amount` - Required (number) - Amount in rupees (will be converted to paise automatically)

**Example:**
```json
{
  "amount": 1500
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "order_MNxyz123456789",
    "entity": "order",
    "amount": 150000,
    "amount_paid": 0,
    "amount_due": 150000,
    "currency": "INR",
    "receipt": "receipt_1714567890123",
    "status": "created",
    "attempts": 0,
    "created_at": 1714567890
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid amount. Must be a positive number in rupees."
}
```

---

## 2. Get Razorpay Key

**Endpoint:**
```
GET /api/payment/get-key
```

**Authentication:** Required (Bearer Token)

**Request Payload:** None (GET request)

**Success Response (200):**
```json
{
  "success": true,
  "key": "rzp_test_LObxjNba9Lx3cE"
}
```

**Usage:** This key is used in the frontend Razorpay checkout integration.

---

## 3. Verify Payment

**Endpoint:**
```
POST /api/payment/verify-payment
```

**Authentication:** Required (Bearer Token)

**Request Payload:**
```json
{
  "razorpay_order_id": "order_MNxyz123456789",
  "razorpay_payment_id": "pay_ABCxyz987654321",
  "razorpay_signature": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

**Field Details:**
- `razorpay_order_id` - Required (string) - Order ID from Razorpay
- `razorpay_payment_id` - Required (string) - Payment ID from Razorpay
- `razorpay_signature` - Required (string) - Signature from Razorpay for verification

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

---

## Payment Flow

### Step 1: Create Payment Order
```
POST /api/payment/create-payment-intent
Body: { "amount": 1500 }
Response: { "data": { "id": "order_xyz123" } }
```

### Step 2: Get Razorpay Key
```
GET /api/payment/get-key
Response: { "key": "rzp_test_..." }
```

### Step 3: Open Razorpay Checkout (Frontend)
Use the order ID and key to open Razorpay checkout on frontend.

### Step 4: Verify Payment (After Success)
```
POST /api/payment/verify-payment
Body: {
  "razorpay_order_id": "order_xyz123",
  "razorpay_payment_id": "pay_abc456",
  "razorpay_signature": "signature_string"
}
```

---

## Complete Example Flow

### 1. Create Order
```bash
POST http://localhost:8000/api/payment/create-payment-intent
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  "amount": 1500
}
```

### 2. Get Key
```bash
GET http://localhost:8000/api/payment/get-key
Headers: {
  "Authorization": "Bearer <token>"
}
```

### 3. Frontend Integration (Example)
```javascript
const options = {
  key: "rzp_test_LObxjNba9Lx3cE", // From get-key API
  amount: 150000, // Amount in paise
  currency: "INR",
  name: "GroFast",
  description: "Order Payment",
  order_id: "order_MNxyz123456789", // From create-payment-intent API
  handler: function (response) {
    // Send to verify-payment API
    verifyPayment({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature
    });
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

### 4. Verify Payment
```bash
POST http://localhost:8000/api/payment/verify-payment
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  "razorpay_order_id": "order_MNxyz123456789",
  "razorpay_payment_id": "pay_ABCxyz987654321",
  "razorpay_signature": "signature_from_razorpay"
}
```

---

## Important Notes

1. **Amount Conversion**: The API automatically converts rupees to paise (multiplies by 100)
2. **Authentication**: All endpoints require Bearer token authentication
3. **Signature Verification**: Payment verification uses HMAC SHA256 with Razorpay secret key
4. **Test Mode**: Currently using test keys (rzp_test_...)
5. **Currency**: Fixed to INR (Indian Rupees)

---

## Environment Variables Required

```env
RAZORPAY_KEY_ID=rzp_test_LObxjNba9Lx3cE
RAZORPAY_KEY_SECRET=1h49jrHMglwEoA8MVrqH4hN2
```

---

## Error Handling

### Invalid Amount
```json
{
  "success": false,
  "error": "Invalid amount. Must be a positive number in rupees."
}
```

### Payment Verification Failed
```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

### Server Error
```json
{
  "success": false,
  "error": "Failed to create payment order",
  "message": "Error details here"
}
```

---

## Testing

### Test Card Details (Razorpay Test Mode)
- **Card Number**: 4111 1111 1111 1111
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **Name**: Any name

### Test UPI
- **UPI ID**: success@razorpay

### Test Netbanking
- Select any bank and use credentials provided by Razorpay test mode

---

## Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/payment/create-payment-intent` | POST | Yes | Create Razorpay order |
| `/api/payment/get-key` | GET | Yes | Get Razorpay public key |
| `/api/payment/verify-payment` | POST | Yes | Verify payment signature |
