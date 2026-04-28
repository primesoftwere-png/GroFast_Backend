// Example: Add Multiple Products to Cart API
// Endpoint: POST /api/cart/add-multiple-items

// Example 1: Add multiple products to cart
const addMultipleProductsToCart = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/cart/add-multiple-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
      },
      body: JSON.stringify({
        userId: "507f1f77bcf86cd799439011",
        products: [
          {
            productId: "507f191e810c19729de860ea",
            quantity: 2
          },
          {
            productId: "507f191e810c19729de860eb",
            quantity: 5
          },
          {
            productId: "507f191e810c19729de860ec",
            quantity: 1
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Products added successfully!');
      console.log('Message:', data.message);
      console.log('Total products in cart:', data.summary.totalProductsInCart);
      console.log('Products added:', data.summary.productsAdded);
      console.log('Products updated:', data.summary.productsUpdated);
      console.log('Cart data:', data.data);
    } else {
      console.error('❌ Error:', data.message);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
};

// Example 2: Using Axios
const addMultipleProductsWithAxios = async () => {
  const axios = require('axios');
  
  try {
    const response = await axios.post(
      'http://localhost:3000/api/cart/add-multiple-items',
      {
        userId: "507f1f77bcf86cd799439011",
        products: [
          { productId: "507f191e810c19729de860ea", quantity: 3 },
          { productId: "507f191e810c19729de860eb", quantity: 2 }
        ]
      },
      {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
        }
      }
    );

    console.log('✅ Success:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

// Example 3: React Component Example
const CartComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddMultipleToCart = async (productsToAdd) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');

      const response = await fetch('http://localhost:3000/api/cart/add-multiple-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userId,
          products: productsToAdd // Array of { productId, quantity }
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`${data.message}`);
        // Update cart UI or redirect
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to add products to cart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={() => handleAddMultipleToCart([
          { productId: "product1_id", quantity: 2 },
          { productId: "product2_id", quantity: 1 }
        ])}
        disabled={loading}
      >
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

// Example 4: Add products from a shopping list
const addShoppingListToCart = async (shoppingList) => {
  // shoppingList format: [{ id: "product_id", qty: 2 }, ...]
  
  const products = shoppingList.map(item => ({
    productId: item.id,
    quantity: item.qty
  }));

  const response = await fetch('http://localhost:3000/api/cart/add-multiple-items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      userId: localStorage.getItem('userId'),
      products: products
    })
  });

  return await response.json();
};

// Example 5: Error Handling
const addToCartWithErrorHandling = async (userId, products) => {
  try {
    const response = await fetch('http://localhost:3000/api/cart/add-multiple-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ userId, products })
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle different error types
      if (response.status === 400) {
        console.error('Validation error:', data.message);
      } else if (response.status === 404) {
        console.error('Products not found:', data.missingProductIds);
      } else if (response.status === 500) {
        console.error('Server error:', data.error);
      }
      return { success: false, error: data.message };
    }

    return { success: true, data: data };
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};

// Export functions
module.exports = {
  addMultipleProductsToCart,
  addMultipleProductsWithAxios,
  addShoppingListToCart,
  addToCartWithErrorHandling
};
