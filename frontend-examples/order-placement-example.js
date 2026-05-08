/**
 * Complete Order Placement Example
 * This file demonstrates how to place orders using the convert-cart-to-order API
 */

// ============================================
// Configuration
// ============================================
const API_BASE_URL = 'http://localhost:8000/api'; // Your backend URL
let authToken = localStorage.getItem('authToken') || 'YOUR_JWT_TOKEN_HERE';

// ============================================
// 1. Convert Cart to Order
// ============================================
async function convertCartToOrder(userId, deliveryAddressId, paymentMethod) {
  try {
    console.log('Converting cart to order...');
    console.log('User ID:', userId);
    console.log('Delivery Address ID:', deliveryAddressId);
    console.log('Payment Method:', paymentMethod);

    const response = await fetch(`${API_BASE_URL}/order/convert-cart-to-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: userId,
        deliveryAddressId: deliveryAddressId,
        paymentMethod: paymentMethod
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create order');
    }

    if (data.success) {
      console.log('✅ Order created successfully!');
      console.log('Order Number:', data.data.orderNumber);
      console.log('Order ID:', data.data.order._id);
      console.log('Total Amount:', data.data.order.totalAmount);
      return data.data;
    } else {
      throw new Error(data.message || 'Order creation failed');
    }
  } catch (error) {
    console.error('❌ Error converting cart to order:', error);
    throw error;
  }
}

// ============================================
// 2. Get Order Details
// ============================================
async function getOrderDetails(orderId) {
  try {
    console.log('Fetching order details for:', orderId);

    const response = await fetch(`${API_BASE_URL}/order/getOrder/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Order details retrieved');
      return data.order;
    } else {
      throw new Error('Order not found');
    }
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    throw error;
  }
}

// ============================================
// 3. Complete Order Flow with COD
// ============================================
async function placeOrderWithCOD(userId, deliveryAddressId) {
  try {
    console.log('=== Placing Order with Cash on Delivery ===');

    // Convert cart to order
    const orderData = await convertCartToOrder(userId, deliveryAddressId, 'cod');

    // Show success message
    alert(`Order placed successfully!\nOrder Number: ${orderData.orderNumber}\nTotal: ₹${orderData.order.totalAmount}`);

    // Redirect to order success page
    window.location.href = `/order-success?orderId=${orderData.order._id}`;

    return orderData;
  } catch (error) {
    console.error('Order placement failed:', error);
    alert(`Failed to place order: ${error.message}`);
    throw error;
  }
}

// ============================================
// 4. Complete Order Flow with Online Payment
// ============================================
async function placeOrderWithOnlinePayment(userId, deliveryAddressId, cartTotal) {
  try {
    console.log('=== Placing Order with Online Payment ===');

    // Step 1: Create Razorpay payment order
    console.log('Step 1: Creating payment order...');
    const paymentResponse = await fetch(`${API_BASE_URL}/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ amount: cartTotal })
    });

    const paymentData = await paymentResponse.json();

    if (!paymentData.success) {
      throw new Error('Failed to create payment order');
    }

    console.log('✅ Payment order created:', paymentData.order.id);

    // Step 2: Open Razorpay checkout
    console.log('Step 2: Opening Razorpay checkout...');
    const options = {
      key: paymentData.key_id,
      amount: paymentData.order.amount,
      currency: paymentData.order.currency,
      order_id: paymentData.order.id,
      name: 'Your Store Name',
      description: 'Order Payment',
      image: 'https://your-logo-url.com/logo.png',
      
      // Payment success handler
      handler: async function(response) {
        console.log('Step 3: Payment successful, verifying...');
        
        try {
          // Step 3: Verify payment
          const verifyResponse = await fetch(`${API_BASE_URL}/payment/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            console.log('✅ Payment verified successfully');
            
            // Step 4: Convert cart to order
            console.log('Step 4: Creating order...');
            const orderData = await convertCartToOrder(userId, deliveryAddressId, 'online');
            
            // Show success message
            alert(`Payment successful!\nOrder Number: ${orderData.orderNumber}\nTotal: ₹${orderData.order.totalAmount}`);
            
            // Redirect to order success page
            window.location.href = `/order-success?orderId=${orderData.order._id}`;
          } else {
            throw new Error('Payment verification failed');
          }
        } catch (error) {
          console.error('❌ Error after payment:', error);
          alert('Payment successful but order creation failed. Please contact support.');
        }
      },
      
      // Prefill customer details (optional)
      prefill: {
        name: 'Customer Name',
        email: 'customer@example.com',
        contact: '9999999999'
      },
      
      theme: {
        color: '#3399cc'
      },
      
      // Modal close handler
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled by user');
          alert('Payment cancelled. Your cart items are still saved.');
        }
      }
    };

    const razorpay = new Razorpay(options);
    razorpay.open();

    // Handle payment failure
    razorpay.on('payment.failed', function(response) {
      console.error('❌ Payment failed:', response.error);
      alert(`Payment failed: ${response.error.description}`);
    });

  } catch (error) {
    console.error('Order placement failed:', error);
    alert(`Failed to place order: ${error.message}`);
    throw error;
  }
}

// ============================================
// 5. Unified Order Placement Function
// ============================================
async function placeOrder(userId, deliveryAddressId, paymentMethod, cartTotal) {
  try {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!deliveryAddressId) {
      throw new Error('Please select a delivery address');
    }
    if (!paymentMethod) {
      throw new Error('Please select a payment method');
    }

    // Route to appropriate payment flow
    if (paymentMethod === 'cod') {
      return await placeOrderWithCOD(userId, deliveryAddressId);
    } else if (paymentMethod === 'online') {
      if (!cartTotal || cartTotal <= 0) {
        throw new Error('Invalid cart total');
      }
      return await placeOrderWithOnlinePayment(userId, deliveryAddressId, cartTotal);
    } else if (paymentMethod === 'wallet') {
      // Implement wallet payment flow
      throw new Error('Wallet payment not yet implemented');
    } else {
      throw new Error('Invalid payment method');
    }
  } catch (error) {
    console.error('Order placement error:', error);
    alert(error.message);
    throw error;
  }
}

// ============================================
// 6. HTML Integration Example
// ============================================

/**
 * Setup checkout page
 */
function setupCheckoutPage() {
  const placeOrderBtn = document.getElementById('place-order-btn');
  
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async () => {
      // Disable button to prevent double submission
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing...';
      
      try {
        // Get form values
        const userId = document.getElementById('userId').value;
        const deliveryAddressId = document.querySelector('input[name="address"]:checked')?.value;
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
        const cartTotal = parseFloat(document.getElementById('cart-total').textContent);
        
        // Place order
        await placeOrder(userId, deliveryAddressId, paymentMethod, cartTotal);
        
      } catch (error) {
        console.error('Error:', error);
      } finally {
        // Re-enable button
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Place Order';
      }
    });
  }
}

// ============================================
// 7. React Component Example
// ============================================

/**
 * React Checkout Component
 */
const CheckoutComponent = () => {
  const [userId, setUserId] = React.useState('69e487abf5a353e6ac028d10');
  const [deliveryAddressId, setDeliveryAddressId] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('cod');
  const [cartTotal, setCartTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [addresses, setAddresses] = React.useState([]);

  // Load addresses on mount
  React.useEffect(() => {
    loadAddresses();
    loadCartTotal();
  }, []);

  const loadAddresses = async () => {
    // Fetch user addresses
    // setAddresses(fetchedAddresses);
  };

  const loadCartTotal = async () => {
    // Fetch cart total
    // setCartTotal(total);
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      await placeOrder(userId, deliveryAddressId, paymentMethod, cartTotal);
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <h2>Checkout</h2>
      
      {/* Address Selection */}
      <div className="section">
        <h3>Delivery Address</h3>
        <select 
          value={deliveryAddressId}
          onChange={(e) => setDeliveryAddressId(e.target.value)}
          required
        >
          <option value="">Select Address</option>
          {addresses.map(addr => (
            <option key={addr._id} value={addr._id}>
              {addr.addressLine1}, {addr.city}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Method */}
      <div className="section">
        <h3>Payment Method</h3>
        <label>
          <input 
            type="radio" 
            value="cod" 
            checked={paymentMethod === 'cod'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Cash on Delivery
        </label>
        <label>
          <input 
            type="radio" 
            value="online" 
            checked={paymentMethod === 'online'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Online Payment (Razorpay)
        </label>
      </div>

      {/* Order Summary */}
      <div className="section">
        <h3>Order Summary</h3>
        <p>Total Amount: ₹{cartTotal}</p>
      </div>

      {/* Place Order Button */}
      <button 
        onClick={handlePlaceOrder}
        disabled={loading || !deliveryAddressId}
        className="place-order-btn"
      >
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  );
};

// ============================================
// 8. Vue.js Component Example
// ============================================

/**
 * Vue Checkout Component
 */
const VueCheckoutComponent = {
  data() {
    return {
      userId: '69e487abf5a353e6ac028d10',
      deliveryAddressId: '',
      paymentMethod: 'cod',
      cartTotal: 0,
      loading: false,
      addresses: []
    };
  },
  methods: {
    async handlePlaceOrder() {
      this.loading = true;
      try {
        await placeOrder(
          this.userId,
          this.deliveryAddressId,
          this.paymentMethod,
          this.cartTotal
        );
      } catch (error) {
        console.error('Order failed:', error);
      } finally {
        this.loading = false;
      }
    }
  },
  template: `
    <div class="checkout-container">
      <h2>Checkout</h2>
      
      <div class="section">
        <h3>Delivery Address</h3>
        <select v-model="deliveryAddressId" required>
          <option value="">Select Address</option>
          <option v-for="addr in addresses" :key="addr._id" :value="addr._id">
            {{ addr.addressLine1 }}, {{ addr.city }}
          </option>
        </select>
      </div>

      <div class="section">
        <h3>Payment Method</h3>
        <label>
          <input type="radio" value="cod" v-model="paymentMethod" />
          Cash on Delivery
        </label>
        <label>
          <input type="radio" value="online" v-model="paymentMethod" />
          Online Payment
        </label>
      </div>

      <div class="section">
        <h3>Order Summary</h3>
        <p>Total: ₹{{ cartTotal }}</p>
      </div>

      <button 
        @click="handlePlaceOrder"
        :disabled="loading || !deliveryAddressId"
      >
        {{ loading ? 'Processing...' : 'Place Order' }}
      </button>
    </div>
  `
};

// ============================================
// 9. Error Handling Example
// ============================================

async function robustOrderPlacement(userId, deliveryAddressId, paymentMethod, cartTotal) {
  try {
    // Step 1: Validate authentication
    if (!authToken || authToken === 'YOUR_JWT_TOKEN_HERE') {
      throw new Error('Please login to place order');
    }

    // Step 2: Validate inputs
    if (!userId || !deliveryAddressId || !paymentMethod) {
      throw new Error('Please fill all required fields');
    }

    // Step 3: Check cart has items
    console.log('Checking cart...');
    // Add cart validation here

    // Step 4: Place order with retry logic
    let retries = 3;
    let orderData = null;

    while (retries > 0) {
      try {
        orderData = await placeOrder(userId, deliveryAddressId, paymentMethod, cartTotal);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return orderData;

  } catch (error) {
    // Handle specific errors
    if (error.message.includes('Cart is empty')) {
      alert('Your cart is empty. Please add items before placing order.');
      window.location.href = '/products';
    } else if (error.message.includes('Insufficient stock')) {
      alert('Some items are out of stock. Please update your cart.');
      window.location.href = '/cart';
    } else if (error.message.includes('login')) {
      alert('Please login to continue');
      window.location.href = '/login';
    } else if (error.message.includes('address')) {
      alert('Please select a delivery address');
    } else {
      alert(`Order failed: ${error.message}`);
    }
    
    throw error;
  }
}

// ============================================
// 10. Initialize on Page Load
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Order placement module loaded');
  
  // Setup checkout page if elements exist
  setupCheckoutPage();
  
  // Load auth token from localStorage
  authToken = localStorage.getItem('authToken') || authToken;
});

// ============================================
// Export for module usage
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    convertCartToOrder,
    getOrderDetails,
    placeOrderWithCOD,
    placeOrderWithOnlinePayment,
    placeOrder,
    robustOrderPlacement
  };
}
