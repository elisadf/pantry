import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import { FatSecretAPIService, FatSecretFoodSearchItem } from "../../services/apis/FatSecretAPIService";
import { RecipeFileManager, FoodItemFrontmatter } from "../../services/RecipeFileManager";
import { ErrorModal } from "./ErrorModal";
import { createPantryFile, FoodItemInput } from "../../core/fileGenerators";

export class FatSecretSearchModal extends Modal {
    private fatSecretService: FatSecretAPIService;
    private recipeManager: RecipeFileManager;
    
    private searchInput: string = "";
    private searchResults: FatSecretFoodSearchItem[] = [];
    private selectedFood: FatSecretFoodSearchItem | null = null;
    
    private parsedData: FoodItemFrontmatter | null = null;
    private isProcessing: boolean = false;

    private searchDebounceTimer: NodeJS.Timeout | null = null;
    
    // For the save dialog
    private fileName: string = "";
    private defaultServingSize: string = "100";

    constructor(app: App, fatSecretService: FatSecretAPIService, recipeManager: RecipeFileManager) {
        super(app);
        this.fatSecretService = fatSecretService;
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
            this.renderSaveDialog(contentEl);
        } else if (this.isProcessing) {
            this.renderProcessing(contentEl);
        } else {
            this.renderSearchForm(contentEl);
        }
    }

    private renderSearchForm(container: HTMLElement) {
        const backBtn = container.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = container.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.close();
            import("./AddMenuModal").then(m => new m.AddMenuModal(this.app, (this.app as any).plugins.plugins['obsidian-pantry']).open());
        };

                
        header.createEl("h2", { text: "Search food 🔍", cls: "pantry-modal-title" });

        const searchContainer = container.createDiv("pantry-input-group");
        const input = searchContainer.createEl("input", { type: "text", value: this.searchInput, cls: "pantry-search-input" });
        input.placeholder = "Start typing to search (eg Banana)";
        
        searchContainer.createDiv({ text: "🔍", cls: "pantry-input-icon" });

        input.oninput = (e) => {
            this.searchInput = (e.target as HTMLInputElement).value;
            
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            if (this.searchInput.trim().length > 2) {
                this.searchDebounceTimer = setTimeout(() => {
                    this.handleSearch();
                }, 500); // 500ms debounce
            } else if (this.searchInput.trim().length === 0) {
                this.searchResults = [];
                this.display();
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
                this.handleSearch();
            }
        };

        if (this.searchResults.length > 0) {
            const list = container.createDiv("pantry-search-results");
            this.searchResults.forEach(item => {
                const itemEl = list.createDiv(`pantry-search-result-item ${this.selectedFood === item ? 'is-selected' : ''}`);
                
                const info = itemEl.createDiv("pantry-search-result-info");
                info.createEl("div", { text: item.food_name, cls: "pantry-search-result-name" });
                info.createEl("div", { text: item.food_description, cls: "pantry-search-result-macros" });
                
                itemEl.createDiv({ text: "FatSecret", cls: "pantry-badge" });

                itemEl.onclick = () => {
                    this.selectedFood = item;
                    this.handleFetchFoodDetails();
                };
            });
        }
    }

    private renderProcessing(container: HTMLElement) {
        const loadContainer = container.createDiv("pantry-loading");
        loadContainer.createEl("p", { text: "Searching FatSecret database... Please wait." });
    }

    private renderSaveDialog(container: HTMLElement) {
        const backBtn = container.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = container.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.parsedData = null;
            this.selectedFood = null;
            this.display();
        };

                
        header.createEl("h2", { text: "Save Food Item", cls: "pantry-modal-title" });

        container.createEl("p", { text: "Please enter a name and default serving size for this food item:" });

        const formContainer = container.createDiv({ cls: 'manual-entry-form' });

        const nameGroup = formContainer.createDiv({ cls: 'pantry-form-row' });
        nameGroup.createEl('label', { text: 'File Name:', cls: 'pantry-form-label' });
        const nameInput = nameGroup.createEl('input', {
            type: 'text',
            cls: 'pantry-form-input',
            value: this.fileName
        });
        nameInput.onchange = (e) => this.fileName = (e.target as HTMLInputElement).value;

        const servingGroup = formContainer.createDiv({ cls: 'pantry-form-row' });
        servingGroup.createEl('label', { text: 'Default Serving Size (grams):', cls: 'pantry-form-label' });
        servingGroup.createEl('p', {
            text: 'Optional: Set a custom default serving size for when you add this food to your macros. If not set, it will use 100g from the API.',
            cls: 'pantry-form-desc'
        });
        const servingInput = servingGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            value: this.defaultServingSize
        });
        servingInput.onchange = (e) => this.defaultServingSize = (e.target as HTMLInputElement).value;

        const actions = formContainer.createDiv("pantry-actions");
        const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "pantry-btn pantry-btn-secondary" });
        cancelBtn.onclick = () => {
            this.parsedData = null;
            this.selectedFood = null;
            this.display();
        };

        const saveBtn = actions.createEl("button", { text: "Save", cls: "pantry-btn pantry-btn-primary" });
        saveBtn.onclick = () => this.handleSave();
    }

    private async handleSearch() {
        if (!this.searchInput.trim()) return;

        this.isProcessing = true;
        this.display();

        try {
            this.searchResults = await this.fatSecretService.searchFoods(this.searchInput);
            if (this.searchResults.length === 0) {
                new Notice("No results found.");
            }
        } catch (error: any) {
            new ErrorModal(this.app, `Search failed: ${error.message}`, () => {
                this.display();
            }).open();
        } finally {
            this.isProcessing = false;
            if (this.contentEl) this.display();
        }
    }

    private async handleFetchFoodDetails() {
        if (!this.selectedFood) return;

        this.isProcessing = true;
        this.display();

        try {
            this.parsedData = await this.fatSecretService.getFood(this.selectedFood.food_id);
            this.fileName = this.parsedData.name;
            this.defaultServingSize = "100";
        } catch (error: any) {
            new ErrorModal(this.app, `Failed to fetch food details: ${error.message}`, () => {
                this.selectedFood = null;
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
            const input: FoodItemInput = {
                name: this.fileName.trim(),
                protein: this.parsedData.protein_estimate_g || 0,
                carbs: this.parsedData.carbs_estimate_g || 0,
                fat: this.parsedData.fat_estimate_g || 0,
                fibre: this.parsedData.fibre_estimate_g || 0,
                calories: this.parsedData.calorie_estimate_kcal || 0,
                serving_size: `${this.defaultServingSize.trim() || 100}g`,
                source: "fatsecret"
            };

            const folderPath = normalizePath((this.app as any).plugins.plugins['obsidian-pantry'].settings.recipeFolder);
            const filePath = await createPantryFile(input, this.app, folderPath);

            new Notice(`Saved food to ${filePath}`);
            this.close();
        } catch (error: any) {
            new Notice(`Failed to save food: ${error.message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
