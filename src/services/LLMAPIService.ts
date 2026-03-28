import { Notice } from "obsidian";
import { RecipeInput } from "../core/fileGenerators";

export class LLMAPIService {
    private apiKey: string;
    private endpoint: string;
    private model: string;

    constructor(apiKey: string, endpoint: string = "https://openrouter.ai/api/v1/chat/completions", model: string = "google/gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.model = model;
    }

    private getHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://github.com/obsidianmd/obsidian-api", // Required by OpenRouter for ranking
            "X-Title": "Obsidian Nutrition Plugin" // Optional OpenRouter header
        };
    }

    async parseRecipeFromURL(url: string): Promise<RecipeInput> {
        const response = await fetch(this.endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.model,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "user",
                        content: `Parse this recipe URL and extract the information I need: ${url}

You are a recipe parser. You will receive the text content of a recipe web page.
Extract the recipe and return ONLY a JSON object with these exact fields:

{
  "name": "Recipe title (string)",
  "protein": estimated grams of protein per serving (whole number),
  "carbs": estimated grams of carbohydrates per serving (whole number),
  "fat": estimated grams of fat per serving (whole number),
  "fibre": estimated grams of fibre per serving (whole number),
  "calories": estimated kilocalories per serving (whole number),
  "serving_size": estimated weight of one serving as "<number>g" (string),
  "source": "internet",
  "source_url": "the URL provided",
  "category": "breakfast | mains | sauce | snack | dessert",
  "rating": "your quality rating 1-10 based on nutritional balance (string)",
  "ingredients": "markdown list, each line starting with '- ' (string)",
  "instructions": "markdown numbered list, each line starting with '1. ' etc (string)",
  "notes": "Obsidian callout blocks for any nutritional warnings or tips (string or null)"
}

Rules:
- All nutritional values are PER SERVING, estimated from the ingredients. Round to whole numbers.
- serving_size MUST be in the format <number>g (e.g. "350g"). Estimate total recipe weight divided by number of servings.
- If the page states nutritional information, use those values instead of estimating.
- For notes, use Obsidian callout syntax: > [!warning] or > [!tip] followed by the detail. Only include notes for genuinely notable nutritional characteristics (high sodium, allergens, high protein, etc). Set to null if nothing notable.
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LLM API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.content?.[0]?.text; // handle openai and anthropic style
        return this.parseJSONResponse(content);
    }

    async parseRecipeFromText(ingredients: string, name?: string): Promise<RecipeInput> {
        const response = await fetch(this.endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.model,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "user",
                        content: `Analyze these recipe ingredients and return a JSON object with nutrition information:

${ingredients}

${name ? `Recipe name: ${name}` : ""}

You are a recipe parser. Extract the recipe and return ONLY a JSON object with these exact fields:

{
  "name": "${name || "Recipe title"}",
  "protein": estimated grams of protein per serving (whole number),
  "carbs": estimated grams of carbohydrates per serving (whole number),
  "fat": estimated grams of fat per serving (whole number),
  "fibre": estimated grams of fibre per serving (whole number),
  "calories": estimated kilocalories per serving (whole number),
  "serving_size": estimated weight of one serving as "<number>g" (string),
  "source": "manual",
  "category": "breakfast | mains | sauce | snack | dessert",
  "rating": "your quality rating 1-10 based on nutritional balance (string)",
  "ingredients": "markdown list, each line starting with '- ' (string)",
  "instructions": "markdown numbered list, each line starting with '1. ' etc (string)",
  "notes": "Obsidian callout blocks for any nutritional warnings or tips (string or null)"
}

Rules:
- All nutritional values are PER SERVING, estimated from the ingredients. Round to whole numbers.
- serving_size MUST be in the format <number>g (e.g. "350g"). Estimate total recipe weight divided by number of servings.
- For notes, use Obsidian callout syntax: > [!warning] or > [!tip] followed by the detail. Only include notes for genuinely notable nutritional characteristics (high sodium, allergens, high protein, etc). Set to null if nothing notable.
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LLM API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.content?.[0]?.text; // handle openai and anthropic style
        return this.parseJSONResponse(content);
    }

    async parseRecipeFromImage(base64Image: string): Promise<RecipeInput> {
        const response = await fetch(this.endpoint, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: this.model,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `This is a recipe screenshot. You are a recipe parser. Extract the recipe and return ONLY a JSON object with these exact fields:

{
  "name": "Recipe title (string)",
  "protein": estimated grams of protein per serving (whole number),
  "carbs": estimated grams of carbohydrates per serving (whole number),
  "fat": estimated grams of fat per serving (whole number),
  "fibre": estimated grams of fibre per serving (whole number),
  "calories": estimated kilocalories per serving (whole number),
  "serving_size": estimated weight of one serving as "<number>g" (string),
  "source": "screenshot",
  "category": "breakfast | mains | sauce | snack | dessert",
  "rating": "your quality rating 1-10 based on nutritional balance (string)",
  "ingredients": "markdown list, each line starting with '- ' (string)",
  "instructions": "markdown numbered list, each line starting with '1. ' etc (string)",
  "notes": "Obsidian callout blocks for any nutritional warnings or tips (string or null)"
}

Rules:
- All nutritional values are PER SERVING, estimated from the ingredients. Round to whole numbers.
- serving_size MUST be in the format <number>g (e.g. "350g"). Estimate total recipe weight divided by number of servings.
- If the image states nutritional information, use those values instead of estimating.
- For notes, use Obsidian callout syntax: > [!warning] or > [!tip] followed by the detail. Only include notes for genuinely notable nutritional characteristics. Set to null if nothing notable.
- Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LLM API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.content?.[0]?.text; // handle openai and anthropic style
        return this.parseJSONResponse(content);
    }

    private parseJSONResponse(content: string): RecipeInput {
        // Strip out markdown code blocks if the LLM still returns them despite instructions
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not parse JSON from response");
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Extract number from serving_size if the LLM didn't format it right, or default to 100g
            let servingSize = parsed.serving_size || "100g";
            if (typeof servingSize === 'number') {
                servingSize = `${servingSize}g`;
            } else if (!/^\d+g$/.test(servingSize)) {
                const match = servingSize.match(/(\d+)/);
                servingSize = match ? `${match[1]}g` : "100g";
            }
            
            // Fallback for markdown_content if using older LLM prompt versions
            let ingredients = parsed.ingredients || "";
            let instructions = parsed.instructions || "";
            
            if (parsed.markdown_content && !ingredients && !instructions) {
                // VERY rough attempt to split legacy markdown_content if returned by accident
                const parts = parsed.markdown_content.split('## Instructions');
                ingredients = parts[0] ? parts[0].replace('## Ingredients', '').trim() : parsed.markdown_content;
                instructions = parts[1] ? parts[1].trim() : "";
            }

            return {
                name: parsed.name || "Unnamed Recipe",
                source: parsed.source || "internet",
                source_url: parsed.source_url || undefined,
                category: parsed.category || undefined,
                calories: Number(parsed.calories || parsed.calorie_estimate_kcal || 0),
                fat: Number(parsed.fat || parsed.fat_estimate_g || 0),
                carbs: Number(parsed.carbs || parsed.carbs_estimate_g || 0),
                fibre: Number(parsed.fibre || parsed.fibre_estimate_g || 0),
                protein: Number(parsed.protein || parsed.protein_estimate_g || 0),
                serving_size: servingSize,
                rating: parsed.rating !== undefined ? String(parsed.rating) : undefined,
                ingredients: ingredients,
                instructions: instructions,
                notes: parsed.notes || undefined
            };
        } catch (e) {
            console.error("JSON parse error:", e, "Content:", content);
            throw new Error("Failed to parse recipe JSON");
        }
    }

    async fetchRecipeFromURL(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9"
                }
            });
            const html = await response.text();
            
            const textMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
            if (textMatch) {
                const jsonLd = JSON.parse(textMatch[1]);
                if (jsonLd["@graph"]) {
                    const recipe = jsonLd["@graph"].find((item: any) => item["@type"] === "Recipe");
                    if (recipe) {
                        return this.extractRecipeText(recipe);
                    }
                }
                if (jsonLd["@type"] === "Recipe") {
                    return this.extractRecipeText(jsonLd);
                }
            }
            
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (bodyMatch) {
                return bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            }
            
            return html;
        } catch (e) {
            throw new Error(`Failed to fetch recipe: ${e}`);
        }
    }

    private extractRecipeText(recipe: any): string {
        const parts: string[] = [];
        
        if (recipe.name) {
            parts.push(`Recipe: ${recipe.name}`);
        }
        
        if (recipe.description) {
            parts.push(`Description: ${recipe.description}`);
        }
        
        if (recipe.recipeIngredient) {
            parts.push("\nIngredients:\n" + recipe.recipeIngredient.join("\n"));
        }
        
        if (recipe.recipeInstructions) {
            const instructions = Array.isArray(recipe.recipeInstructions)
                ? recipe.recipeInstructions.map((i: any) => i.text || i).join("\n")
                : recipe.recipeInstructions;
            parts.push("\nInstructions:\n" + instructions);
        }
        
        return parts.join("\n\n");
    }
}
