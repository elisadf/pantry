import { App, Plugin, PluginSettingTab, Setting, Notice, requestUrl, parseYaml, TFile, setIcon } from "obsidian";
import { PantryPluginSettings, DEFAULT_SETTINGS, PantrySettingsTab } from "./settings";
import { RecipeFileManager } from "./services/RecipeFileManager";
import { LLMAPIService } from "./services/apis/LLMAPIService";
import { FatSecretAPIService } from "./services/apis/FatSecretAPIService";
import { WeeklyNoteManager } from "./services/WeeklyNoteManager";
import { RecipeInputModal } from "./ui/modals/RecipeInputModal";
import { RecipeImageModal } from "./ui/modals/RecipeImageModal";
import { WeeklyPlannerV2Modal } from "./ui/modals/WeeklyPlannerV2Modal";
import { FatSecretSearchModal } from "./ui/modals/FatSecretSearchModal";
import { AddMenuModal } from "./ui/modals/AddMenuModal";
import { registerTrackerProcessor } from "./processors/tracker";
import { calculateWeeklyBalance } from "./calculators/weeklyBalance";
import { FoodListEditorModal } from "./ui/modals/FoodListEditorModal";
import { EditWeeklyServingModal } from "./ui/modals/EditWeeklyServingModal";
import { WeeklyPlannerRenderer } from './ui/renders/WeeklyPlannerRenderer';
import { MarkdownSettingsService } from "./services/MarkdownSettingsService";

export default class PantryPlugin extends Plugin {
    settings: PantryPluginSettings;
    recipeManager: RecipeFileManager;
    llmService: LLMAPIService;
    fatSecretService: FatSecretAPIService;
    noteManager: WeeklyNoteManager;
    markdownSettingsService: MarkdownSettingsService;

    async onload() {
        console.log("PANTRY_V2_LOADED");
        await this.loadSettings();

        // Initialize Services
        this.recipeManager = new RecipeFileManager(this.app, this.settings);
        this.llmService = new LLMAPIService(this.settings.llmApiKey, this.settings.llmEndpoint, this.settings.llmModel);
        this.fatSecretService = new FatSecretAPIService(this.settings.fatSecretClientId, this.settings.fatSecretClientSecret, requestUrl);
        this.noteManager = new WeeklyNoteManager(this.app, this.settings);
        this.markdownSettingsService = new MarkdownSettingsService(this.app, this.settings);

        // Ensure folders exist
        this.app.workspace.onLayoutReady(async () => {
            await this.recipeManager.ensureFolderStructure();
            await this.noteManager.ensureFolder();
            await this.markdownSettingsService.loadSettings();
        });

        // Add Settings Tab
        this.addSettingTab(new PantrySettingsTab(this.app, this));

        // Commands
        this.addCommand({
            id: "add-recipe-url",
            name: "Add Recipe from URL",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeInputModal(this.app, "url", this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "add-recipe-manual",
            name: "Add Recipe Manually (Text)",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeInputModal(this.app, "manual", this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "add-recipe-image",
            name: "Add Recipe from Image/Screenshot",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeImageModal(this.app, this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "search-fatsecret-food",
            name: "Add Food from FatSecret",
            callback: () => {
                if (!this.checkFatSecretCredentials()) return;
                new FatSecretSearchModal(this.app, this.fatSecretService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "create-weekly-plan",
            name: "Create Weekly Plan",
            callback: () => {
                new WeeklyPlannerV2Modal(this.app, this.recipeManager, this.noteManager, this.settings, this.markdownSettingsService).open();
            }
        });

        // Ribbon Icons
        this.addRibbonIcon("calendar-check", "Pantry", () => {
            new WeeklyPlannerV2Modal(this.app, this.recipeManager, this.noteManager, this.settings, this.markdownSettingsService).open();
        });
        
        this.addRibbonIcon("chef-hat", "Add Food/Recipe", () => {
            new AddMenuModal(this.app, this).open();
        });

        // Register Markdown Processors
        registerTrackerProcessor(this);

        const weeklyPlannerRenderer = new WeeklyPlannerRenderer();
        this.registerMarkdownCodeBlockProcessor('weeklyplannerV2', async (source, el, ctx) => {
            await weeklyPlannerRenderer.render(source, el, ctx, this.app, this.recipeManager, this.settings, this.markdownSettingsService);
        });
    }

    public checkApiKey(): boolean {
        if (!this.settings.llmApiKey) {
            new Notice("Please set your LLM API Key in the plugin settings.");
            return false;
        }
        return true;
    }

    public checkFatSecretCredentials(): boolean {
        if (!this.settings.fatSecretClientId || !this.settings.fatSecretClientSecret) {
            new Notice("Please set your FatSecret Client ID and Secret in the plugin settings.");
            return false;
        }
        return true;
    }

    onunload() {
        // Cleanup if necessary
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Re-initialize services with new settings
        this.llmService = new LLMAPIService(this.settings.llmApiKey, this.settings.llmEndpoint, this.settings.llmModel);
        this.fatSecretService = new FatSecretAPIService(this.settings.fatSecretClientId, this.settings.fatSecretClientSecret, requestUrl);
    }
}
