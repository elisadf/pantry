import { App, TFolder, Notice, TFile, TAbstractFile, normalizePath, parseYaml } from "obsidian";
import { sanitizeFilename } from "../utils/helpers";
import { PantryPluginSettings } from "../settings";

export interface FoodItemFrontmatter {
    name: string;
    source: "internet" | "thermomix" | "manual" | "fatsecret" | "vision";
    source_url?: string;
    category: "breakfast" | "mains" | "sauce" | "snack" | "dessert";
    calorie_estimate_kcal: number;
    fat_estimate_g: number;
    carbs_estimate_g: number;
    fibre_estimate_g: number;
    protein_estimate_g: number;
    serving_size?: number;
    default_serving_size?: number;
    rating?: number;
    notes?: string;
    markdown_content?: string; // Content string that will go to the body of the markdown file
}

export class RecipeFileManager {
    private app: App;
    private settings: PantryPluginSettings;

    constructor(app: App, settings: PantryPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    async ensureFolderStructure(): Promise<void> {
        const baseFolder = normalizePath(this.settings.recipeFolder);
        // Ensure the base recipe folder exists
        await this.ensureFolder(baseFolder);

        const categories = ["Breakfast", "Mains", "Sauce", "Snack", "Dessert"];
        
        for (const category of categories) {
            const folderPath = normalizePath(`${baseFolder}/${category.charAt(0).toUpperCase() + category.slice(1)}`);
            await this.ensureFolder(folderPath);
        }
    }

    private async ensureFolder(folderPath: string): Promise<void> {
        const path = normalizePath(folderPath);
        const parts = path.split('/');
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? normalizePath(`${currentPath}/${part}`) : part;
            const folder = this.app.vault.getAbstractFileByPath(currentPath);
            if (!folder) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    getRecipeFolder(): string {
        return this.settings.recipeFolder;
    }

    async getAllRecipes(): Promise<{ path: string; frontmatter: FoodItemFrontmatter }[]> {
        await this.ensureFolderStructure();
        
        const recipes: { path: string; frontmatter: FoodItemFrontmatter }[] = [];
        const folderPath = normalizePath(this.settings.recipeFolder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (!(folder instanceof TFolder)) {
            console.info(`[Pantry] Recipe Manager could not find the base configured folder: "${folderPath}" in the vault.`);
            return recipes;
        }

        console.info(`[Pantry] Scanning folder: "${folder.path}" and all its subfolders...`);
        await this.collectRecipesFromFolder(folder, recipes);
        return recipes;
    }

    async getRecipeCategories(): Promise<string[]> {
        const categories: string[] = [];
        const folderPath = normalizePath(this.settings.recipeFolder);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (folder instanceof TFolder) {
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    categories.push(child.name);
                }
            }
        }
        
        // Return dynamic folders, fallback to defaults if none found
        return categories.length > 0 
            ? categories 
            : ["Breakfast", "Mains", "Sauce", "Snack", "Dessert"];
    }

    private async collectRecipesFromFolder(folder: TFolder, recipes: { path: string; frontmatter: FoodItemFrontmatter }[]): Promise<void> {
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                console.info(`[Pantry] Scanning subfolder: "${child.path}"`);
                await this.collectRecipesFromFolder(child, recipes);
            } else if (child instanceof TFile && child.extension === "md") {
                const cache = this.app.metadataCache.getFileCache(child);
                let frontmatter = cache?.frontmatter as any;
                
                if (!frontmatter) {
                    const content = await this.app.vault.read(child);
                    frontmatter = this.parseFrontmatter(content);
                }

                if (frontmatter) {
                    recipes.push({
                        path: child.path,
                        frontmatter
                    });
                } else {
                    console.info(`[Pantry] Skipped file "${child.path}": Could not parse required frontmatter.`);
                }
            }
        }
    }

    parseFrontmatter(content: string): FoodItemFrontmatter | null {
        const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
        if (!match) return null;

        try {
            const yamlContent = match[1];
            const frontmatter = parseYaml(yamlContent);
            return frontmatter as FoodItemFrontmatter;
        } catch (e) {
            console.error("Failed to parse frontmatter via parseYaml:", e);
            return null;
        }
    }

    async createRecipeFile(
        name: string,
        category: string,
        frontmatter: FoodItemFrontmatter,
        ingredients?: string
    ): Promise<string> {
        const filename = `${sanitizeFilename(name)}.md`;
        const categoryFolderName = category.charAt(0).toUpperCase() + category.slice(1);
        const folderPath = normalizePath(`${this.settings.recipeFolder}/${categoryFolderName}`);
        
        // Ensure the target folder exists before creating the file
        await this.ensureFolder(folderPath);

        const filePath = normalizePath(`${folderPath}/${filename}`);

        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            throw new Error(`Recipe already exists: ${name}`);
        }

        const content = this.buildRecipeContent(frontmatter, ingredients);
        await this.app.vault.create(filePath, content);
        
        return filePath;
    }

    private buildRecipeContent(frontmatter: FoodItemFrontmatter, ingredients?: string): string {
        const lines: string[] = ["---"];
        
        lines.push(`name: ${frontmatter.name}`);
        lines.push(`source: ${frontmatter.source}`);
        
        if (frontmatter.source_url) {
            lines.push(`source_url: ${frontmatter.source_url}`);
        }
        
        lines.push(`category: ${frontmatter.category}`);
        lines.push(`calorie_estimate_kcal: ${frontmatter.calorie_estimate_kcal}`);
        lines.push(`fat_estimate_g: ${frontmatter.fat_estimate_g}`);
        lines.push(`carbs_estimate_g: ${frontmatter.carbs_estimate_g}`);
        lines.push(`fibre_estimate_g: ${frontmatter.fibre_estimate_g}`);
        lines.push(`protein_estimate_g: ${frontmatter.protein_estimate_g}`);
        
        if (frontmatter.serving_size !== undefined) {
            lines.push(`serving_size: ${frontmatter.serving_size}`);
        }
        
        if (frontmatter.default_serving_size !== undefined) {
            lines.push(`default_serving_size: ${frontmatter.default_serving_size}`);
        }

        if (frontmatter.rating) {
            lines.push(`rating: ${frontmatter.rating}`);
        }
        
        if (frontmatter.notes) {
            lines.push(`notes: ${frontmatter.notes}`);
        }
        
        lines.push("---\n");

        if (ingredients) {
            lines.push("## Ingredients\n");
            lines.push(ingredients);
            lines.push("");
        }

        if (frontmatter.markdown_content) {
            lines.push(frontmatter.markdown_content);
        }

        return lines.join("\n");
    }

    async getRecipeByPath(path: string): Promise<FoodItemFrontmatter | null> {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) return null;
            const content = await this.app.vault.read(file);
            return this.parseFrontmatter(content);
        } catch (e) {
            return null;
        }
    }
}
