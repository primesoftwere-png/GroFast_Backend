// controllers/AI/ai.controller.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Cart = require("../../models/Customer/Cart");
const Order = require("../../models/Customer/Order");
const Product = require("../../models/Product.model");
const Category = require("../../models/ProductCategory.model");

// Initialize Gemini AI
const initGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in environment variables");
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", // Using latest available flash model
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

/**
 * AI Powered Search for Products
 */
exports.searchProducts = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    if (!prompt) return res.status(400).json({ success: false, message: "Provide a search prompt." });

    const extractPrompt = `You are an AI assistant helping to query an e-commerce database (MongoDB).
Analyze the user's prompt and extract search parameters as a JSON object.

USER PROMPT: "${prompt}"

Return ONLY a valid JSON object matching this structure:
{
  "intent": "search_products" | "search_categories" | "count" | "general",
  "searchParams": {
    "keyword": "string to search in product/category name",
    "minPrice": number or null,
    "maxPrice": number or null,
    "categoryName": "string category name if mentioned"
  },
  "limit": number (default 10)
}`;

    const model = initGemini();
    const result = await model.generateContent(extractPrompt);
    let aiResponse = result.response.text();
    aiResponse = aiResponse.replace(/\`\`\`(?:json)?/g, '').trim();
    
    let intentData;
    try {
      intentData = JSON.parse(aiResponse);
    } catch (e) {
      intentData = {
        intent: "search_products",
        searchParams: { keyword: prompt },
        limit: 10
      };
    }

    const { intent, searchParams, limit } = intentData;
    let products = [];

    const query = {};
    if (searchParams.keyword) {
      query.$or = [
        { productName: { $regex: searchParams.keyword, $options: 'i' } },
        { productDescription: { $regex: searchParams.keyword, $options: 'i' } },
        { productCode: { $regex: searchParams.keyword, $options: 'i' } }
      ];
    }
    
    if (searchParams.minPrice || searchParams.maxPrice) {
      query.productPrice = {};
      if (searchParams.minPrice) query.productPrice.$gte = searchParams.minPrice;
      if (searchParams.maxPrice) query.productPrice.$lte = searchParams.maxPrice;
    }
    
    if (searchParams.categoryName && Category) {
      const category = await Category.findOne({ categoryName: { $regex: searchParams.categoryName, $options: 'i' } });
      if (category) {
        query.productCategory = category._id;
      }
    }

    products = await Product.find(query)
      .populate("productCategory", "categoryName")
      .limit(limit || 10)
      .lean();

    return res.status(200).json({
      success: true,
      data: { data: products }
    });

  } catch (error) {
    console.error("AI Search Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while searching",
      error: error.message
    });
  }
};

/**
 * AI Powered Chat for Products
 */
exports.chatProducts = async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim();
    if (!prompt) return res.status(400).json({ success: false, message: "Provide a chat prompt.", data: { productsFound: false, products: [] } });

    // Step 1: Extract intent (with fallback if Gemini fails)
    let intentData;
    try {
      const extractPrompt = `You are an AI assistant helping to query an e-commerce database (MongoDB).
Analyze the user's prompt and extract search parameters as a JSON object.

USER PROMPT: "${prompt}"

Return ONLY a valid JSON object matching this structure:
{
  "intent": "search_products" | "search_categories" | "count" | "general",
  "searchParams": {
    "keyword": "string to search in product/category name",
    "minPrice": number or null,
    "maxPrice": number or null,
    "categoryName": "string category name if mentioned"
  },
  "limit": number (default 10)
}`;

      const model = initGemini();
      const result = await model.generateContent(extractPrompt);
      let aiResponse = result.response.text();
      aiResponse = aiResponse.replace(/\`\`\`(?:json)?/g, '').trim();
      intentData = JSON.parse(aiResponse);
    } catch (e) {
      console.warn("Gemini Intent Extraction Error, falling back to basic search:", e.message);
      
      const lowerPrompt = prompt.toLowerCase();
      let keywordToSearch = prompt;
      
      // If the user is just asking to see all products, don't use the whole sentence as a keyword
      if (lowerPrompt.match(/all\s+(are\s+)?products?/) || lowerPrompt.match(/(show|list)\s+products?/)) {
        keywordToSearch = "";
      } else {
        // Strip out common conversational filler words from the search keyword
        // Using a non-capturing group with + allows it to strip combinations like "please findout"
        keywordToSearch = lowerPrompt
          .replace(/^(?:please|can you|could you|i want to|buy|get|show me|find out|findout|find|search for|looking for|some|\s)+/g, '')
          .trim();
      }

      intentData = {
        intent: "search_products",
        searchParams: { keyword: keywordToSearch },
        limit: 10
      };
    }

    const { intent, searchParams, limit } = intentData;
    let products = [];

    try {
      const query = {};
      if (searchParams.keyword) {
        query.$or = [
          { productName: { $regex: searchParams.keyword, $options: 'i' } },
          { productDescription: { $regex: searchParams.keyword, $options: 'i' } },
          { productCode: { $regex: searchParams.keyword, $options: 'i' } }
        ];
      }
      
      if (searchParams.minPrice || searchParams.maxPrice) {
        query.productPrice = {};
        if (searchParams.minPrice) query.productPrice.$gte = searchParams.minPrice;
        if (searchParams.maxPrice) query.productPrice.$lte = searchParams.maxPrice;
      }
      
      if (searchParams.categoryName && Category) {
        const category = await Category.findOne({ categoryName: { $regex: searchParams.categoryName, $options: 'i' } });
        if (category) {
          query.productCategory = category._id;
        }
      }

      products = await Product.find(query)
        .populate("productCategory", "categoryName")
        .limit(limit || 10)
        .lean();
    } catch (dbError) {
       console.error("DB Error:", dbError);
       return res.status(500).json({ success: false, message: "Database error while fetching products.", data: { productsFound: false, products: [] }, error: dbError.message });
    }

    // Step 2: Generate chat message (with fallback if Gemini fails)
    let chatMessage = "";
    let aiChatError = null;
    const productsFound = products.length > 0;

    try {
      const model = initGemini();
      const chatPrompt = `You are a friendly and helpful grocery store assistant.
The user asked: "${prompt}"
We searched the database and found these products: ${JSON.stringify(products.map(p => ({ name: p.productName, price: p.productPrice })))}

Write a short, engaging conversational response answering the user. Be friendly, like a real person helping them in a store. Keep it concise. Do not use formatting like markdown that cannot be displayed in simple chat UI. If no products are found, apologize politely and suggest they try something else.`;
      
      const chatResult = await model.generateContent(chatPrompt);
      chatMessage = chatResult.response.text().trim();
    } catch (e) {
      console.warn("Gemini Chat Generation Error, falling back to static message:", e.message);
      aiChatError = e.message;
      if (productsFound) {
        chatMessage = `Here are some products I found for "${prompt}". Let me know if you need anything else!`;
      } else {
        const lowerPrompt = prompt.toLowerCase().trim();
        if (lowerPrompt.match(/^(hi|hello|hey|hii|hola|greetings)/)) {
          chatMessage = "Hello! I'm your GroFast assistant. How can I help you find groceries today?";
        } else if (lowerPrompt.match(/^(how are you|how do you do)/)) {
          chatMessage = "I'm just a bot, but I'm doing great! How can I help you shop today?";
        } else if (lowerPrompt.match(/^(thank you|thanks|thx)/)) {
          chatMessage = "You're very welcome! Let me know if you need anything else.";
        } else if (lowerPrompt.match(/^(bye|goodbye|see ya)/)) {
          chatMessage = "Goodbye! Have a great day and happy shopping!";
        } else {
          chatMessage = `I'm sorry, I couldn't find any products matching "${prompt}" at the moment. Would you like to search for something else?`;
        }
      }
    }

    const responsePayload = {
      success: true,
      message: chatMessage,
      data: {
        productsFound: productsFound,
        products: products
      }
    };

    if (aiChatError) {
      console.warn("AI chat generation failed. Using fallback message.", aiChatError);
      // We don't send warning to the frontend payload to avoid displaying it to the user
      // responsePayload.warning = "AI chat generation failed. Using fallback message.";
      responsePayload.errorDetails = aiChatError;
    }

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error("Unexpected Error in chatProducts:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing your request.",
      data: { productsFound: false, products: [] },
      error: error.message
    });
  }
};
