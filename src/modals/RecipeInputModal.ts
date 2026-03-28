import { App, Modal, Notice, normalizePath } from "obsidian";
import { LLMAPIService } from "../services/LLMAPIService";
import { RecipeFileManager } from "../services/RecipeFileManager";
import { ErrorModal } from "./ErrorModal";
import { createPantryFile, RecipeInput } from "../core/fileGenerators";

export class RecipeInputModal extends Modal {
    private mode: "url" | "manual";
    private llmService: LLMAPIService;
    private recipeManager: RecipeFileManager;
    
    private urlInput: string = "";
    private nameInput: string = "";
    private ingredientsInput: string = "";
    
    private parsedData: RecipeInput | null = null;
    private isProcessing: boolean = false;

    constructor(app: App, mode: "url" | "manual", llmService: LLMAPIService, recipeManager: RecipeFileManager) {
        super(app);
        this.mode = mode;
        this.llmService = llmService;
        this.recipeManager = recipeManager;
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");

        if (this.parsedData) {
            this.renderPreview(contentEl);
        } else if (this.isProcessing) {
            this.renderProcessing(contentEl);
        } else {
            this.renderInputForm(contentEl);
        }
    }

    private renderInputForm(container: HTMLElement) {
        const backBtn = container.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = container.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.close();
            import("./AddMenuModal").then(m => new m.AddMenuModal(this.app, (this.app as any).plugins.plugins['obsidian-pantry']).open());
        };

                
        const text = this.mode === "url" ? "Add a recipe 👩‍🍳" : "Add Manual Recipe 👩‍🍳";
        header.createEl("h2", { text, cls: "pantry-modal-title" });

        const formContainer = container.createDiv({ cls: 'manual-entry-form' });

        if (this.mode === "url") {
            const inputContainer = formContainer.createDiv("pantry-form-row");
            const input = inputContainer.createEl("input", { type: "text", value: this.urlInput, cls: "pantry-url-input" });
            input.placeholder = "Paste your URL here";
            input.onchange = (e) => this.urlInput = (e.target as HTMLInputElement).value;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.handleParse();
                }
            };
        } else {
            const nameGroup = formContainer.createDiv("pantry-form-row");
            nameGroup.createEl("label", { text: "Recipe Name (Optional)", cls: "pantry-form-label" });
            const nameInputEl = nameGroup.createEl("input", { type: "text", value: this.nameInput, cls: "pantry-form-input" });
            nameInputEl.placeholder = "My Awesome Recipe";
            nameInputEl.onchange = (e) => this.nameInput = (e.target as HTMLInputElement).value;

            const ingGroup = formContainer.createDiv("pantry-form-row");
            ingGroup.createEl("label", { text: "Ingredients & Notes", cls: "pantry-form-label" });
            const ingInputEl = ingGroup.createEl("textarea", { cls: "pantry-form-input" });
            ingInputEl.value = this.ingredientsInput;
            ingInputEl.placeholder = "Paste ingredients here... Include any substitutions you plan to make.";
            ingInputEl.onchange = (e) => this.ingredientsInput = (e.target as HTMLTextAreaElement).value;
        }

        const actions = formContainer.createDiv("pantry-actions");
        const submitBtn = actions.createEl("button", { text: "Add", cls: "pantry-btn pantry-btn-primary" });
        submitBtn.onclick = () => this.handleParse();
    }

    private renderProcessing(container: HTMLElement) {
        const loadContainer = container.createDiv("pantry-loading");
        loadContainer.createEl("p", { text: "Parsing the recipe, this might take a moment…" });
    }

    private renderPreview(container: HTMLElement) {
        const backBtn = container.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = container.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.parsedData = null;
            this.display();
        };

                
        header.createEl("h2", { text: "Review your recipe:", cls: "pantry-modal-title" });

        const previewContainer = container.createDiv("preview-section");
        const pre = previewContainer.createEl("pre");
        pre.setText(JSON.stringify(this.parsedData, null, 2));

        const actions = container.createDiv("pantry-actions");
        const saveBtn = actions.createEl("button", { text: "Save Recipe", cls: "pantry-btn pantry-btn-primary" });
        saveBtn.onclick = () => this.handleSave();

        const retryBtn = actions.createEl("button", { text: "Discard & Try Again", cls: "pantry-btn pantry-btn-secondary" });
        retryBtn.onclick = () => {
            this.parsedData = null;
            this.display();
        };
    }

    private async handleParse() {
        if (this.mode === "url" && !this.urlInput.trim()) {
            new Notice("Please enter a URL");
            return;
        }

        if (this.mode === "manual" && !this.ingredientsInput.trim()) {
            new Notice("Please enter ingredients");
            return;
        }

        this.isProcessing = true;
        this.display();

        try {
            if (this.mode === "url") {
                this.parsedData = await this.llmService.parseRecipeFromURL(this.urlInput);
                // Ensure the source URL is strictly what the user inputted
                if (this.parsedData) {
                    this.parsedData.source_url = this.urlInput;
                }
            } else {
                this.parsedData = await this.llmService.parseRecipeFromText(this.ingredientsInput, this.nameInput);
            }
        } catch (error: any) {
            new ErrorModal(this.app, `Failed to parse recipe: ${error.message}`, () => {
                this.display();
            }).open();
        } finally {
            this.isProcessing = false;
            if (this.contentEl) this.display();
        }
    }

    private async handleSave() {
        if (!this.parsedData) return;

        try {
            const folderPath = normalizePath((this.app as any).plugins.plugins['obsidian-pantry'].settings.recipeFolder);
            const filePath = await createPantryFile(this.parsedData, this.app, folderPath);
            new Notice(`Saved recipe to ${filePath}`);
            this.close();
        } catch (error: any) {
            new Notice(`Failed to save recipe: ${error.message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
