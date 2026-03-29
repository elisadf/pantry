import * as dotenv from 'dotenv';
import { LLMAPIService } from '../src/services/LLMAPIService';

// Load environment variables from .env file
dotenv.config();

const API_KEY = process.env.LLM_API_KEY;
const ENDPOINT = process.env.LLM_ENDPOINT;
const MODEL = process.env.LLM_MODEL;

if (!API_KEY) {
    console.error("❌ ERROR: LLM_API_KEY is not set in your .env file.");
    process.exit(1);
}

// Instantiate the service
const llmService = new LLMAPIService(
    API_KEY, 
    ENDPOINT || "https://openrouter.ai/api/v1/chat/completions", 
    MODEL || "google/gemini-2.5-flash"
);

async function runTests() {
    console.log(`🚀 Testing LLMAPIService using model: ${MODEL} via ${ENDPOINT}`);
    console.log("==================================================================");

    try {
        // Test 1: Parse from Text
        console.log("📝 Test 1: Parsing from Text");
        const sampleText = `
        2 cups spinach
        1 can chickpeas, rinsed
        1/2 red onion, diced
        2 tbsp olive oil
        1 tsp cumin
        Salt and pepper to taste
        `;
        const textResult = await llmService.parseRecipeFromText(sampleText, "Spinach & Chickpea Salad");
        console.log("✅ Text parsing successful:");
        console.dir(textResult, { depth: null, colors: true });
        console.log("------------------------------------------------------------------");

        // Test 2: Fetch and Parse from URL
        console.log("🌐 Test 2: Parsing from URL (Budget Bytes example)");
        const testUrl = "https://www.budgetbytes.com/easy-sesame-chicken/";
        console.log(`Fetching HTML from: ${testUrl} and sending to LLM...`);
        
        // Let's actually use the service method if we can, or simulate it. 
        // The service method expects the LLM to fetch it or we give it the URL.
        const urlResult = await llmService.parseRecipeFromURL(testUrl);
        
        console.log("✅ URL parsing successful:");
        console.dir(urlResult, { depth: null, colors: true });
        console.log("------------------------------------------------------------------");

        console.log("🎉 All terminal tests completed successfully!");

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// Execute the tests
runTests();