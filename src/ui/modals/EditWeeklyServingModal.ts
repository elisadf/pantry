import { App, Modal, Setting } from "obsidian";
import { FoodItemFrontmatter } from "../../services/RecipeFileManager";
import { PantryPluginSettings } from "../../settings";
import { CategoryItemServings } from "../../data/CategoriesData";
import { calculateMacros } from "../../calculators/macroCalculators";

export class EditWeeklyServingModal extends Modal {
    private item: CategoryItemServings;
    private frontmatter: FoodItemFrontmatter;
    private newServings: number;
    private categories: string[];
    private selectedCategory: string;
    private onConfirm: (newServings: number, newCategory: string) => void;
    private previewContainer: HTMLElement;
    private settings: PantryPluginSettings;

    constructor(
        app: App,
        item: CategoryItemServings,
        frontmatter: FoodItemFrontmatter,
        categories: string[],
        settings: PantryPluginSettings,
        onConfirm: (newServings: number, newCategory: string) => void
    ) {
        super(app);
        this.item = item;
        this.frontmatter = frontmatter;
        this.newServings = item.servings;
        this.categories = categories;

        let initialCategory = (this.item.category || this.frontmatter.category || 'Uncategorized').trim();
        initialCategory = initialCategory.charAt(0).toUpperCase() + initialCategory.slice(1);
        this.selectedCategory = initialCategory;

        this.settings = settings;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: `Edit Weekly Quantity` });
        contentEl.createEl("h3", { text: this.item.name, cls: "serving-size-modal-recipe-name" });

        const counterContainer = contentEl.createDiv({ cls: 'scheduler-counter' });
        counterContainer.style.justifyContent = 'center';
        counterContainer.style.marginBottom = '20px';

        const minusBtn = counterContainer.createEl('button', { text: '−', cls: 'scheduler-counter-btn' });
        const countEl = counterContainer.createEl('span', { text: `×${this.newServings}`, cls: 'scheduler-counter-value' });
        const plusBtn = counterContainer.createEl('button', { text: '+', cls: 'scheduler-counter-btn' });

        minusBtn.onclick = () => {
            if (this.newServings > 0) {
                this.newServings--;
                countEl.setText(`×${this.newServings}`);
                this.renderPreview();
            }
        };

        plusBtn.onclick = () => {
            if (this.newServings < 14) { // reasonable max
                this.newServings++;
                countEl.setText(`×${this.newServings}`);
                this.renderPreview();
            }
        };

        this.previewContainer = contentEl.createDiv({ cls: "serving-size-preview" });
        this.renderPreview();

        // Add Category dropdown
        new Setting(contentEl)
            .setName("Category")
            .setDesc("The section this recipe belongs to in your plan.")
            .addDropdown(dropdown => {
                const uniqueCategories = new Set(this.categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)));
                uniqueCategories.add('Uncategorized');
                
                uniqueCategories.forEach(cat => {
                    dropdown.addOption(cat, cat);
                });

                if (!uniqueCategories.has(this.selectedCategory)) {
                    dropdown.addOption(this.selectedCategory, this.selectedCategory);
                }

                dropdown.setValue(this.selectedCategory);
                dropdown.onChange(value => {
                    this.selectedCategory = value;
                });
            });

        const buttonContainer = contentEl.createDiv({ cls: "serving-size-modal-buttons" });
        buttonContainer.style.marginTop = '20px';
        
        const saveButton = buttonContainer.createEl("button", { text: "Save", cls: "mod-cta" });
        saveButton.onclick = () => {
            this.onConfirm(this.newServings, this.selectedCategory);
            this.close();
        };

        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.onclick = () => {
            this.close();
        };
    }

    private renderPreview() {
        this.previewContainer.empty();
        this.previewContainer.createEl("h4", { text: "Weekly Macros Preview" });
        
        const grid = this.previewContainer.createDiv({ cls: "serving-size-preview-grid" });
        
        const renderMacro = (label: string, value: number, unit: string) => {
            const row = grid.createDiv({ cls: "serving-size-preview-row" });
            row.createSpan({ text: label, cls: "serving-size-preview-label" });
            row.createSpan({ text: `${value}${unit}`, cls: "serving-size-preview-value" });
        };

        const calMultiplier = this.settings.energyUnit === 'kcal' ? 1 : 4.184;
        const calUnit = this.settings.energyUnit === 'kcal' ? 'kcal' : 'kJ';

        // Use calculateMacros to handle correct serving_size parsing
        // We pass the frontmatter as the "recipe" and construct a pseudo-entry
        const macroData = calculateMacros(
            { name: this.item.name, units: undefined, category: '' } as any, // no custom serving size here, just calculate for 1 portion based on recipe serving_size 
            this.frontmatter
        );

        const baseCals = (macroData?.macros.calories || 0) * calMultiplier;
        const baseProtein = macroData?.macros.protein || 0;
        const baseFat = macroData?.macros.fat || 0;
        const baseCarbs = macroData?.macros.carbs || 0;
        const baseFibre = macroData?.macros.fibre || 0;

        renderMacro("Energy", Math.round(baseCals * this.newServings), ` ${calUnit}`);
        renderMacro("Protein", Math.round(baseProtein * this.newServings * 10) / 10, "g");
        renderMacro("Fat", Math.round(baseFat * this.newServings * 10) / 10, "g");
        renderMacro("Carbs", Math.round(baseCarbs * this.newServings * 10) / 10, "g");
        renderMacro("Fibre", Math.round(baseFibre * this.newServings * 10) / 10, "g");
    }

    onClose() {
        this.contentEl.empty();
    }
}
