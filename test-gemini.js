require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.log("No GEMINI_API_KEY in .env");
      return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const prompt = "Test prompt for Gemini";
    console.log("Testing generateContent with gemini-2.5-flash...");
    const result = await model.generateContent(prompt);
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Gemini Error:", err);
  }
}

testGemini();
