import { App, MarkdownView, Notice, TFile } from "obsidian";
import { RecipeFileManager, FoodItemFrontmatter } from "./RecipeFileManager";
import { PantryPluginSettings } from "../settings";
import { TrackerCardRenderer } from "./TrackerCardRenderer";
import { TrackerTableRenderer, RecipeDetail } from "./TrackerTableRenderer";
import { WeeklyTrackerRenderer } from "./WeeklyTrackerRenderer";
import { RecipeSearchModal } from "../modals/RecipeSearchModal";
import { ServingSizeModal } from "../modals/ServingSizeModal";
import { getWeekStart, getWeekEnd, isDateInWeek, formatWeekRange, getDateFromWeek } from "../utils/helpers";
import { calculateMacros } from "../calculators/macroCalculators";

export interface TrackerEntry {
    name: string;
    servingSize?: number;
    meal?: string;
}

export interface TrackerData {
    date: string;
    entries: TrackerEntry[];
    originalId: string; // The literal ID value used in the block, before evaluation
}

export interface MacroAggregate {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
}

export interface DailyAggregate {
    date: string;
    aggregate: MacroAggregate;
    trackerBlocks: string[];
}

export interface WeeklyData {
    weekRange: string;
    weekStart: Date;
    weekEnd: Date;
    aggregate: MacroAggregate;
    dailyBreakdown: DailyAggregate[];
    targets: MacroAggregate;
}

export class TrackerProcessor {
    private app: App;
    private recipeManager: RecipeFileManager;
    private settings: PantryPluginSettings;
    private cardRenderer: TrackerCardRenderer;
    private tableRenderer: TrackerTableRenderer;
    private weeklyRenderer: WeeklyTrackerRenderer;

    constructor(app: App, recipeManager: RecipeFileManager, settings: PantryPluginSettings) {
        this.app = app;
        this.recipeManager = recipeManager;
        this.settings = settings;
        this.cardRenderer = new TrackerCardRenderer();
        this.tableRenderer = new TrackerTableRenderer();
        this.weeklyRenderer = new WeeklyTrackerRenderer();
    }

    /**
     * Helper to get today's date in the user's preferred daily note format
     * Defaults to YYYY-MM-DD if daily notes plugin is disabled or format not found
     */
    private getTodayDateString(): string {
        try {
            // @ts-ignore - Accessing internal plugins
            const dailyNotesPlugin = this.app.internalPlugins?.plugins?.['daily-notes']?.instance;
            const format = dailyNotesPlugin?.options?.format || 'YYYY-MM-DD';
            
            // @ts-ignore - moment is globally available in Obsidian
            if (window.moment) {
                // @ts-ignore
                return window.moment().format(format);
            }
        } catch (e) {
            console.warn("Failed to get daily note format, falling back to YYYY-MM-DD");
        }

        // Fallback
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Parses the raw text block into structured tracker data
     */
    parseBlock(source: string): TrackerData | null {
        console.info("[Pantry] Parsing block source:\n", source);
        const lines = source.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        let date = '';
        let originalId = '';
        const entries: TrackerEntry[] = [];
        let currentMeal = 'Uncategorized';

        for (const line of lines) {
            // Parse Date
            if (line.toLowerCase().startsWith('id:')) {
                const dateStr = line.substring(3).trim();
                originalId = dateStr;
                if (dateStr.toLowerCase() === 'today' || dateStr === '') {
                    date = this.getTodayDateString();
                    console.info(`[Pantry] Parsed 'today' date string into: ${date}`);
                } else if (dateStr.toLowerCase() === 'week') {
                    date = 'week';
                    console.info(`[Pantry] Parsed 'week' date string`);
                } else if (getDateFromWeek(dateStr)) {
                    date = dateStr;
                    console.info(`[Pantry] Parsed specific week string: ${date}`);
                } else {
                    date = dateStr;
                    console.info(`[Pantry] Parsed explicitly provided date string: ${date}`);
                }
                continue;
            }

            // Parse Meal Header
            if (line.startsWith('#')) {
                currentMeal = line.replace(/^#+\s*/, '').trim();
                continue;
            }

            // For MVP, the whole line is just the recipe name (we now support serving sizes)
            const { name, servingSize } = this.parseEntryNameAndServingSize(line);
            entries.push({
                name,
                servingSize,
                meal: currentMeal
            });
        }

        if (!date) {
            console.info("[Pantry] Failed to parse block: Missing 'id:' date field.");
            return null;
        }

        console.info("[Pantry] Extracted entries:", entries);
        return { date, entries, originalId };
    }

    /**
     * Finds a recipe by its name 
     */
    async findRecipeByName(name: string): Promise<FoodItemFrontmatter | null> {
        if (!name) return null;
        
        console.info(`[Pantry] Searching for recipe matching name: "${name}"`);
        console.info(`[Pantry] Configured base recipe folder for search is: "${this.settings.recipeFolder}" and all its subfolders.`);
        
        const allRecipes = await this.recipeManager.getAllRecipes();
        
        console.info(`[Pantry] Vault returned ${allRecipes.length} total recipes from the configured folder.`);

        const availableNames: string[] = [];

        const found = allRecipes.find(r => {
            if (!r.frontmatter) return false;

            // Determine the name to check against:
            // 1. Try frontmatter.name
            // 2. Fallback to extracting the file name from the path (e.g., "Nutrition/Recipe Name.md" -> "Recipe Name")
            let recipeName = r.frontmatter.name;
            if (!recipeName || typeof recipeName !== 'string') {
                // Extract filename without extension
                const parts = r.path.split('/');
                const filename = parts[parts.length - 1];
                recipeName = filename.replace(/\.md$/i, '');
            }

            availableNames.push(recipeName);
            return recipeName.toLowerCase() === name.toLowerCase();
        });
        
        if (found) {
            console.info(`[Pantry] Successfully found recipe: "${name}"`);
        } else {
            console.info(`[Pantry] Recipe NOT FOUND in vault: "${name}"`);
            console.info(`[Pantry] Reason: No exact match (case-insensitive) found. Available valid recipe names in vault: [${availableNames.join(', ')}]`);
        }
        
        return found ? found.frontmatter : null;
    }
    
    /**
     * Parses the recipe name and optional serving size from a tracker entry string
     */
    private parseEntryNameAndServingSize(entryStr: string): { name: string, servingSize?: number } {
        // Strip bullet points (- or *)
        let cleanedStr = entryStr.replace(/^[-*]\s+/, '').trim();
        
        // Parse "Recipe Name 200g" or "Recipe Name (200g)"
        const match = cleanedStr.match(/^(.+?)\s*(?:\((\d+(?:\.\d+)?)g\)|(\d+(?:\.\d+)?)g)$/i);
        if (!match) return { name: cleanedStr };

        const name = match[1].trim();
        const size = match[2] || match[3];
        const servingSize = size ? parseFloat(size) : undefined;

        return { name, servingSize };
    }

    private parseDate(dateStr: string): Date | null {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return null;
    }

    private extractTrackerBlocks(content: string): string[] {
        const blocks: string[] = [];
        const regex = /```tracker\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            blocks.push(match[1]);
        }
        return blocks;
    }

    /**
     * Calculates weekly aggregate macros and returns detailed daily breakdown
     */
    async calculateWeeklyAggregate(targetDate: Date = new Date()): Promise<WeeklyData> {
        const weekStart = getWeekStart(targetDate);
        const weekEnd = getWeekEnd(targetDate);

        const allFiles = this.app.vault.getMarkdownFiles();
        const dailyAggregates: Map<string, { aggregate: MacroAggregate; files: string[] }> = new Map();

        for (const file of allFiles) {
            const content = await this.app.vault.read(file);
            const trackerBlocks = this.extractTrackerBlocks(content);

            for (const block of trackerBlocks) {
                const data = this.parseBlock(block);
                if (!data || data.date === 'week' || getDateFromWeek(data.date)) continue;

                const blockDate = this.parseDate(data.date);
                if (!blockDate) continue;

                if (!isDateInWeek(blockDate, targetDate)) continue;

                const { aggregate } = await this.calculateDailyAggregate(data);

                const dateKey = data.date;
                if (!dailyAggregates.has(dateKey)) {
                    dailyAggregates.set(dateKey, { aggregate: { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }, files: [] });
                }

                const existing = dailyAggregates.get(dateKey)!;
                existing.aggregate.calories += aggregate.calories;
                existing.aggregate.protein += aggregate.protein;
                existing.aggregate.fat += aggregate.fat;
                existing.aggregate.carbs += aggregate.carbs;
                existing.aggregate.fibre += aggregate.fibre;
                existing.files.push(file.path);
            }
        }

        const weeklyAggregate: MacroAggregate = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
        const dailyBreakdown: DailyAggregate[] = [];

        dailyAggregates.forEach((value, date) => {
            weeklyAggregate.calories += value.aggregate.calories;
            weeklyAggregate.protein += value.aggregate.protein;
            weeklyAggregate.fat += value.aggregate.fat;
            weeklyAggregate.carbs += value.aggregate.carbs;
            weeklyAggregate.fibre += value.aggregate.fibre;

            dailyBreakdown.push({
                date,
                aggregate: value.aggregate,
                trackerBlocks: value.files
            });
        });

        dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

        const weeklyTargets: MacroAggregate = {
            calories: this.settings.dailyCalorieTarget * 7,
            protein: this.settings.dailyProteinTarget * 7,
            fat: this.settings.dailyFatTarget * 7,
            carbs: this.settings.dailyCarbsTarget * 7,
            fibre: this.settings.fibreTargetPerDay * 7
        };

        return {
            weekRange: formatWeekRange(weekStart, weekEnd),
            weekStart,
            weekEnd,
            aggregate: weeklyAggregate,
            dailyBreakdown,
            targets: weeklyTargets
        };
    }

    /**
     * Calculates aggregate macros for an entire day and returns detailed breakdown
     */
    async calculateDailyAggregate(data: TrackerData): Promise<{ aggregate: MacroAggregate, recipeDetails: RecipeDetail[] }> {
        console.info(`[Pantry] Starting daily aggregate calculation for ${data.entries.length} entries`);
        const aggregate: MacroAggregate = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
        const recipeDetails: RecipeDetail[] = [];

        for (const entry of data.entries) {
            console.info(`[Pantry] Processing entry: "${entry.name}"`);
            const recipe = await this.findRecipeByName(entry.name);
            if (recipe) {
                const result = calculateMacros(entry, recipe);
                if (result) {
                    const { macros, originalServingSize, servingSize } = result;
                    aggregate.calories += macros.calories;
                    aggregate.protein += macros.protein;
                    aggregate.fat += macros.fat;
                    aggregate.carbs += macros.carbs;
                    aggregate.fibre += macros.fibre;
                    
                    recipeDetails.push({
                        name: entry.name,
                        macros: macros,
                        notFound: false,
                        originalServingSize,
                        servingSize,
                        meal: entry.meal
                    });
                } else {
                    // Recipe found but invalid serving size
                    console.info(`[Pantry] Recipe "${entry.name}" found but has invalid serving size format. Ignoring macros.`);
                    recipeDetails.push({
                        name: entry.name,
                        macros: null,
                        notFound: false,
                        meal: entry.meal
                    });
                }
            } else {
                // Recipe not found
                recipeDetails.push({
                    name: entry.name,
                    macros: null,
                    notFound: true,
                    meal: entry.meal
                });
            }
        }

        console.info("[Pantry] Final daily aggregate:", aggregate);
        return { aggregate, recipeDetails };
    }

    async handleAddRecipesToBlock(source: string, el: HTMLElement, ctx: any, selectedNames: string[], selectedMeal: string) {
        if (!ctx || !ctx.sourcePath) {
            new Notice("Could not determine current file. Please try again.");
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(file instanceof TFile)) {
            new Notice("Current file not found.");
            return;
        }

        const content = await this.app.vault.read(file);
        const sectionInfo = ctx.getSectionInfo(el);
        let newContent = "";

        const blockLines = source.trimEnd().split('\n');
        let insertIndex = blockLines.length;

        if (selectedMeal === 'Uncategorized') {
            insertIndex = 0;
            for (let i = 0; i < blockLines.length; i++) {
                if (blockLines[i].toLowerCase().startsWith('id:')) {
                    insertIndex = i + 1;
                    break;
                }
            }
            blockLines.splice(insertIndex, 0, ...selectedNames);
        } else {
            let mealHeaderIndex = -1;
            let nextHeaderIndex = -1;
            
            for (let i = 0; i < blockLines.length; i++) {
                const line = blockLines[i].trim();
                if (line.startsWith('#')) {
                    const headerName = line.replace(/^#+\s*/, '').trim();
                    if (headerName === selectedMeal) {
                        mealHeaderIndex = i;
                    } else if (mealHeaderIndex !== -1 && nextHeaderIndex === -1) {
                        nextHeaderIndex = i;
                    }
                }
            }

            if (mealHeaderIndex !== -1) {
                insertIndex = nextHeaderIndex !== -1 ? nextHeaderIndex : blockLines.length;
                blockLines.splice(insertIndex, 0, ...selectedNames);
            } else {
                blockLines.push(`## ${selectedMeal}`);
                blockLines.push(...selectedNames);
            }
        }

        const newBlockContent = blockLines.join('\n');

        if (sectionInfo) {
            const lines = content.split('\n');
            lines.splice(sectionInfo.lineStart + 1, sectionInfo.lineEnd - sectionInfo.lineStart - 1, ...blockLines);
            newContent = lines.join('\n');
        } else {
            // Fallback: simple text replacement if getSectionInfo fails
            newContent = content.replace(source.trimEnd(), newBlockContent);
            
            if (newContent === content) {
                new Notice("Could not safely update the tracker block. The file might have changed.");
                return;
            }
        }
        
        await this.app.vault.modify(file, newContent);
        new Notice(`Added ${selectedNames.length} recipe(s) to tracker.`);
    }

    async handleServingSizeUpdate(
        oldEntryName: string,
        newServingSize: number,
        source: string,
        el: HTMLElement,
        ctx: any
    ): Promise<void> {
        if (!ctx || !ctx.sourcePath) {
            new Notice("Could not determine current file. Please try again.");
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(file instanceof TFile)) {
            new Notice("Current file not found.");
            return;
        }

        const content = await this.app.vault.read(file);
        const sectionInfo = ctx.getSectionInfo(el);
        let newContent = "";

        if (sectionInfo) {
            const lines = content.split('\n');
            const blockLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
            
            let found = false;
            for (let i = 0; i < blockLines.length; i++) {
                const line = blockLines[i];
                if (line.trim().toLowerCase().startsWith('id:')) continue;
                if (line.trim().startsWith('```')) continue;
                
                const { name } = this.parseEntryNameAndServingSize(line.trim());
                if (name === oldEntryName && !found) {
                    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
                    blockLines[i] = `${leadingWhitespace}${oldEntryName} (${newServingSize}g)`;
                    found = true;
                }
            }
            
            if (found) {
                lines.splice(sectionInfo.lineStart, sectionInfo.lineEnd - sectionInfo.lineStart + 1, ...blockLines);
                newContent = lines.join('\n');
            } else {
                new Notice("Could not find the entry in the block to update.");
                return;
            }
        } else {
            // Fallback
            const lines = source.split('\n');
            let found = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().toLowerCase().startsWith('id:')) continue;
                
                const { name } = this.parseEntryNameAndServingSize(line.trim());
                if (name === oldEntryName && !found) {
                    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
                    lines[i] = `${leadingWhitespace}${oldEntryName} (${newServingSize}g)`;
                    found = true;
                }
            }
            
            if (found) {
                const newBlockContent = lines.join('\n');
                newContent = content.replace(source.trimEnd(), newBlockContent.trimEnd());
            } else {
                new Notice("Could not find the entry in the block to update.");
                return;
            }
        }
        
        await this.app.vault.modify(file, newContent);
        new Notice(`Updated serving size for ${oldEntryName}.`);
    }

    async handleRemoveRecipe(
        entryName: string,
        source: string,
        el: HTMLElement,
        ctx: any
    ): Promise<void> {
        if (!ctx || !ctx.sourcePath) {
            new Notice("Could not determine current file. Please try again.");
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(file instanceof TFile)) {
            new Notice("Current file not found.");
            return;
        }

        const content = await this.app.vault.read(file);
        const sectionInfo = ctx.getSectionInfo(el);
        let newContent = "";

        if (sectionInfo) {
            const lines = content.split('\n');
            const blockLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
            
            let foundIndex = -1;
            for (let i = 0; i < blockLines.length; i++) {
                const line = blockLines[i];
                if (line.trim().toLowerCase().startsWith('id:')) continue;
                if (line.trim().startsWith('```')) continue;
                
                const { name } = this.parseEntryNameAndServingSize(line.trim());
                if (name === entryName) {
                    foundIndex = i;
                    break;
                }
            }
            
            if (foundIndex !== -1) {
                blockLines.splice(foundIndex, 1);
                lines.splice(sectionInfo.lineStart, sectionInfo.lineEnd - sectionInfo.lineStart + 1, ...blockLines);
                newContent = lines.join('\n');
            } else {
                new Notice("Could not find the entry in the block to remove.");
                return;
            }
        } else {
            // Fallback
            const lines = source.split('\n');
            let foundIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().toLowerCase().startsWith('id:')) continue;
                
                const { name } = this.parseEntryNameAndServingSize(line.trim());
                if (name === entryName) {
                    foundIndex = i;
                    break;
                }
            }
            
            if (foundIndex !== -1) {
                lines.splice(foundIndex, 1);
                const newBlockContent = lines.join('\n');
                newContent = content.replace(source.trimEnd(), newBlockContent.trimEnd());
            } else {
                new Notice("Could not find the entry in the block to remove.");
                return;
            }
        }
        
        await this.app.vault.modify(file, newContent);
        new Notice(`Removed ${entryName} from tracker.`);
    }

    /**
     * Main entry point for the processor
     */
    async process(source: string, el: HTMLElement, ctx?: any): Promise<void> {
        console.info("[Pantry] --- Starting Tracker Block Process ---");
        el.empty(); // Clear any previous content

        const data = this.parseBlock(source);
        if (!data) {
            el.createDiv({ text: 'Invalid tracker format. Missing "id:" date field.', cls: 'tracker-error' });
            return;
        }

        // --- Auto-Convert "id: today" to the hardcoded date ---
        if (data.originalId.toLowerCase() === 'today' || data.originalId === '') {
            if (ctx && ctx.sourcePath) {
                const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
                if (file instanceof TFile) {
                    try {
                        const content = await this.app.vault.read(file);
                        const sectionInfo = ctx.getSectionInfo(el);
                        if (sectionInfo) {
                            const lines = content.split('\n');
                            const blockLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
                            
                            for (let i = 0; i < blockLines.length; i++) {
                                if (blockLines[i].toLowerCase().startsWith('id:')) {
                                    blockLines[i] = `id: ${data.date}`;
                                    break;
                                }
                            }
                            
                            lines.splice(sectionInfo.lineStart, sectionInfo.lineEnd - sectionInfo.lineStart + 1, ...blockLines);
                            await this.app.vault.modify(file, lines.join('\n'));
                            console.info(`[Pantry] Auto-converted 'id: ${data.originalId}' to 'id: ${data.date}'`);
                        }
                    } catch (e) {
                        console.warn("[Pantry] Failed to auto-convert 'id: today' block:", e);
                    }
                }
            }
        }

        // Show loading state
        const loadingEl = el.createDiv({ text: 'Calculating macros...', cls: 'tracker-loading' });

        try {
            if (data.date === 'week') {
                const weeklyData = await this.calculateWeeklyAggregate();
                loadingEl.remove();
                
                console.info("[Pantry] Rendering Weekly UI Widget...");
                const container = el.createDiv({ cls: 'tracker-container' });
                this.weeklyRenderer.render(container, weeklyData, this.settings);
            } else if (getDateFromWeek(data.date)) {
                const targetDate = getDateFromWeek(data.date)!;
                const weeklyData = await this.calculateWeeklyAggregate(targetDate);
                loadingEl.remove();
                
                console.info(`[Pantry] Rendering Weekly UI Widget for ${data.date}...`);
                const container = el.createDiv({ cls: 'tracker-container' });
                this.weeklyRenderer.render(container, weeklyData, this.settings);
            } else {
                const { aggregate, recipeDetails } = await this.calculateDailyAggregate(data);
                loadingEl.remove();
                
                console.info("[Pantry] Rendering UI Widget...");
                
                // Container for both views
                const container = el.createDiv({ cls: 'tracker-container' });
                
                // Render Cards at top
                this.cardRenderer.renderWidget(container, data.date, aggregate, this.settings, async () => {
                    const allRecipes = await this.recipeManager.getAllRecipes();
                    const categories = await this.recipeManager.getRecipeCategories();
                    new RecipeSearchModal(
                        this.app,
                        allRecipes,
                        categories,
                        async (selectedNames: string[], selectedMeal: string) => {
                            await this.handleAddRecipesToBlock(source, el, ctx, selectedNames, selectedMeal);
                        }
                    ).open();
                });
                
                // Render Table underneath
                this.tableRenderer.renderTable(
                    container, 
                    recipeDetails, 
                    aggregate, 
                    this.settings,
                    (detail: RecipeDetail) => {
                        const currentServingSize = detail.servingSize || detail.originalServingSize || 100;
                        const originalServingSize = detail.originalServingSize || 100;
                        if (detail.macros) {
                            new ServingSizeModal(
                                this.app,
                                detail.name,
                                currentServingSize,
                                originalServingSize,
                                detail.macros,
                                async (newServingSize) => {
                                    await this.handleServingSizeUpdate(detail.name, newServingSize, source, el, ctx);
                                }
                            ).open();
                        }
                    },
                    async (detail: RecipeDetail) => {
                        await this.handleRemoveRecipe(detail.name, source, el, ctx);
                    }
                );
            }
            
            console.info("[Pantry] --- Tracker Block Process Complete ---");
        } catch (error) {
            loadingEl.remove();
            el.createDiv({ text: `Error calculating macros: ${error.message}`, cls: 'tracker-error' });
            console.error('[Pantry] Tracker processing error:', error);
        }
    }
}
