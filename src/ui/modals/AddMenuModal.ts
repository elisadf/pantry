import { App, Modal } from "obsidian";
import PantryPlugin from "../../main";
import { RecipeInputModal } from "./RecipeInputModal";
import { RecipeImageModal } from "./RecipeImageModal";
import { FatSecretSearchModal } from "./FatSecretSearchModal";
import { ManualFoodEntryModal } from "./ManualFoodEntryModal";
import { Notice } from "obsidian";

export class AddMenuModal extends Modal {
    plugin: PantryPlugin;

    constructor(app: App, plugin: PantryPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");

        contentEl.createDiv("pantry-modal-header", (header) => {
            header.createEl("h2", { text: "Add Food or Recipe", cls: "pantry-modal-title" });
        });

        const gridContainer = contentEl.createDiv("pantry-card-grid");

        const btnUrl = gridContainer.createDiv("pantry-card-btn");
        btnUrl.createDiv({ text: "📄", cls: "pantry-card-icon" });
        btnUrl.createDiv({ text: "Add a recipe", cls: "pantry-card-label" });
        btnUrl.onclick = () => {
            this.close();
            if (!this.plugin.checkApiKey()) return;
            new RecipeInputModal(this.app, "url", this.plugin.llmService, this.plugin.recipeManager).open();
        };

        const btnFatSecret = gridContainer.createDiv("pantry-card-btn");
        btnFatSecret.createDiv({ text: "🔍", cls: "pantry-card-icon" });
        btnFatSecret.createDiv({ text: "Use FatSecret API", cls: "pantry-card-label" });
        btnFatSecret.onclick = () => {
            this.close();
            if (!this.plugin.checkFatSecretCredentials()) return;
            new FatSecretSearchModal(this.app, this.plugin.fatSecretService, this.plugin.recipeManager).open();
        };

        const btnImage = gridContainer.createDiv("pantry-card-btn");
        btnImage.createDiv({ text: "📷", cls: "pantry-card-icon" });
        btnImage.createDiv({ text: "Add from screenshot", cls: "pantry-card-label" });
        btnImage.onclick = () => {
            this.close();
            if (!this.plugin.checkApiKey()) return;
            new RecipeImageModal(this.app, this.plugin.llmService, this.plugin.recipeManager).open();
        };

        const btnManual = gridContainer.createDiv("pantry-card-btn");
        btnManual.createDiv({ text: "✏️", cls: "pantry-card-icon" });
        btnManual.createDiv({ text: "Add manually", cls: "pantry-card-label" });
        btnManual.onclick = () => {
            this.close();
            new ManualFoodEntryModal(this.app, this.plugin).open();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
