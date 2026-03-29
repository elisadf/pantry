import { App, Modal, Notice, normalizePath } from "obsidian";
import { LLMAPIService } from "../../services/apis/LLMAPIService";
import { RecipeFileManager } from "../../services/RecipeFileManager";
import { ErrorModal } from "./ErrorModal";
import { createPantryFile, RecipeInput } from "../../core/fileGenerators";

export class RecipeImageModal extends Modal {
    private llmService: LLMAPIService;
    private recipeManager: RecipeFileManager;
    
    private selectedFile: File | null = null;
    private fileInputEl: HTMLInputElement | null = null;
    
    private parsedData: RecipeInput | null = null;
    private isProcessing: boolean = false;

    constructor(app: App, llmService: LLMAPIService, recipeManager: RecipeFileManager) {
        super(app);
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

                
        header.createEl("h2", { text: "Add from screenshot 📷", cls: "pantry-modal-title" });

        const formContainer = container.createDiv({ cls: 'manual-entry-form' });
        
        const group = formContainer.createDiv("pantry-form-row");
        group.createEl("p", { text: "Upload a screenshot or photo of a recipe (e.g., from Thermomix).", cls: "pantry-form-desc" });

        this.fileInputEl = group.createEl("input", { type: "file", cls: "pantry-form-input" });
        this.fileInputEl.accept = "image/png, image/jpeg, image/jpg";
        this.fileInputEl.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                this.selectedFile = files[0];
            }
        };

        const actions = formContainer.createDiv("pantry-actions");
        const submitBtn = actions.createEl("button", { text: "Parse Image", cls: "pantry-btn pantry-btn-primary" });
        submitBtn.onclick = () => this.handleParse();

        const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "pantry-btn pantry-btn-secondary" });
        cancelBtn.onclick = () => this.close();
    }

    private renderProcessing(container: HTMLElement) {
        const loadContainer = container.createDiv("pantry-loading");
        loadContainer.createEl("p", { text: "Parsing the recipe image, this might take a moment…" });
    }

    private renderPreview(container: HTMLElement) {
        const backBtn = container.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = container.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.parsedData = null;
            this.selectedFile = null;
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
            this.selectedFile = null;
            this.display();
        };
    }

    private async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    private async handleParse() {
        if (!this.selectedFile) {
            new Notice("Please select an image file first");
            return;
        }

        this.isProcessing = true;
        this.display();

        try {
            const base64 = await this.fileToBase64(this.selectedFile);
            this.parsedData = await this.llmService.parseRecipeFromImage(base64);
        } catch (error: any) {
            new ErrorModal(this.app, `Failed to parse image: ${error.message}`, () => {
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
