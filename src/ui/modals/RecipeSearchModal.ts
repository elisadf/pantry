import { App, Modal, Setting, Notice } from "obsidian";
import { FoodItemFrontmatter } from "../../services/RecipeFileManager";

export interface RecipeSearchResult {
    path: string;
    frontmatter: FoodItemFrontmatter;
}

export class RecipeSearchModal extends Modal {
    private searchInput: string = "";
    private selectedCategory: string = "All";
    private searchResults: RecipeSearchResult[] = [];
    private selectedRecipes: Set<string> = new Set();
    
    private allRecipes: RecipeSearchResult[];
    private categories: string[];
    private onConfirm: (selectedRecipes: string[], selectedMeal: string) => void;
    
    private searchDebounceTimer: NodeJS.Timeout | null = null;
    
    private resultsContainer: HTMLElement;
    private confirmBtn: HTMLButtonElement;
    
    private selectedMeal: string = "Uncategorized";

    constructor(
        app: App, 
        allRecipes: RecipeSearchResult[], 
        categories: string[],
        onConfirm: (selectedRecipes: string[], selectedMeal: string) => void
    ) {
        super(app);
        this.allRecipes = allRecipes;
        this.searchResults = allRecipes;
        this.categories = categories;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");

        const header = contentEl.createDiv("pantry-modal-header");
        
        header.createEl("h2", { text: "Search and Add Recipes 🔍", cls: "pantry-modal-title" });
        
        // Filters Container
        const filtersContainer = contentEl.createDiv({ 
            attr: { style: "display: flex; gap: 8px; margin-bottom: 16px; align-items: stretch;" } 
        });

        // Search Input
        const searchContainer = filtersContainer.createDiv({ cls: "pantry-input-group", attr: { style: "flex: 1; margin-bottom: 0;" } });
        const input = searchContainer.createEl("input", { type: "text", value: this.searchInput, cls: "pantry-search-input" });
        input.placeholder = "Search recipes by name...";
        searchContainer.createDiv({ text: "🔍", cls: "pantry-input-icon" });

        input.oninput = (e) => {
            this.searchInput = (e.target as HTMLInputElement).value;
            
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            this.searchDebounceTimer = setTimeout(() => {
                this.handleSearch();
            }, 300); // 300ms debounce
        };

        // Category Filter
        const categoryContainer = filtersContainer.createDiv({ attr: { style: "display: flex;" } });
        const select = categoryContainer.createEl("select", { cls: "pantry-form-input", attr: { style: "width: auto; height: 100%;" } });
        const dropdownCategories = ["Search from folder", ...this.categories];
        
        dropdownCategories.forEach(cat => {
            const option = select.createEl("option", { text: cat, value: cat === "Search from folder" ? "All" : cat });
            if (this.selectedCategory === (cat === "Search from folder" ? "All" : cat)) {
                option.selected = true;
            }
        });

        select.onchange = (e) => {
            this.selectedCategory = (e.target as HTMLSelectElement).value;
            this.handleSearch();
        };

        // Results Area
        this.resultsContainer = contentEl.createDiv("pantry-search-results");
        this.resultsContainer.style.maxHeight = "400px";
        this.resultsContainer.style.overflowY = "auto";
        this.renderResults();

        // Meal Selection Area
        const mealSelectionContainer = contentEl.createDiv({ 
            attr: { style: "display: flex; flex-direction: column; gap: 8px; margin-top: 16px; margin-bottom: 16px; padding-top: 16px; border-top: 1px solid var(--background-modifier-border);" } 
        });
        
        mealSelectionContainer.createEl("label", { text: "Select a meal", attr: { style: "font-weight: 500; font-size: 0.9em; color: var(--text-normal);" } });
        const mealSelectWrapper = mealSelectionContainer.createDiv({ cls: "pantry-select-wrapper", attr: { style: "position: relative; width: 100%;" } });
        const mealSelect = mealSelectWrapper.createEl("select", { cls: "pantry-form-input pantry-meal-select" });
        
        const mealOptions = ["- Select -", ...this.categories, "Uncategorized"];
        mealOptions.forEach(meal => {
            const val = meal === "- Select -" ? "Uncategorized" : meal;
            mealSelect.createEl("option", { text: meal, value: val });
        });
        
        // Add a custom caret icon for the select
        const caretIcon = mealSelectWrapper.createSpan({ text: "▼", attr: { style: "position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; font-size: 0.8em; color: var(--text-muted);" } });

        mealSelect.onchange = (e) => {
            this.selectedMeal = (e.target as HTMLSelectElement).value;
        };

        // Footer Actions
        const actionsContainer = contentEl.createDiv("pantry-actions");
        actionsContainer.style.justifyContent = "space-between";
        actionsContainer.style.alignItems = "center";

        const counterEl = actionsContainer.createDiv("pantry-selected-counter");
        counterEl.innerHTML = `<strong>${this.selectedRecipes.size}</strong> recipe(s) selected`;

        const buttonsContainer = actionsContainer.createDiv({ attr: { style: "display: flex; gap: 12px; align-items: center;" } });
        
        const cancelBtn = buttonsContainer.createEl("button", { text: "Cancel", cls: "pantry-btn pantry-btn-secondary" });
        cancelBtn.onclick = () => this.close();

        this.confirmBtn = buttonsContainer.createEl("button", { text: "Add Selected", cls: "pantry-btn pantry-btn-primary" });
        this.confirmBtn.onclick = () => {
            if (this.selectedRecipes.size === 0) return;
            
            const selectedNames = Array.from(this.selectedRecipes);

            this.onConfirm(selectedNames, this.selectedMeal);
            this.close();
        };
        
        this.updateConfirmButtonState();
    }

    private handleSearch() {
        const query = this.searchInput.toLowerCase().trim();
        const category = this.selectedCategory.toLowerCase();

        this.searchResults = this.allRecipes.filter(recipe => {
            let name = recipe.frontmatter.name;
            if (!name) {
                const parts = recipe.path.split('/');
                const filename = parts[parts.length - 1];
                name = filename.replace(/\.md$/i, '');
            }

            const matchName = name.toLowerCase().includes(query);
            const rCat = recipe.frontmatter.category ? recipe.frontmatter.category.toLowerCase() : '';
            const pathLower = recipe.path.toLowerCase();
            
            // Match either the explicit frontmatter category or check if the file lives in a folder matching the category
            const matchCategory = category === "all" || rCat === category || pathLower.includes(`/${category}/`);

            return matchName && matchCategory;
        });

        this.renderResults();
    }

    private renderResults() {
        this.resultsContainer.empty();

        if (this.searchResults.length === 0) {
            this.resultsContainer.createDiv({
                text: "No recipes found matching your criteria.",
                attr: { style: "padding: 16px; color: var(--text-muted); text-align: center;" }
            });
            return;
        }

        this.searchResults.forEach(recipe => {
            let name = recipe.frontmatter.name;
            if (!name) {
                const parts = recipe.path.split('/');
                const filename = parts[parts.length - 1];
                name = filename.replace(/\.md$/i, '');
            }

            const isSelected = this.selectedRecipes.has(name);
            
            const itemEl = this.resultsContainer.createDiv(`pantry-search-result-item ${isSelected ? 'is-selected' : ''}`);
            itemEl.style.display = "flex";
            itemEl.style.alignItems = "center";
            itemEl.style.gap = "12px";
            
            const checkbox = itemEl.createEl("input", { type: "checkbox" });
            checkbox.checked = isSelected;
            checkbox.onclick = (e) => e.stopPropagation(); // Prevent toggling twice if label clicked
            checkbox.onchange = (e) => {
                if ((e.target as HTMLInputElement).checked) {
                    this.selectedRecipes.add(name);
                } else {
                    this.selectedRecipes.delete(name);
                }
                this.updateSelectionUI();
            };

            const info = itemEl.createDiv("pantry-search-result-info");
            info.style.flex = "1";
            
            info.createEl("div", { text: name, cls: "pantry-search-result-name" });

            // Make the whole row clickable
            itemEl.onclick = () => {
                if (this.selectedRecipes.has(name)) {
                    this.selectedRecipes.delete(name);
                    checkbox.checked = false;
                } else {
                    this.selectedRecipes.add(name);
                    checkbox.checked = true;
                }
                this.updateSelectionUI();
            };
        });
    }

    private updateSelectionUI() {
        // Re-render items to update 'is-selected' class visually
        // Doing this efficiently without full re-render
        const items = this.resultsContainer.querySelectorAll('.pantry-search-result-item');
        
        let i = 0;
        this.searchResults.forEach(recipe => {
            let name = recipe.frontmatter.name;
            if (!name) {
                const parts = recipe.path.split('/');
                const filename = parts[parts.length - 1];
                name = filename.replace(/\.md$/i, '');
            }
            
            if (i < items.length) {
                if (this.selectedRecipes.has(name)) {
                    items[i].classList.add('is-selected');
                } else {
                    items[i].classList.remove('is-selected');
                }
            }
            i++;
        });

        // Update counter
        const counterEl = this.contentEl.querySelector('.pantry-selected-counter');
        if (counterEl) {
            counterEl.innerHTML = `<strong>${this.selectedRecipes.size}</strong> recipe(s) selected`;
        }

        this.updateConfirmButtonState();
    }

    private updateConfirmButtonState() {
        if (this.confirmBtn) {
            if (this.selectedRecipes.size === 0) {
                this.confirmBtn.disabled = true;
                this.confirmBtn.style.opacity = "0.5";
                this.confirmBtn.style.cursor = "not-allowed";
            } else {
                this.confirmBtn.disabled = false;
                this.confirmBtn.style.opacity = "1";
                this.confirmBtn.style.cursor = "pointer";
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
