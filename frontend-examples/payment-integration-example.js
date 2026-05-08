/**
 * Complete Payment Integration Example
 * This file demonstrates how to integrate Razorpay payment using the /create-order API
 */

// ============================================
// Configuration
// ============================================
const API_BASE_URL = 'http://localhost:3000/api'; // Change to your backend URL
let authToken = 'YOUR_JWT_TOKEN_HERE'; // Get this from login/authentication

// ============================================
// 1. Create Payment Order
// ============================================
async function createPaymentOrder(amount) {
  try {
    console.log(`Creating payment order for ₹${amount}`);
    
    const response = await fetch(`${API_BASE_URL}/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ amount: amount })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create order');
    }

    if (data.success) {
      console.log('Order created successfully:', data.order);
      return {
        orderId: data.order.id,
        amount: data.order.amount,
        currency: data.order.currency,
        keyId: data.key_id
      };
    } else {
      throw new Error(data.error || 'Order creation failed');
    }
  } catch (error) {
    console.error('Error creating payment order:', error);
    throw error;
  }
}

// ============================================
// 2. Get Razorpay Key (Alternative method)
// ============================================
async function getRazorpayKey() {
  try {
    const response = await fetch(`${API_BASE_URL}/payment/get-key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (data.success) {
      return data.key;
    } else {
      throw new Error('Failed to get Razorpay key');
    }
  } catch (error) {
    console.error('Error getting Razorpay key:', error);
    throw error;
  }
}

// ============================================
// 3. Verify Payment
// ============================================
async function verifyPayment(paymentData) {
  try {
    console.log('Verifying payment...');
    
    const response = await fetch(`${API_BASE_URL}/payment/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Payment verified successfully!');
      return true;
    } else {
      console.error('❌ Payment verification failed');
      return false;
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

// ============================================
// 4. Initialize Razorpay Checkout
// ============================================
async function initiateRazorpayPayment(amount, userDetails = {}) {
  try {
    // Step 1: Create order on backend
    const orderData = await createPaymentOrder(amount);

    // Step 2: Configure Razorpay options
    const options = {
      key: orderData.keyId, // Razorpay Key ID
      amount: orderData.amount, // Amount in paise
      currency: orderData.currency,
      name: 'Your Company Name',
      description: 'Payment for your order',
      image: 'https://your-logo-url.com/logo.png', // Optional: Your company logo
      order_id: orderData.orderId,
      
      // Payment success handler
      handler: async function (response) {
        console.log('Payment successful:', response);
        
        // Verify payment on backend
        const isVerified = await verifyPayment(response);
        
        if (isVerified) {
          // Payment verified successfully
          alert('Payment successful! Your order is confirmed.');
          
          // Redirect to success page or update UI
          window.location.href = '/order-success';
        } else {
          // Verification failed
          alert('Payment verification failed. Please contact support.');
        }
      },
      
      // Prefill customer details
      prefill: {
        name: userDetails.name || 'Customer Name',
        email: userDetails.email || 'customer@example.com',
        contact: userDetails.phone || '9999999999'
      },
      
      // Additional notes
      notes: {
        address: userDetails.address || 'Customer Address'
      },
      
      // Theme customization
      theme: {
        color: '#3399cc' // Your brand color
      },
      
      // Modal options
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled by user');
          alert('Payment cancelled. Please try again.');
        }
      }
    };

    // Step 3: Open Razorpay checkout
    const razorpay = new Razorpay(options);
    razorpay.open();

    // Handle payment failure
    razorpay.on('payment.failed', function (response) {
      console.error('Payment failed:', response.error);
      alert(`Payment failed: ${response.error.description}`);
    });

  } catch (error) {
    console.error('Error initiating payment:', error);
    alert('Failed to initiate payment. Please try again.');
  }
}

// ============================================
// 5. Complete Example Usage
// ============================================

// Example 1: Simple payment button
function setupPaymentButton() {
  const payButton = document.getElementById('pay-button');
  
  if (payButton) {
    payButton.addEventListener('click', async () => {
      const amount = 500; // ₹500
      
      const userDetails = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        address: '123 Main Street, City'
      };
      
      await initiateRazorpayPayment(amount, userDetails);
    });
  }
}

// Example 2: Payment with dynamic amount
function setupDynamicPayment() {
  const checkoutButton = document.getElementById('checkout-button');
  
  if (checkoutButton) {
    checkoutButton.addEventListener('click', async () => {
      // Get amount from cart or input
      const amountInput = document.getElementById('amount');
      const amount = parseFloat(amountInput.value);
      
      if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }
      
      // Get user details from form
      const userDetails = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
      };
      
      await initiateRazorpayPayment(amount, userDetails);
    });
  }
}

// ============================================
// 6. React/Vue Component Example
// ============================================

/**
 * React Component Example
 */
const PaymentButton = ({ amount, userDetails, onSuccess, onFailure }) => {
  const handlePayment = async () => {
    try {
      const orderData = await createPaymentOrder(amount);
      
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Your Company',
        order_id: orderData.orderId,
        handler: async (response) => {
          const isVerified = await verifyPayment(response);
          if (isVerified) {
            onSuccess && onSuccess(response);
          } else {
            onFailure && onFailure('Verification failed');
          }
        },
        prefill: userDetails,
        theme: { color: '#3399cc' }
      };
      
      const razorpay = new Razorpay(options);
      razorpay.open();
    } catch (error) {
      onFailure && onFailure(error);
    }
  };
  
  return (
    <button onClick={handlePayment} className="pay-button">
      Pay ₹{amount}
    </button>
  );
};

// ============================================
// 7. HTML Example
// ============================================

/**
 * Add this to your HTML file:
 * 
 * <!DOCTYPE html>
 * <html>
 * <head>
 *   <title>Payment Integration</title>
 *   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 * </head>
 * <body>
 *   <h1>Complete Your Payment</h1>
 *   
 *   <div class="payment-form">
 *     <input type="text" id="name" placeholder="Your Name" value="John Doe" />
 *     <input type="email" id="email" placeholder="Email" value="john@example.com" />
 *     <input type="tel" id="phone" placeholder="Phone" value="9876543210" />
 *     <input type="number" id="amount" placeholder="Amount (₹)" value="500" />
 *     
 *     <button id="checkout-button">Pay Now</button>
 *   </div>
 *   
 *   <script src="payment-integration-example.js"></script>
 *   <script>
 *     // Set your auth token (get from login)
 *     authToken = localStorage.getItem('authToken');
 *     
 *     // Initialize payment functionality
 *     setupDynamicPayment();
 *   </script>
 * </body>
 * </html>
 */

// ============================================
// 8. Error Handling Example
// ============================================

async function robustPaymentFlow(amount, userDetails) {
  try {
    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }
    
    // Validate auth token
    if (!authToken) {
      throw new Error('User not authenticated. Please login first.');
    }
    
    // Create order with retry logic
    let orderData;
    let retries = 3;
    
    while (retries > 0) {
      try {
        orderData = await createPaymentOrder(amount);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Proceed with payment
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Your Company',
      order_id: orderData.orderId,
      handler: async (response) => {
        try {
          const isVerified = await verifyPayment(response);
          if (isVerified) {
            console.log('✅ Payment completed successfully');
            // Handle success
          } else {
            console.error('❌ Payment verification failed');
            // Handle verification failure
          }
        } catch (error) {
          console.error('Error in payment handler:', error);
        }
      },
      prefill: userDetails,
      theme: { color: '#3399cc' },
      modal: {
        ondismiss: () => {
          console.log('Payment modal closed');
        }
      }
    };
    
    const razorpay = new Razorpay(options);
    razorpay.open();
    
  } catch (error) {
    console.error('Payment flow error:', error);
    alert(`Payment failed: ${error.message}`);
  }
}

// ============================================
// 9. Export for module usage
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createPaymentOrder,
    getRazorpayKey,
    verifyPayment,
    initiateRazorpayPayment,
    robustPaymentFlow
  };
}

// ============================================
// 10. Initialize on page load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Payment integration loaded');
  
  // Setup payment buttons if they exist
  setupPaymentButton();
  setupDynamicPayment();
});
