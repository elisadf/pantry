import { FoodItemFrontmatter } from "../RecipeFileManager";
import * as crypto from "crypto";

export interface FatSecretFoodSearchItem {
    food_id: string;
    food_name: string;
    food_description: string;
}

interface ApiResponse {
    status: number;
    text: string;
    json: any;
}

export class FatSecretAPIService {
    private consumerKey: string;
    private consumerSecret: string;
    private baseUrl = "https://platform.fatsecret.com/rest/server.api";
    private requestUrlFn: any = null;

    constructor(consumerKey: string, consumerSecret: string, requestUrlFn?: any) {
        this.consumerKey = consumerKey;
        this.consumerSecret = consumerSecret;
        this.requestUrlFn = requestUrlFn || null;
    }

    private async makeRequest(url: string, method: string, headers: Record<string, string>, body?: string): Promise<ApiResponse> {
        if (this.requestUrlFn) {
            const response = await this.requestUrlFn({
                url,
                method: method as any,
                headers,
                body,
                throw: false
            });
            return {
                status: response.status,
                text: response.text,
                json: response.json
            };
        } else {
            const response = await fetch(url, {
                method,
                headers,
                body
            });
            
            if (response.status !== 200) {
                return {
                    status: response.status,
                    text: await response.text(),
                    json: null
                };
            }
            
            return {
                status: response.status,
                text: "",
                json: await response.json()
            };
        }
    }

    private generateNonce(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    private generateTimestamp(): string {
        return Math.floor(Date.now() / 1000).toString();
    }

    private percentEncode(str: string): string {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
            return "%" + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }

    private generateOAuthParams(httpMethod: string, requestUrl: string, apiParams: Record<string, string>): Record<string, string> {
        const oauthParams: Record<string, string> = {
            "oauth_consumer_key": this.consumerKey,
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": this.generateTimestamp(),
            "oauth_nonce": this.generateNonce(),
            "oauth_version": "1.0",
        };

        const allParams = { ...apiParams, ...oauthParams };
        
        // Sort parameters by name, then by value
        const sortedKeys = Object.keys(allParams).sort();
        const paramPairs = sortedKeys.map(key => `${this.percentEncode(key)}=${this.percentEncode(allParams[key])}`);
        const normalizedParams = paramPairs.join("&");

        const signatureBaseString = `${httpMethod.toUpperCase()}&${this.percentEncode(requestUrl)}&${this.percentEncode(normalizedParams)}`;

        const signingKey = `${this.percentEncode(this.consumerSecret)}&`;
        
        const signature = crypto.createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");

        return { ...allParams, oauth_signature: signature };
    }

    public async testConnection(): Promise<boolean> {
        try {
            const apiParams = {
                method: "foods.search",
                search_expression: "apple",
                format: "json",
                max_results: "1"
            };

            const signedParams = this.generateOAuthParams("POST", this.baseUrl, apiParams);
            
            const params = new URLSearchParams();
            for (const key in signedParams) {
                params.append(key, signedParams[key]);
            }

            const response = await this.makeRequest(
                this.baseUrl,
                "POST",
                {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                params.toString()
            );

            if (response.status !== 200) {
                throw new Error(`FatSecret connection failed: ${response.status} ${response.text}`);
            }

            return true;
        } catch (error) {
            console.error("FatSecret connection test failed:", error);
            throw error;
        }
    }

    async searchFoods(query: string): Promise<FatSecretFoodSearchItem[]> {
        const apiParams = {
            method: "foods.search",
            search_expression: query,
            format: "json",
            max_results: "20"
        };

        const signedParams = this.generateOAuthParams("POST", this.baseUrl, apiParams);
        
        const params = new URLSearchParams();
        for (const key in signedParams) {
            params.append(key, signedParams[key]);
        }

        const response = await this.makeRequest(
            this.baseUrl,
            "POST",
            {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            params.toString()
        );

        if (response.status !== 200) {
            throw new Error(`FatSecret search failed: ${response.status} ${response.text}`);
        }

        const data = response.json;
        
        if (!data.foods || !data.foods.food) {
            return [];
        }

        const foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
        return foods.map((f: any) => ({
            food_id: f.food_id,
            food_name: f.food_name,
            food_description: f.food_description
        }));
    }

    async getFood(foodId: string): Promise<FoodItemFrontmatter> {
        const apiParams = {
            method: "food.get.v2",
            food_id: foodId,
            format: "json"
        };

        const signedParams = this.generateOAuthParams("POST", this.baseUrl, apiParams);
        
        const params = new URLSearchParams();
        for (const key in signedParams) {
            params.append(key, signedParams[key]);
        }

        const response = await this.makeRequest(
            this.baseUrl,
            "POST",
            {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            params.toString()
        );

        if (response.status !== 200) {
            throw new Error(`FatSecret food get failed: ${response.status} ${response.text}`);
        }

        const data = response.json;
        
        if (!data.food) {
            throw new Error("Food not found");
        }

        const food = data.food;
        
        const servings = Array.isArray(food.servings.serving) ? food.servings.serving : [food.servings.serving];
        let selectedServing = servings.find((s: any) => s.metric_serving_amount === "100.000" && s.metric_serving_unit === "g");
        
        if (!selectedServing) {
            selectedServing = servings[0];
        }

        const fibre = parseFloat(selectedServing.fiber) || 0;
        const protein = parseFloat(selectedServing.protein) || 0;
        const carbs = parseFloat(selectedServing.carbohydrate) || 0;
        const fat = parseFloat(selectedServing.fat) || 0;
        const calories = parseFloat(selectedServing.calories) || 0;

        let markdown = `## Nutritional Information (per ${selectedServing.serving_description})\n\n`;
        markdown += `- **Calories**: ${calories} kcal\n`;
        markdown += `- **Protein**: ${protein} g\n`;
        markdown += `- **Carbs**: ${carbs} g\n`;
        markdown += `- **Fat**: ${fat} g\n`;
        markdown += `- **Fiber**: ${fibre} g\n\n`;
        markdown += `> Data sourced from FatSecret API.\n`;

        return {
            name: food.food_name,
            source: "fatsecret",
            category: "snack",
            calorie_estimate_kcal: calories,
            fat_estimate_g: fat,
            carbs_estimate_g: carbs,
            fibre_estimate_g: fibre,
            protein_estimate_g: protein,
            rating: 0,
            notes: `Serving size: ${selectedServing.serving_description}`,
            markdown_content: markdown
        };
    }
}
