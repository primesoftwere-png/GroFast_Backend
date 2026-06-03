// controllers/AI/ai.controller.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Cart = require("../../models/Customer/Cart");
const Order = require("../../models/Customer/Order");
const Product = require("../../models/Product.model");

// Initialize Gemini AI
const initGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in environment variables");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ 
    model: "gemini-3.0-flash", // Using flash model for faster responses
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  });
};

/**
 * Suggest products based on user's cart and past orders
 */
exports.suggestProducts = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch User's Cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product', 'productName category');
    const cartItems = cart ? cart.items.map(item => ({
      name: item.product?.productName,
      category: item.product?.category
    })) : [];

    // 2. Fetch User's Previous Orders (last 5)
    const pastOrders = await Order.find({ customerId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('items');
    
    let orderItems = [];
    pastOrders.forEach(order => {
      order.items.forEach(item => {
        orderItems.push({
          name: item.productName,
          quantity: item.quantity
        });
      });
    });

    // 3. Fetch all active products (simplified for context)
    // To avoid passing too much data to AI, we pass category names or top products
    const availableProducts = await Product.find({ isActive: true })
      .select('productName category productPrice')
      .limit(100);

    const availableProductsSummary = availableProducts.map(p => ({
      id: p._id.toString(),
      name: p.productName,
      category: p.category
    }));

    // 4. Construct AI Prompt
    const prompt = `You are an intelligent shopping assistant for an e-commerce grocery app.
I will provide you with the user's current cart items, their past ordered items, and a list of available products.
Your task is to suggest 3 to 5 relevant products that the user might want to buy next.

USER'S CURRENT CART:
${cartItems.length > 0 ? JSON.stringify(cartItems) : "Cart is empty"}

USER'S PAST ORDERS (Recent):
${orderItems.length > 0 ? JSON.stringify(orderItems) : "No past orders"}

AVAILABLE PRODUCTS CATALOG:
${JSON.stringify(availableProductsSummary)}

Based on the cart and past orders, suggest exactly 3 to 5 products from the available catalog that are complementary or frequently bought together.
Return ONLY a valid JSON array containing the exact IDs of the suggested products. 
Example: ["60d5ecb8b392d7001f3e3a12", "60d5ecb8b392d7001f3e3a13"]`;

    // 5. Generate Recommendations
    const model = initGemini();
    const result = await model.generateContent(prompt);
    let aiResponse = result.response.text();
    
    // Clean up the response to extract just the JSON array
    aiResponse = aiResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    
    let suggestedProductIds = [];
    try {
      suggestedProductIds = JSON.parse(aiResponse);
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
      return res.status(500).json({ success: false, message: "Failed to generate valid suggestions" });
    }

    // 6. Fetch full details of suggested products
    if (!Array.isArray(suggestedProductIds) || suggestedProductIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const suggestions = await Product.find({ _id: { $in: suggestedProductIds } });

    return res.status(200).json({
      success: true,
      message: "AI Product suggestions generated successfully",
      data: suggestions
    });

  } catch (error) {
    console.error("AI Suggestion Error:", error);
    if (error.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ success: false, message: "AI configuration missing" });
    }
    return res.status(500).json({
      success: false,
      message: "Server error while generating suggestions",
      error: error.message
    });
  }
};
