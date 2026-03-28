import { App, Modal, Notice, Component, normalizePath } from 'obsidian';
import PantryPlugin from '../main';
import { createPantryFile, FoodItemInput, sanitiseFileName } from '../core/fileGenerators';
import { convertKcalToKj, convertKjToKcal } from '../calculators/energy';

export class ManualFoodEntryModal extends Modal {
    plugin: PantryPlugin;
    private component: Component;

    // Form elements
    private foodNameInput: HTMLInputElement;
    private servingSizeInput: HTMLInputElement;
    private defaultServingSizeInput: HTMLInputElement;
    private caloriesInput: HTMLInputElement;
    private kjInput: HTMLInputElement;
    private proteinInput: HTMLInputElement;
    private fatInput: HTMLInputElement;
    private carbsInput: HTMLInputElement;
    private fibreInput: HTMLInputElement;

    constructor(app: App, plugin: PantryPlugin) {
        super(app);
        this.plugin = plugin;
        this.component = new Component();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");

        // Use custom header styling from new CSS
        const backBtn = contentEl.createEl("button", { text: "←", cls: "pantry-back-btn" });
        const header = contentEl.createDiv("pantry-modal-header");
        backBtn.onclick = () => {
            this.close();
            import("./AddMenuModal").then(m => new m.AddMenuModal(this.app, (this.app as any).plugins.plugins['obsidian-pantry']).open());
        };

                
        header.createEl("h2", { text: "Manual Food Entry", cls: "pantry-modal-title" });
        header.createEl("p", { text: "Enter the nutritional information for your food item:", cls: "pantry-form-desc" });

        const formContainer = contentEl.createDiv({ cls: 'manual-entry-form' });

        // First row: Name and Servings inline
        const topSection = formContainer.createDiv({ cls: 'pantry-form-row-inline' });

        // Food Name Field
        const nameGroup = topSection.createDiv();
        nameGroup.createEl('label', { text: 'Food Name', cls: 'pantry-form-label required' });
        this.foodNameInput = nameGroup.createEl('input', {
            type: 'text',
            cls: 'pantry-form-input pantry-large-input',
            attr: { placeholder: 'e.g., Chicken Breast', required: 'true' }
        });

        // Serving Size Field
        const servingGroup = topSection.createDiv();
        servingGroup.createEl('label', { text: 'Serving Size (grams)', cls: 'pantry-form-label required' });
        this.servingSizeInput = servingGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input pantry-large-input',
            value: '100',
            attr: { placeholder: '100', min: '0', step: '0.1', required: 'true' }
        });

        // Default Serving Size Field (Full width row)
        const defaultServingGroup = formContainer.createDiv({ cls: 'pantry-form-row' });
        defaultServingGroup.createEl('label', { text: 'Default Serving Size (grams)', cls: 'pantry-form-label' });
        defaultServingGroup.createEl('p', {
            text: 'Optional: Set a custom default serving size for when you add this food to your macros. If not set, it will use the serving size above.',
            cls: 'pantry-form-desc'
        });
        this.defaultServingSizeInput = defaultServingGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: 'Leave empty to use serving size above', min: '0', step: '0.1' }
        });

        // Nutrition Fields
        const nutritionGrid = formContainer.createDiv({ cls: 'pantry-form-grid' });

        // Energy Fields
        const energyContainer = formContainer.createDiv({ cls: 'pantry-form-grid' });
        
        const caloriesGroup = energyContainer.createDiv({ cls: 'pantry-form-row' });
        caloriesGroup.createEl('label', { text: 'Calories (kcal)', cls: 'pantry-form-label required' });
        this.caloriesInput = caloriesGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1', required: 'true' }
        });

        const kjGroup = energyContainer.createDiv({ cls: 'pantry-form-row' });
        kjGroup.createEl('label', { text: 'Energy (kJ)', cls: 'pantry-form-label' });
        this.kjInput = kjGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1' }
        });

        // Setup energy conversion
        this.setupEnergyConversion();

        // Macros Fields
        const macrosGrid = formContainer.createDiv({ cls: 'pantry-form-grid' });

        const proteinGroup = macrosGrid.createDiv({ cls: 'pantry-form-row' });
        proteinGroup.createEl('label', { text: 'Protein (g)', cls: 'pantry-form-label required' });
        this.proteinInput = proteinGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1', required: 'true' }
        });

        const carbsGroup = macrosGrid.createDiv({ cls: 'pantry-form-row' });
        carbsGroup.createEl('label', { text: 'Carbohydrates (g)', cls: 'pantry-form-label required' });
        this.carbsInput = carbsGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1', required: 'true' }
        });

        const fatGroup = macrosGrid.createDiv({ cls: 'pantry-form-row' });
        fatGroup.createEl('label', { text: 'Fat (g)', cls: 'pantry-form-label required' });
        this.fatInput = fatGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1', required: 'true' }
        });

        const fibreGroup = macrosGrid.createDiv({ cls: 'pantry-form-row' });
        fibreGroup.createEl('label', { text: 'Fibre (g)', cls: 'pantry-form-label required' });
        this.fibreInput = fibreGroup.createEl('input', {
            type: 'number',
            cls: 'pantry-form-input',
            attr: { placeholder: '0', min: '0', step: '0.1', required: 'true' }
        });

        const infoDiv = formContainer.createDiv({ cls: 'pantry-form-row' });
        infoDiv.createEl('p', { text: '* Required fields', cls: 'pantry-form-desc', attr: { style: 'font-style: italic;' } });
        infoDiv.createEl('p', { text: 'Energy values are automatically converted between kcal and kJ (1 kcal = 4.184 kJ)', cls: 'pantry-form-desc' });
        infoDiv.createEl('p', { text: 'Tip: Press Shift+Enter to add & continue', cls: 'pantry-form-desc', attr: { style: 'background: var(--background-secondary); padding: 8px; border-radius: 4px; text-align: center;' } });

        this.createActionButtons(formContainer);

        this.foodNameInput.focus();
    }

    private setupEnergyConversion(): void {
        this.component.registerDomEvent(this.caloriesInput, 'input', () => {
            const kcalValue = parseFloat(this.caloriesInput.value);
            if (!isNaN(kcalValue) && kcalValue >= 0) {
                this.kjInput.value = convertKcalToKj(kcalValue).toFixed(1);
            } else if (this.caloriesInput.value === '') {
                this.kjInput.value = '';
            }
        });

        this.component.registerDomEvent(this.kjInput, 'input', () => {
            const kjValue = parseFloat(this.kjInput.value);
            if (!isNaN(kjValue) && kjValue >= 0) {
                this.caloriesInput.value = convertKjToKcal(kjValue).toFixed(1);
            } else if (this.kjInput.value === '') {
                this.caloriesInput.value = '';
            }
        });
    }

    private createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv({ cls: 'pantry-actions' });

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'pantry-btn pantry-btn-secondary'
        });

        const addMoreBtn = buttonContainer.createEl('button', {
            text: 'Add & Continue',
            cls: 'pantry-btn pantry-btn-secondary'
        });

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save Food Item',
            cls: 'pantry-btn pantry-btn-primary'
        });

        this.component.registerDomEvent(cancelBtn, 'click', () => {
            this.close();
        });

        this.component.registerDomEvent(addMoreBtn, 'click', () => {
            this.handleSave(true);
        });

        this.component.registerDomEvent(saveBtn, 'click', () => {
            this.handleSave(false);
        });

        const handleEnterKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.handleSave(true);
                } else {
                    this.handleSave(false);
                }
            }
        };

        [
            this.foodNameInput, this.servingSizeInput, this.defaultServingSizeInput,
            this.caloriesInput, this.kjInput, this.proteinInput,
            this.fatInput, this.carbsInput, this.fibreInput
        ].forEach((input) => {
            this.component.registerDomEvent(input, 'keydown', handleEnterKey);
        });
    }

    private async validateForm(): Promise<{ isValid: boolean; errors: string[] }> {
        const errors: string[] = [];

        if (!this.foodNameInput.value.trim()) errors.push('Food name is required.');
        if (isNaN(parseFloat(this.servingSizeInput.value))) errors.push('Serving size is invalid.');
        if (isNaN(parseFloat(this.caloriesInput.value))) errors.push('Calories are invalid.');
        if (isNaN(parseFloat(this.proteinInput.value))) errors.push('Protein is invalid.');
        if (isNaN(parseFloat(this.fatInput.value))) errors.push('Fat is invalid.');
        if (isNaN(parseFloat(this.carbsInput.value))) errors.push('Carbohydrates are invalid.');
        if (isNaN(parseFloat(this.fibreInput.value))) errors.push('Fibre is invalid.');

        const foodName = this.foodNameInput.value.trim();
        const folderPath = normalizePath(this.plugin.settings.recipeFolder);
        const fileName = `${sanitiseFileName(foodName)}.md`;
        const filePath = normalizePath(`${folderPath}/${fileName}`);

        try {
            const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) {
                errors.push(`A food item named "${foodName}" already exists.`);
            }
        } catch (error) {}

        return { isValid: errors.length === 0, errors };
    }

    private showValidationErrors(errors: string[]): void {
        const existingErrorContainer = this.contentEl.querySelector('.validation-errors');
        if (existingErrorContainer) {
            existingErrorContainer.remove();
        }

        const formContainer = this.contentEl.querySelector('.manual-entry-form');
        if (formContainer) {
            const errorsDiv = formContainer.createDiv({ cls: 'validation-errors error-message' });
            errors.forEach((error) => {
                errorsDiv.createEl('p', { text: error, attr: { style: 'margin: 0;' } });
            });
        }
    }

    private async handleSave(addMore: boolean): Promise<void> {
        const validation = await this.validateForm();
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        try {
            await this.saveCurrentItem();
            new Notice(`Successfully saved ${this.foodNameInput.value.trim()}`);
            
            if (addMore) {
                this.clearForm();
                this.foodNameInput.focus();
            } else {
                this.close();
            }
        } catch (error) {
            console.error("Error saving food:", error);
            new Notice("Failed to save food item.");
        }
    }

    private async saveCurrentItem(): Promise<void> {
        const foodName = this.foodNameInput.value.trim();
        const servingSize = this.servingSizeInput.value.trim();
        
        const foodInput: FoodItemInput = {
            name: foodName,
            protein: parseFloat(this.proteinInput.value) || 0,
            carbs: parseFloat(this.carbsInput.value) || 0,
            fat: parseFloat(this.fatInput.value) || 0,
            fibre: this.fibreInput.value ? parseFloat(this.fibreInput.value) : 0,
            calories: parseFloat(this.caloriesInput.value) || 0,
            serving_size: `${servingSize}g`,
            source: "manual"
        };

        const folderPath = normalizePath(this.plugin.settings.recipeFolder);
        await createPantryFile(foodInput, this.app, folderPath);
    }

    private clearForm(): void {
        this.foodNameInput.value = '';
        this.servingSizeInput.value = '100';
        this.defaultServingSizeInput.value = '';
        this.caloriesInput.value = '';
        this.kjInput.value = '';
        this.proteinInput.value = '';
        this.fatInput.value = '';
        this.carbsInput.value = '';
        this.fibreInput.value = '';

        const errorContainer = this.contentEl.querySelector('.validation-errors');
        if (errorContainer) {
            errorContainer.remove();
        }
    }

    onClose() {
        this.component.unload();
        this.contentEl.empty();
    }
}
