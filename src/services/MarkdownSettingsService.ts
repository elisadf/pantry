import { App, TFolder, TFile, normalizePath, parseYaml } from "obsidian";
import { PantryPluginSettings } from "../settings";
import * as yaml from 'js-yaml';

export class MarkdownSettingsService {
    private app: App;
    private settings: PantryPluginSettings;

    constructor(app: App, settings: PantryPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    private getSettingsFilePath(): string {
        return normalizePath(`${this.settings.recipeFolder}/Data/Settings.md`);
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

    public async loadSettings(): Promise<any> {
        console.log("====================================================");
        console.log("[MarkdownSettingsService] 📖 READING SETTINGS");
        console.log("[MarkdownSettingsService] File Path:", this.getSettingsFilePath());
        console.log("====================================================");
        const filePath = this.getSettingsFilePath();
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (!(file instanceof TFile)) {
            // Ensure folder exists and create default file
            await this.ensureFolder(normalizePath(`${this.settings.recipeFolder}/Data`));
            const defaultContent = `My food settings data\n\n\`\`\`yaml\ncategories:\n  - breakfast\n  - mains\n  - sides\n\`\`\`\n`;
            await this.app.vault.create(filePath, defaultContent);
            
            // Re-read or just return the default parse
            return {
                categories: ['breakfast', 'mains', 'sides']
            };
        }

        const content = await this.app.vault.read(file);
        return this.parseSettingsFromContent(content);
    }

    private parseSettingsFromContent(content: string): any {
        const regex = /\`\`\`yaml\n([\s\S]*?)\n\`\`\`/;
        const match = content.match(regex);
        
        if (match && match[1]) {
            try {
                return parseYaml(match[1]);
            } catch (e) {
                console.error("Failed to parse YAML block in settings file:", e);
                return null;
            }
        }
        return null;
    }

    public async saveSettings(newSettingsData: any): Promise<void> {
        console.log("====================================================");
        console.log("[MarkdownSettingsService] 💾 WRITING SETTINGS");
        console.log("[MarkdownSettingsService] File Path:", this.getSettingsFilePath());
        console.log("[MarkdownSettingsService] Data:", newSettingsData);
        console.log("====================================================");
        const filePath = this.getSettingsFilePath();
        let file = this.app.vault.getAbstractFileByPath(filePath);

        const yamlString = yaml.dump(newSettingsData);

        if (!(file instanceof TFile)) {
            // File doesn't exist, create it with new settings
            await this.ensureFolder(normalizePath(`${this.settings.recipeFolder}/Data`));
            const defaultContent = `My food settings data\n\n\`\`\`yaml\n${yamlString}\n\`\`\`\n`;
            await this.app.vault.create(filePath, defaultContent);
            return;
        }

        const content = await this.app.vault.read(file);
        const regex = /\`\`\`yaml\n([\s\S]*?)\n\`\`\`/;

        let newContent = content;
        if (regex.test(content)) {
            // Replace existing block
            newContent = content.replace(regex, `\`\`\`yaml\n${yamlString}\`\`\``);
        } else {
            // Append block
            newContent = content.trimEnd() + `\n\n\`\`\`yaml\n${yamlString}\`\`\`\n`;
        }

        await this.app.vault.modify(file, newContent);
    }
}
