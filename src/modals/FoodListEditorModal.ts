import { App, Modal, Notice, setIcon } from 'obsidian';
import { RecipeFileManager, FoodItemFrontmatter } from '../services/RecipeFileManager';
import { PantryPluginSettings } from '../settings';
import { EditWeeklyServingModal } from './EditWeeklyServingModal';

export interface PlannedFoodItem {
    name: string;
    servings: number;
}

export class FoodListEditorModal extends Modal {
    private recipeManager: RecipeFileManager;
    private settings: PantryPluginSettings;
    private currentFoods: PlannedFoodItem[];
    private onSave: (foods: PlannedFoodItem[]) => void;
    
    private allRecipes: { path: string; frontmatter: FoodItemFrontmatter }[] = [];
    private categories: string[] = [];
    private isLoading: boolean = true;
    
    private searchQuery: string = '';
    private categoryFilter: string = 'all';

    constructor(
        app: App,
        recipeManager: RecipeFileManager,
        settings: PantryPluginSettings,
        currentFoods: PlannedFoodItem[],
        onSave: (foods: PlannedFoodItem[]) => void
    ) {
        super(app);
        this.recipeManager = recipeManager;
        this.settings = settings;
        // Deep copy to avoid mutating the original array directly before saving
        this.currentFoods = currentFoods.map(f => ({ ...f }));
        this.onSave = onSave;
    }

    async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("nutrition-planner-modal");
        this.contentEl.createEl("h2", { text: "Edit Weekly Plan" });
        this.contentEl.createEl("p", { text: "Loading recipes..." });

        try {
            this.allRecipes = await this.recipeManager.getAllRecipes();
            this.categories = await this.recipeManager.getRecipeCategories();
        } catch (e) {
            new Notice("Failed to load recipes");
        } finally {
            this.isLoading = false;
            this.display();
        }
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");
        
        contentEl.createEl("h2", { text: "Edit Weekly Plan", cls: "planner-title-row" });

        if (this.isLoading) {
            contentEl.createEl("p", { text: "Loading..." });
            return;
        }

        const layout = contentEl.createDiv({ cls: "planner-layout" });

        // Left side: Search and Add Recipes
        const selectionArea = layout.createDiv({ cls: "planner-selection" });
        selectionArea.createEl("h3", { text: "🔍 Search Recipes", cls: "planner-section-heading" });

        const filtersContainer = selectionArea.createDiv({ attr: { style: 'display:flex; gap:8px; margin-bottom:12px;' } });
        const searchContainer = filtersContainer.createDiv({ cls: 'pantry-input-group', attr: { style: 'flex:1; margin-bottom:0;' } });
        
        const input = searchContainer.createEl('input', { type: 'text', cls: 'pantry-search-input' });
        input.placeholder = 'Search recipes by name...';
        input.value = this.searchQuery;
        
        const select = filtersContainer.createEl('select', { cls: 'pantry-form-input', attr: { style: 'width:auto;' } });
        const dropdownCategories = ['All', ...this.categories];
        dropdownCategories.forEach(cat => {
            select.createEl('option', { text: cat, value: cat.toLowerCase() });
        });
        select.value = this.categoryFilter;

        const resultsContainer = selectionArea.createDiv('pantry-search-results');
        resultsContainer.style.maxHeight = '400px';
        resultsContainer.style.overflowY = 'auto';

        const renderResults = () => {
            resultsContainer.empty();
            const query = this.searchQuery.toLowerCase().trim();
            const category = this.categoryFilter;
            
            const filtered = this.allRecipes.filter(r => {
                const name = ((r.frontmatter.name as string) ?? r.path).toLowerCase();
                const rCat  = (r.frontmatter.category as string ?? '').toLowerCase();
                const pathLower = r.path.toLowerCase();
                
                const matchName = !query || name.includes(query);
                const matchCat = category === 'all' || rCat === category || pathLower.includes(`/${category}/`);
                
                return matchName && matchCat;
            });

            if (filtered.length === 0) {
                resultsContainer.createDiv({
                    text: 'No recipes found.',
                    attr: { style: 'padding:16px; color:var(--text-muted); text-align:center;' }
                });
                return;
            }

            filtered.forEach(recipe => {
                let name = recipe.frontmatter.name as string | undefined;
                if (!name) {
                    const parts = recipe.path.split('/');
                    name = parts[parts.length - 1].replace(/\.md$/i, '');
                }
                
                const calories = (recipe.frontmatter as any).calories || recipe.frontmatter.calorie_estimate_kcal || 0;
                const rCategory = recipe.frontmatter.category || 'uncategorized';

                const item = resultsContainer.createDiv('pantry-search-result-item');
                item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer;';
                
                const info = item.createDiv({ attr: { style: 'flex:1;' } });
                info.createEl('div', { text: name, cls: 'pantry-search-result-name' });
                info.createEl('div', {
                    text: `${rCategory} · ~${Math.round(calories)} ${this.settings.energyUnit}`,
                    attr: { style: 'font-size:12px; color:var(--text-muted);' }
                });

                const addBtn = item.createEl('button', { text: '+ Add', cls: 'pantry-btn pantry-btn-secondary pantry-btn-small' });
                addBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.addFood(name!);
                };
                
                item.onclick = () => this.addFood(name!);
            });
        };

        let debounce: NodeJS.Timeout | null = null;
        input.oninput = () => {
            this.searchQuery = input.value;
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(renderResults, 300);
        };
        
        select.onchange = () => {
            this.categoryFilter = select.value;
            renderResults();
        };

        renderResults();

        // Right side: Current Plan
        const planArea = layout.createDiv({ cls: "planner-summary" });
        planArea.createEl("h3", { text: "📋 Current Plan" });
        
        this.currentPlanContainer = planArea.createDiv("pantry-current-plan");
        this.currentPlanContainer.style.maxHeight = '400px';
        this.currentPlanContainer.style.overflowY = 'auto';
        
        this.renderCurrentPlan();

        // Footer Actions
        const buttonGroup = contentEl.createDiv("button-group");
        buttonGroup.style.marginTop = "20px";
        
        const saveBtn = buttonGroup.createEl("button", { text: "Save Changes", cls: "primary" });
        saveBtn.onclick = () => {
            this.onSave(this.currentFoods.filter(f => f.servings > 0));
            this.close();
        };

        const cancelBtn = buttonGroup.createEl("button", { text: "Cancel", cls: "secondary" });
        cancelBtn.onclick = () => this.close();
    }

    private currentPlanContainer: HTMLElement;

    private addFood(name: string) {
        const existing = this.currentFoods.find(f => f.name === name);
        if (existing) {
            existing.servings++;
        } else {
            this.currentFoods.push({ name, servings: 1 });
        }
        this.renderCurrentPlan();
    }

    private updateServing(index: number, delta: number) {
        this.currentFoods[index].servings += delta;
        if (this.currentFoods[index].servings <= 0) {
            this.currentFoods.splice(index, 1);
        }
        this.renderCurrentPlan();
    }

    private renderCurrentPlan() {
        if (!this.currentPlanContainer) return;
        this.currentPlanContainer.empty();

        if (this.currentFoods.length === 0) {
            this.currentPlanContainer.createDiv({
                text: 'Your plan is empty. Add recipes from the left.',
                attr: { style: 'padding:16px; color:var(--text-muted); text-align:center; font-style: italic;' }
            });
            return;
        }

        this.currentFoods.forEach((item, i) => {
            const row = this.currentPlanContainer.createDiv({ cls: 'scheduler-row' });
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '12px';
            row.style.marginBottom = '6px';
            
            const nameEl = row.createEl('span', { text: item.name, cls: 'scheduler-recipe-name' });
            nameEl.style.flex = '1';
            
            const counter = row.createDiv({ cls: 'scheduler-counter' });
            counter.style.display = 'flex';
            counter.style.alignItems = 'center';
            counter.style.gap = '8px';
            
            counter.createEl('span', { text: `×${item.servings}`, cls: 'scheduler-counter-value' });
            
            const editBtn = counter.createSpan({ cls: 'tracker-table__edit-icon' });
            editBtn.style.cursor = 'pointer';
            editBtn.style.marginLeft = '8px';
            setIcon(editBtn, 'pencil');

            editBtn.onclick = () => {
                const recipe = this.allRecipes.find(r => 
                    r.frontmatter.name === item.name || 
                    r.path.endsWith(item.name + '.md') ||
                    item.name === r.path.split('/').pop()?.replace('.md', '')
                );
                
                if (recipe) {
                    new EditWeeklyServingModal(
                        this.app,
                        item.name,
                        recipe.frontmatter,
                        item.servings,
                        this.settings,
                        (newServings) => {
                            if (newServings <= 0) {
                                this.currentFoods.splice(i, 1);
                            } else {
                                this.currentFoods[i].servings = newServings;
                            }
                            this.renderCurrentPlan();
                        }
                    ).open();
                } else {
                    new Notice("Recipe details not found.");
                }
            };
            
            const deleteBtn = counter.createEl('button', { text: '🗑', cls: 'scheduler-counter-btn' });
            deleteBtn.style.color = 'var(--text-error)';
            deleteBtn.style.borderColor = 'transparent';
            deleteBtn.style.background = 'transparent';
            deleteBtn.onclick = () => {
                this.currentFoods.splice(i, 1);
                this.renderCurrentPlan();
            };
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}
