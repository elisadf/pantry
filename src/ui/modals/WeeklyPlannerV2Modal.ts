import { App, Modal, Notice, setIcon } from "obsidian";
import { RecipeFileManager, FoodItemFrontmatter } from "../../services/RecipeFileManager";
import { WeeklyNoteManager } from "../../services/WeeklyNoteManager";
import { calculateWeeklyBalance, generateWeeklySummaryCodeblock } from "../../calculators/weeklyBalance";
import { PantryPluginSettings } from "../../settings";
import { WeeklyFoodItem } from "../../data/WeeklyPlannerData";
import { EditWeeklyServingModal } from "./EditWeeklyServingModal";
import { MarkdownSettingsService } from "../../services/MarkdownSettingsService";

export class WeeklyPlannerV2Modal extends Modal {
    private recipeManager: RecipeFileManager;
    private noteManager: WeeklyNoteManager;
    private settings: PantryPluginSettings;
    private markdownSettingsService: MarkdownSettingsService;
    
    private allRecipes: { path: string; frontmatter: FoodItemFrontmatter }[] = [];
    private selectedRecipes: Map<string, { servings: number; category: string }> = new Map();

    
    private categories: string[] = [];
    private weekString: string;
    private weekOffset: number = 1; // default next week — user plans Saturday for following week
    private isLoading: boolean = true;

    constructor(
        app: App, 
        recipeManager: RecipeFileManager, 
        noteManager: WeeklyNoteManager,
        settings: PantryPluginSettings,
        markdownSettingsService: MarkdownSettingsService
    ) {
        super(app);
        this.recipeManager = recipeManager;
        this.noteManager = noteManager;
        this.settings = settings;
        this.markdownSettingsService = markdownSettingsService;
        this.weekString = this.getWeekString(this.weekOffset);
    }

    private getWeekString(offset: number): string {
        const now = new Date();
        now.setDate(now.getDate() + offset * 7);
        const year = now.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const weekNum = Math.ceil(
            ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
        );
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }

    async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("nutrition-planner-modal");
        this.contentEl.createEl("h2", { text: `Plan V2 for ${this.weekString}` });
        this.contentEl.createEl("p", { text: "Loading recipes..." });

        try {
            this.allRecipes = await this.recipeManager.getAllRecipes();
            const settingsData = await this.markdownSettingsService.loadSettings();
            this.categories = settingsData?.categories || [];
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

        const titleRow = contentEl.createDiv({ cls: 'planner-title-row' });

        const prevBtn = titleRow.createEl('button', { text: '‹', cls: 'pantry-week-nav-btn' });
        prevBtn.onclick = () => { this.weekOffset--; this.weekString = this.getWeekString(this.weekOffset); this.display(); };

        const weekBadge = titleRow.createDiv({ cls: 'planner-week-badge' });
        weekBadge.createEl('span', { text: 'WEEKLY PLAN V2', cls: 'planner-week-label' });
        weekBadge.createEl('span', { text: this.weekString, cls: 'planner-week-value' });

        const nextBtn = titleRow.createEl('button', { text: '›', cls: 'pantry-week-nav-btn' });
        nextBtn.onclick = () => { this.weekOffset++; this.weekString = this.getWeekString(this.weekOffset); this.display(); };

        if (this.isLoading) {
            contentEl.createEl("p", { text: "Loading..." });
            return;
        }

        const layout = contentEl.createDiv({ cls: "planner-layout" });

        // Left side: Selection
        const selectionArea = layout.createDiv({ cls: "planner-selection" });
        
        selectionArea.createEl("h3", { text: "👩‍🍳 Select Recipes", cls: "planner-section-heading" });

        // Search + category filter row
        const filtersContainer = selectionArea.createDiv({
            attr: { style: 'display:flex; gap:8px; margin-bottom:12px;' }
        });
        const searchContainer = filtersContainer.createDiv({
            cls: 'pantry-input-group', attr: { style: 'flex:1; margin-bottom:0;' }
        });
        const input = searchContainer.createEl('input', { type: 'text', cls: 'pantry-search-input' });
        input.placeholder = 'Search recipes by name...';
        searchContainer.createDiv({ text: '🔍', cls: 'pantry-input-icon' });

        const select = filtersContainer.createEl('select', {
            cls: 'pantry-form-input', attr: { style: 'width:auto;' }
        });
        const dropdownCategories = ['Search from folder', ...this.categories];
        dropdownCategories.forEach(cat => {
            select.createEl('option', { text: cat, value: cat === 'Search from folder' ? 'All' : cat });
        });

        // Scrollable results
        const resultsContainer = selectionArea.createDiv('pantry-search-results');
        resultsContainer.style.maxHeight = '400px';
        resultsContainer.style.overflowY = 'auto';

        // Filter logic
        let searchQuery = '';
        let categoryFilter = 'all';
        const getFiltered = () => {
            const query = searchQuery.toLowerCase().trim();
            const category = categoryFilter.toLowerCase();
            return this.allRecipes.filter(r => {
                const name = ((r.frontmatter.name as string) ?? r.path).toLowerCase();
                const rCat  = (r.frontmatter.category as string ?? '').toLowerCase();
                const pathLower = r.path.toLowerCase();
                
                const matchName = !query || name.includes(query);
                
                // Match either the explicit frontmatter category or check if the file lives in a folder matching the category
                const matchCat = category === 'all' || rCat === category || pathLower.includes(`/${category}/`);
                
                return matchName && matchCat;
            });
        };

        // Debounced search
        let debounce: NodeJS.Timeout | null = null;
        input.oninput = () => {
            searchQuery = input.value;
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => this.renderList(resultsContainer, getFiltered()), 300);
        };
        select.onchange = () => {
            categoryFilter = select.value;
            this.renderList(resultsContainer, getFiltered());
        };

        this.renderList(resultsContainer, this.allRecipes);

        const buttonGroup = contentEl.createDiv("button-group");
        const createBtn = buttonGroup.createEl("button", { text: "Create Weekly Plan", cls: "primary" });
        createBtn.onclick = () => this.handleCreate();

        const cancelBtn = buttonGroup.createEl("button", { text: "Cancel", cls: "secondary" });
        cancelBtn.onclick = () => this.close();
    }

    private async handleCreate() {
        if (this.selectedRecipes.size === 0) {
            new Notice('Please select at least one recipe.');
            return;
        }

        const selectedDocs = this.allRecipes.filter(r => this.selectedRecipes.has(r.path));
        const recipesForScheduler = selectedDocs.map(r => {
            let name = r.frontmatter.name as string | undefined;
            if (!name) {
                const parts = r.path.split('/');
                name = parts[parts.length - 1].replace(/\.md$/i, '');
            }
            const selectionData = this.selectedRecipes.get(r.path)!;
            return { 
                path: r.path, 
                name, 
                frontmatter: r.frontmatter,
                servings: selectionData.servings,
                category: selectionData.category
            };
        });

        const stats = calculateWeeklyBalance(
            recipesForScheduler.map(s => ({ frontmatter: s.frontmatter, servings: s.servings })),
            this.settings.dailyCalorieTarget,
            this.settings.dailyProteinTarget,
            this.settings.dailyFatTarget,
            this.settings.dailyCarbsTarget,
            this.settings.fibreTargetPerDay
        );

        try {
            const path = await this.noteManager.createWeeklyNoteV2(
                this.weekString,
                recipesForScheduler as (WeeklyFoodItem & { path: string })[],
                '',
                generateWeeklySummaryCodeblock(stats, this.settings.energyUnit)
            );
            new Notice(`Created weekly plan: ${path}`);
            this.close();
        } catch (error: any) {
            new Notice(`Error creating note: ${error.message}`);
        }
    }

    onClose() {
        this.contentEl.empty();
    }

    private renderBar(
        container: HTMLElement,
        label: string,
        pct: number,
        current: number,
        target: number,
        unit: string
    ) {
        const row = container.createDiv({ cls: 'macro-bar-row' });
        row.createSpan({ text: label, cls: 'macro-bar-label' });

        const track = row.createDiv({ cls: 'macro-bar-track' });
        const fill = track.createDiv({ cls: 'macro-bar-fill' });
        fill.style.width = `${Math.min(pct, 100)}%`;
        fill.style.background = pct >= 80
            ? '#1D9E75'
            : pct >= 50
            ? '#BA7517'
            : '#C0392B';

        row.createSpan({
            text: `${Math.round(current)}${unit} / ${Math.round(target)}${unit}`,
            cls: 'macro-bar-value'
        });
    }

    private renderList(
        container: HTMLElement,
        recipes: { path: string; frontmatter: FoodItemFrontmatter }[]
    ) {
        container.empty();
        if (recipes.length === 0) {
            container.createDiv({
                text: 'No recipes found.',
                attr: { style: 'padding:16px; color:var(--text-muted); text-align:center;' }
            });
            return;
        }
        recipes.forEach(recipe => {
            let name = recipe.frontmatter.name as string | undefined;
            if (!name) {
                const parts = recipe.path.split('/');
                name = parts[parts.length - 1].replace(/\.md$/i, '');
            }
            const calories  = (recipe.frontmatter as any).calories
                || recipe.frontmatter.calorie_estimate_kcal || 0;
            const category  = recipe.frontmatter.category || 'uncategorized';
            const isSelected = this.selectedRecipes.has(recipe.path);

            const item = container.createDiv(
                `pantry-search-result-item${isSelected ? ' is-selected' : ''}`
            );
            item.style.cssText = 'display:flex; align-items:center; gap:12px;';

            const cb = item.createEl('input', { type: 'checkbox' });
            cb.checked = isSelected;
            cb.onclick = e => e.stopPropagation();
            const info = item.createDiv({ attr: { style: 'flex:1;' } });
            info.createEl('div', { text: name, cls: 'pantry-search-result-name' });
            info.createEl('div', {
                text: `${category} · ~${Math.round(calories)} ${this.settings.energyUnit}`,
                attr: { style: 'font-size:12px; color:var(--text-muted);' }
            });

            // Pre-create the edit container for all items, but hide it if unselected
            const selectionData = this.selectedRecipes.get(recipe.path) || { servings: 1, category };
            const editContainer = item.createDiv({ attr: { style: 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); margin-right:8px;' } });
            editContainer.style.display = isSelected ? 'flex' : 'none';
            
            const servingsSpan = editContainer.createSpan({ text: `×${selectionData.servings} (${selectionData.category})` });
            
            const editBtn = editContainer.createSpan({ cls: 'tracker-table__edit-icon' });
            editBtn.style.cursor = 'pointer';
            setIcon(editBtn, 'pencil');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                // Get fresh selection data in case it changed
                const currentData = this.selectedRecipes.get(recipe.path)!;
                const weeklyItem: WeeklyFoodItem = {
                    name: name!,
                    servings: currentData.servings,
                    category: currentData.category
                };
                
                new EditWeeklyServingModal(
                    this.app,
                    weeklyItem,
                    recipe.frontmatter,
                    this.markdownSettingsService,
                    this.settings,
                    (newServings, newCategory) => {
                        if (newServings === 0) {
                            this.selectedRecipes.delete(recipe.path);
                            cb.checked = false;
                            item.classList.remove('is-selected');
                            editContainer.style.display = 'none';
                        } else {
                            this.selectedRecipes.set(recipe.path, { servings: newServings, category: newCategory });
                            servingsSpan.innerText = `×${newServings} (${newCategory})`;
                        }
                    }
                ).open();
            };

            const toggleSelection = () => {
                if (this.selectedRecipes.has(recipe.path)) {
                    this.selectedRecipes.delete(recipe.path);
                    cb.checked = false;
                    item.classList.remove('is-selected');
                    editContainer.style.display = 'none';
                } else {
                    this.selectedRecipes.set(recipe.path, { servings: 1, category });
                    cb.checked = true;
                    item.classList.add('is-selected');
                    servingsSpan.innerText = `×1 (${category})`;
                    editContainer.style.display = 'flex';
                }
            };

            cb.onchange = e => {
                toggleSelection();
                // We must invert the check state because toggleSelection() flips it based on the map
                // but cb.onchange triggers after the checkbox state has already changed natively.
                // It's cleaner to let toggleSelection manage the true state:
                cb.checked = this.selectedRecipes.has(recipe.path); 
            };

            item.onclick = () => {
                toggleSelection();
            };
        });
    }
}
