import { App, normalizePath } from "obsidian";
import { PantryPluginSettings } from "../settings";

export class WeeklyNoteManager {
    private app: App;
    private settings: PantryPluginSettings;

    constructor(app: App, settings: PantryPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    async ensureFolder(): Promise<void> {
        // Base recipe folder
        const path = normalizePath(this.settings.recipeFolder);
        const baseParts = path.split('/');
        let currentPath = '';

        for (const part of baseParts) {
            currentPath = currentPath ? normalizePath(`${currentPath}/${part}`) : part;
            const folder = this.app.vault.getAbstractFileByPath(currentPath);
            if (!folder) {
                await this.app.vault.createFolder(currentPath);
            }
        }

        // Weekly plans subfolder
        const weeklyPlansPath = normalizePath(`${path}/Weekly plans`);
        const weeklyFolder = this.app.vault.getAbstractFileByPath(weeklyPlansPath);
        if (!weeklyFolder) {
            await this.app.vault.createFolder(weeklyPlansPath);
        }
    }

    async createWeeklyNote(
        weekString: string, 
        recipes: { name: string, path: string, servings?: number }[], 
        extras: string,
        summaryCodeblock: string
    ): Promise<string> {
        await this.ensureFolder();
        
        const path = normalizePath(this.settings.recipeFolder);
        const filename = `${weekString}.md`;
        const filePath = normalizePath(`${path}/Weekly plans/${filename}`);
        
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            throw new Error(`Weekly note for ${weekString} already exists.`);
        }

        const lines: string[] = [];
        lines.push(`# Weekly Plan: ${weekString}`);
        lines.push("");
        lines.push(summaryCodeblock);
        lines.push("");
        lines.push("## Selected Recipes");

        recipes.forEach(r => {
            const basename = r.path.split("/").pop()?.replace(".md", "") || r.name;
            const servingStr = r.servings && r.servings > 1 ? ` (×${r.servings})` : "";
            lines.push(`- [[${basename}]]${servingStr}`);
        });

        await this.app.vault.create(filePath, lines.join("\n"));
        return filePath;
    }

    async createWeeklyNoteV2(
        weekString: string, 
        recipes: { name: string, path: string, servings?: number, category?: string }[], 
        extras: string,
        summaryCodeblock: string
    ): Promise<string> {
        await this.ensureFolder();
        
        const path = normalizePath(this.settings.recipeFolder);
        const filename = `${weekString}.md`;
        const filePath = normalizePath(`${path}/Weekly plans/${filename}`);
        
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            throw new Error(`Weekly note v2 for ${weekString} already exists.`);
        }

        const lines: string[] = [];
        lines.push(`# Weekly Plan: ${weekString}`);
        lines.push("");
        lines.push("```weeklyplannerV2");
        lines.push("foods:");
        recipes.forEach(r => {
            const basename = r.path.split("/").pop()?.replace(".md", "") || r.name;
            lines.push(`  - name: ${basename}`);
            lines.push(`    servings: ${r.servings || 1}`);
            if (r.category) {
                lines.push(`    category: ${r.category}`);
            }
        });
        lines.push("```");

        await this.app.vault.create(filePath, lines.join("\n"));
        return filePath;
    }
}
