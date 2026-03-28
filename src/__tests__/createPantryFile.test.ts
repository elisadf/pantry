import { App } from "obsidian";
import { createPantryFile, FoodItemInput, RecipeInput } from "../core/fileGenerators";

// Mock Obsidian's normalizePath
jest.mock('obsidian', () => ({
  normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/\//g, '/')
}));

describe("createPantryFile", () => {
  let mockApp: any;
  let mockVault: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockAdapter = {
      exists: jest.fn().mockResolvedValue(true)
    };

    mockVault = {
      adapter: mockAdapter,
      createFolder: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      getAbstractFileByPath: jest.fn().mockReturnValue(null)
    };

    mockApp = {
      vault: mockVault
    } as unknown as App;
  });

  it("creates a food item file correctly", async () => {
    const input: FoodItemInput = {
      name: "Chicken Breast",
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fibre: 0,
      calories: 165,
      serving_size: "100g",
      source: "manual"
    };

    const resultPath = await createPantryFile(input, mockApp, "Pantry/Foods");

    expect(resultPath).toBe("Pantry/Foods/Chicken Breast.md");
    expect(mockVault.create).toHaveBeenCalledWith(
      "Pantry/Foods/Chicken Breast.md",
      expect.stringContaining("protein: 31")
    );
    expect(mockVault.create).toHaveBeenCalledWith(
      "Pantry/Foods/Chicken Breast.md",
      expect.stringContaining("source: manual")
    );
  });

  it("creates a recipe file correctly", async () => {
    const input: RecipeInput = {
      name: "Overnight Oats",
      protein: 15,
      carbs: 48,
      fat: 10,
      fibre: 8,
      calories: 380,
      serving_size: "350g",
      source: "internet",
      ingredients: "- oats\n- milk",
      instructions: "1. mix\n2. wait"
    };

    const resultPath = await createPantryFile(input, mockApp, "Pantry/Recipes");

    expect(resultPath).toBe("Pantry/Recipes/Overnight Oats.md");
    expect(mockVault.create).toHaveBeenCalledWith(
      "Pantry/Recipes/Overnight Oats.md",
      expect.stringContaining("## Ingredients")
    );
  });

  it("sanitizes the filename before creating", async () => {
    const input: FoodItemInput = {
      name: 'Chicken/Test:Breast?*',
      protein: 31, carbs: 0, fat: 3.6, fibre: 0, calories: 165,
      serving_size: "100g", source: "manual"
    };

    const resultPath = await createPantryFile(input, mockApp, "Pantry");

    expect(resultPath).toBe("Pantry/ChickenTestBreast.md");
  });

  it("throws an error if file already exists", async () => {
    mockVault.getAbstractFileByPath.mockReturnValue({ path: "Pantry/Banana.md" });

    const input: FoodItemInput = {
      name: "Banana",
      protein: 1.1, carbs: 22.8, fat: 0.3, fibre: 2.6, calories: 89,
      serving_size: "100g", source: "manual"
    };

    await expect(createPantryFile(input, mockApp, "Pantry"))
      .rejects
      .toThrow("A food item named 'Banana' already exists.");
  });

  it("creates folder hierarchy if folders do not exist", async () => {
    // Make adapter.exists return false for all checks to simulate empty vault
    mockAdapter.exists.mockResolvedValue(false);

    const input: FoodItemInput = {
      name: "Apple",
      protein: 0.3, carbs: 14, fat: 0.2, fibre: 2.4, calories: 52,
      serving_size: "100g", source: "manual"
    };

    await createPantryFile(input, mockApp, "Pantry/Fruits/Fresh");

    // It should check "Pantry", "Pantry/Fruits", "Pantry/Fruits/Fresh"
    expect(mockVault.createFolder).toHaveBeenCalledWith("Pantry");
    expect(mockVault.createFolder).toHaveBeenCalledWith("Pantry/Fruits");
    expect(mockVault.createFolder).toHaveBeenCalledWith("Pantry/Fruits/Fresh");
  });
});
