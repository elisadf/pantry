import { App, normalizePath } from "obsidian";

export interface NutritionData {
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  calories: number;
  serving_size: string;
  source: "fatsecret" | "manual" | "screenshot" | "internet";
  rating?: string;
}

export interface FoodItemInput extends NutritionData {
  name: string;
}

export interface RecipeInput extends NutritionData {
  name: string;
  source_url?: string;
  category?: string;
  ingredients: string;
  instructions: string;
  notes?: string;
}

export function validateServingSize(value: string): boolean {
  return value !== undefined && value !== null && value.trim().length > 0;
}

export function sanitiseFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

function formatNumber(num: number): number {
  return Number(num);
}

export function generateFoodItemFile(input: FoodItemInput): string {
  if (!validateServingSize(input.serving_size)) {
    throw new Error("Invalid serving size");
  }

  return `---
protein: ${formatNumber(input.protein)}
carbs: ${formatNumber(input.carbs)}
fat: ${formatNumber(input.fat)}
fibre: ${formatNumber(input.fibre)}
calories: ${formatNumber(input.calories)}
serving_size: ${input.serving_size}
source: ${input.source}
rating: ${input.rating !== undefined ? input.rating : ""}
---
`;
}

export function generateRecipeFile(input: RecipeInput): string {
  if (!validateServingSize(input.serving_size)) {
    throw new Error("Invalid serving size");
  }

  let yaml = `---
protein: ${formatNumber(input.protein)}
carbs: ${formatNumber(input.carbs)}
fat: ${formatNumber(input.fat)}
fibre: ${formatNumber(input.fibre)}
calories: ${formatNumber(input.calories)}
serving_size: ${input.serving_size}
source: ${input.source}
`;

  if (input.source_url !== undefined && input.source_url !== "") {
    yaml += `source_url: ${input.source_url}\n`;
  }
  if (input.category !== undefined && input.category !== "") {
    yaml += `category: ${input.category}\n`;
  }

  yaml += `rating: ${input.rating !== undefined ? input.rating : ""}
---
`;

  let body = `
## Ingredients
${input.ingredients}

## Instructions
${input.instructions}
`;

  if (input.notes && input.notes.trim().length > 0) {
    body += `
## Notes
${input.notes}
`;
  }

  return yaml + body;
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const parts = normalizedPath.split('/');
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (currentPath === '') continue; // Skip empty parts from normalizePath
    
    const folderExists = await app.vault.adapter.exists(currentPath);
    if (!folderExists) {
      await app.vault.createFolder(currentPath);
    }
  }
}

export async function createPantryFile<T extends FoodItemInput | RecipeInput>(
  input: T,
  app: App,
  folderPath: string
): Promise<string> {
  const isRecipe = 'ingredients' in input;
  const markdownContent = isRecipe 
    ? generateRecipeFile(input as RecipeInput)
    : generateFoodItemFile(input as FoodItemInput);

  const sanitizedName = sanitiseFileName(input.name);
  const normalizedFolderPath = normalizePath(folderPath);
  const filePath = normalizePath(`${normalizedFolderPath}/${sanitizedName}.md`);

  const existingFile = app.vault.getAbstractFileByPath(filePath);
  if (existingFile) {
    throw new Error(`A food item named '${input.name}' already exists.`);
  }

  await ensureFolderExists(app, normalizedFolderPath);
  await app.vault.create(filePath, markdownContent);
  
  return filePath;
}
