import * as dotenv from 'dotenv';
import { FatSecretAPIService } from '../src/services/FatSecretAPIService';

// Load environment variables from .env file
dotenv.config();

const API_KEY = process.env.FATSECRET_API_KEY || process.env.FATSECRET_CLIENT_ID;
const SECRET = process.env.FATSECRET_SECRET || process.env.FATSECRET_CLIENT_SECRET;

if (!API_KEY || !SECRET) {
    console.error("❌ ERROR: FATSECRET_API_KEY and FATSECRET_SECRET are not set in your .env file.");
    process.exit(1);
}

// Instantiate the service
const fatSecretService = new FatSecretAPIService(API_KEY, SECRET);

async function runTests() {
    console.log(`🚀 Testing FatSecretAPIService`);
    console.log("==================================================================");

    try {
        // Test 1: Search Foods
        console.log("🔍 Test 1: Searching for 'Apple'");
        const searchResults = await fatSecretService.searchFoods("Apple");
        console.log("✅ Search successful:");
        console.log(`Found ${searchResults.length} results.`);
        if (searchResults.length > 0) {
            console.dir(searchResults.slice(0, 3), { depth: null, colors: true }); // Print top 3
        }
        console.log("------------------------------------------------------------------");

        // Test 2: Get Food details
        if (searchResults.length > 0) {
            const foodIdToTest = searchResults[0].food_id;
            console.log(`\n🍎 Test 2: Getting details for food_id: ${foodIdToTest} (${searchResults[0].food_name})`);
            
            const foodDetails = await fatSecretService.getFood(foodIdToTest);
            console.log("✅ Get Food successful:");
            console.dir(foodDetails, { depth: null, colors: true });
        } else {
             console.log("⏭️ Skipping Test 2 because no search results were found.");
        }
        
        console.log("------------------------------------------------------------------");
        console.log("🎉 All terminal tests completed successfully!");

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// Execute the tests
runTests();
