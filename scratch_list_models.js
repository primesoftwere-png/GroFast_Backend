const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Key from .env
async function listModels() {
  try {
    const fetch = require('node-fetch'); // Or native fetch in newer node
    const response = await globalThis.fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log(JSON.stringify(data.models.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name), null, 2));
  } catch (e) {
    console.error(e);
  }
}
listModels();
