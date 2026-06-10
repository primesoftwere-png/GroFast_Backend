const express = require("express");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// For text-to-speech using google-tts-api (already installed)
const googleTTS = require("google-tts-api");

// Import Mongoose Models
const Product = require("./models/Product.model.js");
const Category = require("./models/ProductCategory.model.js");
const MongoConnection = require("./db/db.js");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// Configure Multer for Audio File Uploads
// ----------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `audio-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /wav|mp3|ogg|webm|m4a|flac/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed (wav, mp3, ogg, webm, m4a, flac)"));
    }
  },
});

// ----------------------
// 1. MongoDB Connection
// ----------------------
try {
  MongoConnection();
} catch (error) {
  console.error("❌ MongoDB connection error:", error);
}

// ----------------------
// 2. Gemini Setup
// ----------------------
if (!process.env.GEMINI_PI_KEY) {
  console.error("❌ ERROR: GEMINI_PI_KEY is missing in .env file");
  console.error("📝 Please add your Google AI API key to .env file:");
  console.error("   GEMINI_PI_KEY=your_api_key_here");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_PI_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
  },
});

// ----------------------
// Helper: Retry AI Request with Exponential Backoff
// ----------------------
async function generateWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return result.response.text();
    } catch (err) {
      console.error(`❌ AI Request Attempt ${attempt} failed:`, err.message);
      if (attempt === maxRetries) {
        throw new Error(`AI service unavailable after ${maxRetries} attempts: ${err.message}`);
      }
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Cache for query results
const queryCache = new Map();
const QUERY_CACHE_MAX_SIZE = 100;
const QUERY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

function getCachedQuery(key) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedQuery(key, data) {
  if (queryCache.size >= QUERY_CACHE_MAX_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }
  queryCache.set(key, { data, timestamp: Date.now() });
}

// ----------------------
// INTELLIGENT QUERY ANALYZER (MONGODB)
// ----------------------
async function analyzeQueryIntentMongo(prompt) {
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

  try {
    let aiResponse = await generateWithRetry(extractPrompt);
    aiResponse = aiResponse.replace(/\`\`\`(?:json)?/g, '').trim();
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error("AI Analysis failed, falling back to default:", error);
    return {
      intent: "search_products",
      searchParams: { keyword: prompt },
      limit: 10
    };
  }
}

// ----------------------
// EXECUTE MONGODB QUERY
// ----------------------
async function executeMongoQuery(intentData) {
  const { intent, searchParams, limit } = intentData;
  
  if (intent === "search_categories") {
    const filter = {};
    if (searchParams.keyword) {
      filter.categoryName = { $regex: searchParams.keyword, $options: 'i' };
    }
    return await Category.find(filter).limit(limit || 10).lean();
  }

  if (intent === "count") {
    return {
      productsCount: await Product.countDocuments(),
      categoriesCount: await Category.countDocuments()
    };
  }

  // search_products
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
  
  if (searchParams.categoryName) {
    const category = await Category.findOne({ categoryName: { $regex: searchParams.categoryName, $options: 'i' } });
    if (category) {
      query.productCategory = category._id;
    }
  }

  const products = await Product.find(query)
    .populate("productCategory", "categoryName")
    .limit(limit || 10)
    .lean();
    
  return products;
}

// ----------------------
// Parse AI Response
// ----------------------
function parseAIResponse(aiText) {
  try {
    const jsonMatch = aiText.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
    if (jsonMatch) return validateAndFixResponse(JSON.parse(jsonMatch[1].trim()));
    
    if (aiText.trim().startsWith("{") || aiText.trim().startsWith("[")) {
      return validateAndFixResponse(JSON.parse(aiText.trim()));
    }
  } catch (err) {}
  return { type: "text", response: aiText.trim() };
}

function validateAndFixResponse(parsed) {
  if (!parsed.type) parsed.type = "text";
  return parsed;
}

// ----------------------
// Generate Natural Response
// ----------------------
function formatNaturalResponse(parsedData) {
  return {
    data: parsedData,
    timestamp: new Date().toISOString(),
    message: parsedData.response || "Here's the information:",
  };
}

async function textToSpeech(text, lang = "en") {
  const maxLength = 200;
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) chunks.push(text.substring(i, i + maxLength));
  return await Promise.all(chunks.map(chunk => googleTTS.getAudioUrl(chunk, { lang, host: "https://translate.google.com" })));
}

// ----------------------
// API: AI Chat for Search (MongoDB)
// ----------------------
app.post("/chat", async (req, res) => {
  const startTime = Date.now();
  try {
    const userPrompt = req.body.prompt?.trim();
    if (!userPrompt) return res.status(400).json({ success: false, error: "Provide a prompt." });

    const cacheKey = userPrompt.toLowerCase();
    const cachedResult = getCachedQuery(cacheKey);
    if (cachedResult) return res.json({ ...cachedResult, fromCache: true });

    // Step 1: Analyze user intent and extract query parameters
    const intentData = await analyzeQueryIntentMongo(userPrompt);
    
    // Step 2: Fetch from MongoDB
    const queryResults = await executeMongoQuery(intentData);

    // Step 3: Format the response using AI
    const formatPrompt = `You are an AI assistant for a Grofast e-commerce store.
USER QUESTION: "${userPrompt}"
DATABASE RESULTS: ${JSON.stringify(queryResults)}

Return ONLY a valid JSON object matching this structure based on the query type:
For multiple results (table):
{
  "type": "table",
  "response": "Found some relevant products for you.",
  "data": [{"productName": "...", "productPrice": 100, "category": "..."}]
}

For conversational/single value:
{
  "type": "text",
  "response": "Conversational reply summarizing the findings."
}`;

    const aiResponse = await generateWithRetry(formatPrompt);
    const parsedResponse = parseAIResponse(aiResponse);
    const finalResponse = formatNaturalResponse(parsedResponse);

    const responsePayload = {
      success: true,
      ...finalResponse,
      performance: { time: `${Date.now() - startTime}ms` }
    };
    
    setCachedQuery(cacheKey, responsePayload);
    res.json(responsePayload);
    
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------
// API: Voice Chat
// ----------------------
app.post("/voice-chat", async (req, res) => {
  try {
    const { text, language = "en" } = req.body;
    if (!text) return res.status(400).json({ success: false, error: "Provide text" });

    const intentData = await analyzeQueryIntentMongo(text);
    const queryResults = await executeMongoQuery(intentData);

    const voicePrompt = `You are an AI voice assistant. Summarize these results in 1-2 natural spoken sentences.
RESULTS: ${JSON.stringify(queryResults).substring(0, 500)}
Return ONLY JSON: {"type": "voice", "response": "Spoken sentence here"}`;

    const aiResponse = await generateWithRetry(voicePrompt);
    const parsed = parseAIResponse(aiResponse);
    const spokenText = parsed.response || "I found some information.";
    
    const audioUrls = await textToSpeech(spokenText, language);
    
    res.json({
      success: true,
      response: spokenText,
      audio: { urls: audioUrls, text: spokenText, language },
      data: queryResults
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------
// API: Text to Speech
// ----------------------
app.post("/text-to-speech", async (req, res) => {
  try {
    const { text, language = "en" } = req.body;
    const urls = await textToSpeech(text, language);
    res.json({ success: true, audio: { urls, text, language } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🤖 AI Agent Server Running on port ${PORT} with MongoDB Integration`);
});
