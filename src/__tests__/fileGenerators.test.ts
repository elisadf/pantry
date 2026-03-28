// Mock Obsidian's normalizePath so it doesn't fail on import
jest.mock('obsidian', () => ({
  normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/\//g, '/')
}));

import {
  generateFoodItemFile,
  generateRecipeFile,
  validateServingSize,
  sanitiseFileName,
  FoodItemInput,
  RecipeInput
} from "../core/fileGenerators";

describe("File Generators", () => {
  describe("generateFoodItemFile", () => {
    it("generates valid YAML frontmatter for food items", () => {
      const input: FoodItemInput = {
        name: "Banana",
        protein: 1.09,
        carbs: 22.84,
        fat: 0.33,
        fibre: 2.60,
        calories: 89,
        serving_size: "100g",
        source: "fatsecret"
      };

      const result = generateFoodItemFile(input);

      expect(result).toBe(`---
protein: 1.09
carbs: 22.84
fat: 0.33
fibre: 2.6
calories: 89
serving_size: 100g
source: fatsecret
rating: 
---
`);
    });

    it("handles integer values from manual entry", () => {
      const input: FoodItemInput = {
        name: "Chicken Breast",
        protein: 23,
        carbs: 0,
        fat: 1,
        fibre: 0,
        calories: 165,
        serving_size: "100g",
        source: "manual"
      };

      const result = generateFoodItemFile(input);

      expect(result).toBe(`---
protein: 23
carbs: 0
fat: 1
fibre: 0
calories: 165
serving_size: 100g
source: manual
rating: 
---
`);
    });
  });

  describe("generateRecipeFile", () => {
    it("generates valid YAML frontmatter and markdown body for recipes", () => {
      const input: RecipeInput = {
        name: "Overnight Oats",
        protein: 15,
        carbs: 48,
        fat: 10,
        fibre: 8,
        calories: 380,
        serving_size: "350g",
        source: "internet",
        source_url: "https://example.com/recipe",
        category: "breakfast",
        rating: "8",
        ingredients: "- 40g rolled oats\n- 1 tsp chia seeds",
        instructions: "1. Combine oats and seeds in a jar.\n2. Pour in the milk and stir.",
        notes: "> [!tip] High protein\n> This recipe provides 15g protein per serving."
      };

      const result = generateRecipeFile(input);

      expect(result).toBe(`---
protein: 15
carbs: 48
fat: 10
fibre: 8
calories: 380
serving_size: 350g
source: internet
source_url: https://example.com/recipe
category: breakfast
rating: 8
---

## Ingredients
- 40g rolled oats
- 1 tsp chia seeds

## Instructions
1. Combine oats and seeds in a jar.
2. Pour in the milk and stir.

## Notes
> [!tip] High protein
> This recipe provides 15g protein per serving.
`);
    });

    it("omits source_url, category, and notes when not provided", () => {
      const input: RecipeInput = {
        name: "Simple Salad",
        protein: 5,
        carbs: 12,
        fat: 0,
        fibre: 3,
        calories: 70,
        serving_size: "200g",
        source: "manual",
        ingredients: "- 1 lettuce\n- 2 tomatoes",
        instructions: "1. Wash vegetables.\n2. Chop and mix."
      };

      const result = generateRecipeFile(input);

      expect(result).toBe(`---
protein: 5
carbs: 12
fat: 0
fibre: 3
calories: 70
serving_size: 200g
source: manual
rating: 
---

## Ingredients
- 1 lettuce
- 2 tomatoes

## Instructions
1. Wash vegetables.
2. Chop and mix.
`);
    });
  });

  describe("validateServingSize", () => {
    it("accepts valid formats", () => {
      expect(validateServingSize("100g")).toBe(true);
      expect(validateServingSize("100 g")).toBe(true);
      expect(validateServingSize("100grams")).toBe(true);
      expect(validateServingSize("1 banana")).toBe(true);
      expect(validateServingSize("1 cup")).toBe(true);
      expect(validateServingSize("200 ml")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(validateServingSize("")).toBe(false);
      expect(validateServingSize("   ")).toBe(false);
    });
  });

  describe("sanitiseFileName", () => {
    it("removes invalid characters", () => {
      expect(sanitiseFileName('My: Recipe*Name')).toBe('My RecipeName');
      expect(sanitiseFileName('Food/Item')).toBe('FoodItem');
      expect(sanitiseFileName('Test?Name')).toBe('TestName');
      expect(sanitiseFileName('Quote"Test')).toBe('QuoteTest');
      expect(sanitiseFileName('Angle<Bracket>')).toBe('AngleBracket');
      expect(sanitiseFileName('Pipe|Test')).toBe('PipeTest');
      expect(sanitiseFileName('Back\\\\Slash')).toBe('BackSlash');
    });

    it("trims whitespace", () => {
      expect(sanitiseFileName('  TestName  ')).toBe('TestName');
      expect(sanitiseFileName(' Test Name ')).toBe('Test Name');
    });

    it("preserves valid characters", () => {
      expect(sanitiseFileName('My Recipe 123')).toBe('My Recipe 123');
      expect(sanitiseFileName('Test-Name_With.Dots')).toBe('Test-Name_With.Dots');
    });
  });
});
