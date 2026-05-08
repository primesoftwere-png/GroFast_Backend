/**
 * Clear Mongoose Model Cache
 * This script helps clear Mongoose's model cache
 * 
 * Usage: Just restart your server - this is informational
 */

console.log(`
╔════════════════════════════════════════════════════════════╗
║         MONGOOSE MODEL CACHE CLEARING GUIDE                ║
╚════════════════════════════════════════════════════════════╝

The "Schema hasn't been registered for model 'Customer'" error
happens because Mongoose caches model schemas.

SOLUTION: Complete Server Restart

Step 1: COMPLETELY STOP the server
   - Press Ctrl+C in terminal
   - Wait for "Server stopped" or process to end
   - Make sure NO node process is running

Step 2: (Optional) Clear Node Cache
   If restart doesn't work, clear the cache:
   
   Windows:
   rd /s /q node_modules
   del package-lock.json
   npm install

   Mac/Linux:
   rm -rf node_modules package-lock.json
   npm install

Step 3: START the server fresh
   node index.js

Step 4: Verify models loaded correctly
   Look for these messages:
   ✅ Order router loaded
   ✅ Order routes registered
   ✅ MongoDB connected successfully
   ✅ Server is running on port 8000

═══════════════════════════════════════════════════════════

WHAT WE FIXED:

1. ✅ Changed all ref: 'Customer' to ref: 'User' in:
   - models/Customer/Order.js
   - models/Customer/CustomerAddress.js
   - models/Customer/CouponUsage.js
   - models/Customer/Wishlist.js
   - models/Customer/DeliveryReview.js
   - models/Customer/ShopReview.js

2. ✅ Updated populate to avoid nested schema errors

3. ✅ Added debug logging

═══════════════════════════════════════════════════════════

IMPORTANT: The changes won't take effect until you:
1. COMPLETELY stop the server
2. Start it again fresh

Just restarting with nodemon or similar may not clear the cache!

═══════════════════════════════════════════════════════════

After restart, test with:

curl -X POST http://localhost:8000/api/order/convert-cart-to-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "userId": "69e487abf5a353e6ac028d10",
    "deliveryAddressId": "69f38f025f0fd0d92f522fd8",
    "paymentMethod": "cod"
  }'

Expected: 201 Created (Success!)

═══════════════════════════════════════════════════════════
`);
