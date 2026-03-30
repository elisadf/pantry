import { PantryPluginSettings } from '../../settings';
import { MacroAggregate } from '../../services/TrackerProcessor';
import { setIcon } from 'obsidian';

export interface RecipeDetail {
    name: string;
    macros: MacroAggregate | null;
    notFound: boolean;
    servingSize?: number;
    originalServingSize?: number;
    category?: string;
}

export class TrackerTableRenderer {
    
    renderTable(container: HTMLElement, recipeDetails: RecipeDetail[], aggregate: MacroAggregate, settings: PantryPluginSettings, onEditServingSize?: (detail: RecipeDetail) => void, onRemoveRecipe?: (detail: RecipeDetail) => void): void {
        const tableWrapper = container.createDiv({ cls: 'tracker-table-wrapper' });
        const table = tableWrapper.createEl('table', { cls: 'tracker-table' });
        
        this.renderHeader(table);
        this.renderBody(table, recipeDetails, aggregate, settings, onEditServingSize, onRemoveRecipe);
    }

    private renderHeader(table: HTMLElement): void {
        const thead = table.createEl('thead', { cls: 'tracker-table__head' });
        const row = thead.createEl('tr', { cls: 'tracker-table__row tracker-table__row--header' });
        
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--recipe', text: 'Food' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--calories', text: 'Calories' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--protein', text: 'Protein' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--fat', text: 'Fat' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--carbs', text: 'Carbs' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--fibre', text: 'Fibre' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--actions', text: '' });
    }

    private renderBody(table: HTMLElement, recipeDetails: RecipeDetail[], aggregate: MacroAggregate, settings: PantryPluginSettings, onEditServingSize?: (detail: RecipeDetail) => void, onRemoveRecipe?: (detail: RecipeDetail) => void): void {
        const tbody = table.createEl('tbody', { cls: 'tracker-table__body' });

        // Group recipes by category
        const categoryGroups: Record<string, RecipeDetail[]> = {};
        const categoryOrder: string[] = [];
        
        for (const detail of recipeDetails) {
            const category = detail.category || 'Uncategorized';
            if (!categoryGroups[category]) {
                categoryGroups[category] = [];
                categoryOrder.push(category);
            }
            categoryGroups[category].push(detail);
        }

        // Individual Recipe Rows
        for (const category of categoryOrder) {
            const groupDetails = categoryGroups[category];

            // Render Meal Header
            if (category !== 'Uncategorized' || categoryOrder.length > 1) {
                // Calculate category totals
                const categoryTotals: MacroAggregate = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
                for (const detail of groupDetails) {
                    if (detail.macros) {
                        categoryTotals.calories += detail.macros.calories;
                        categoryTotals.protein += detail.macros.protein;
                        categoryTotals.fat += detail.macros.fat;
                        categoryTotals.carbs += detail.macros.carbs;
                        categoryTotals.fibre += detail.macros.fibre;
                    }
                }

                const headerRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__category-header collapsed' });
                const nameCell = headerRow.createEl('td', { 
                    cls: 'tracker-table__cell tracker-table__category-header-cell',
                });
                
                const toggleIcon = nameCell.createSpan({ cls: 'tracker-table__category-toggle', text: '▶' });
                nameCell.createSpan({ cls: 'tracker-table__category-name', text: category });

                const renderMealMacro = (val: number, unit: string, type: string) => {
                    const cell = headerRow.createEl('td', { cls: `tracker-table__cell tracker-table__category-header-cell tracker-table__category-macro-total tracker-table__cell--numeric tracker-table__cell--${type}` });
                    const wrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
                    wrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(val) });
                    wrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });
                };

                renderMealMacro(categoryTotals.calories, settings.energyUnit, 'calories');
                renderMealMacro(categoryTotals.protein, 'g', 'protein');
                renderMealMacro(categoryTotals.fat, 'g', 'fat');
                renderMealMacro(categoryTotals.carbs, 'g', 'carbs');
                renderMealMacro(categoryTotals.fibre, 'g', 'fibre');
                
                // Empty cell for the actions column
                headerRow.createEl('td', { cls: 'tracker-table__cell tracker-table__category-header-cell tracker-table__cell--actions' });

                // Add toggle logic
                headerRow.onclick = () => {
                    const isCollapsed = headerRow.classList.toggle('collapsed');
                    toggleIcon.innerText = isCollapsed ? '▶' : '▼';
                    const rows = tbody.querySelectorAll(`.tracker-table__row[data-category="${CSS.escape(category)}"]`);
                    rows.forEach(r => {
                        (r as HTMLElement).style.display = isCollapsed ? 'none' : '';
                    });
                };
            }

            for (const detail of groupDetails) {
                const row = tbody.createEl('tr', { 
                    cls: 'tracker-table__row',
                    attr: { 'data-category': category }
                });
                // Initialize as hidden if it's in a categorised group
                if (category !== 'Uncategorized' || categoryOrder.length > 1) {
                    row.style.display = 'none';
                }
                
                // Recipe Name Cell
                const nameCell = row.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--recipe-name' });
                nameCell.createSpan({ text: detail.name });

                // Always show the serving size if we have macros (meaning it was calculated)
                // Fallback to 100 if servingSize is somehow falsy
                if (!detail.notFound && detail.macros) {
                    const displaySize = detail.servingSize || detail.originalServingSize || 100;
                    
                    const servingSizeSpan = nameCell.createSpan({ cls: 'tracker-table__serving-size' });
                    servingSizeSpan.createSpan({ text: ` (${displaySize}g)` });

                    if (onEditServingSize) {
                        const editIcon = servingSizeSpan.createSpan({ cls: 'tracker-table__edit-icon' });
                        setIcon(editIcon, 'pencil');
                        editIcon.onclick = () => onEditServingSize(detail);
                    }
                }
                
                if (detail.notFound) {
                    // Render "Not Found" message across the other columns
                    const errorCell = row.createEl('td', { 
                        cls: 'tracker-table__cell tracker-table__cell--error',
                        attr: { colspan: "6" }
                    });
                    errorCell.createSpan({ text: 'Recipe not found' });
                } else if (detail.macros) {
                    // Render Macro Cells
                    this.renderMacroCell(row, 'calories', detail.macros.calories, settings.dailyCalorieTarget, settings.energyUnit);
                    this.renderMacroCell(row, 'protein', detail.macros.protein, settings.dailyProteinTarget, 'g');
                    this.renderMacroCell(row, 'fat', detail.macros.fat, settings.dailyFatTarget, 'g');
                    this.renderMacroCell(row, 'carbs', detail.macros.carbs, settings.dailyCarbsTarget, 'g');
                    this.renderMacroCell(row, 'fibre', detail.macros.fibre, settings.fibreTargetPerDay, 'g');
                    
                    // Render Actions Cell
                    const actionsCell = row.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--actions' });
                    if (onRemoveRecipe) {
                        const removeIcon = actionsCell.createSpan({ cls: 'tracker-table__remove-icon' });
                        setIcon(removeIcon, 'trash');
                        removeIcon.style.cursor = 'pointer';
                        removeIcon.style.marginLeft = '8px';
                        removeIcon.style.color = 'var(--text-error)';
                        removeIcon.onclick = () => onRemoveRecipe(detail);
                    }
                } else {
                    // Render "Invalid Serving" message
                    const errorCell = row.createEl('td', { 
                        cls: 'tracker-table__cell tracker-table__cell--error',
                        attr: { colspan: "6" }
                    });
                    errorCell.createSpan({ text: 'Invalid serving size' });
                }
            }
        }

        // Totals Row
        const totalRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__row--total' });
        totalRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Totals' });
        
        this.renderTotalCell(totalRow, 'calories', aggregate.calories, settings.energyUnit);
        this.renderTotalCell(totalRow, 'protein', aggregate.protein, 'g');
        this.renderTotalCell(totalRow, 'fat', aggregate.fat, 'g');
        this.renderTotalCell(totalRow, 'carbs', aggregate.carbs, 'g');
        this.renderTotalCell(totalRow, 'fibre', aggregate.fibre, 'g');
        totalRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--actions' });

        // Targets Row
        const targetRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__row--target' });
        targetRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Targets' });
        
        this.renderTargetCell(targetRow, 'calories', settings.dailyCalorieTarget, settings.energyUnit, aggregate.calories);
        this.renderTargetCell(targetRow, 'protein', settings.dailyProteinTarget, 'g', aggregate.protein);
        this.renderTargetCell(targetRow, 'fat', settings.dailyFatTarget, 'g', aggregate.fat);
        this.renderTargetCell(targetRow, 'carbs', settings.dailyCarbsTarget, 'g', aggregate.carbs);
        this.renderTargetCell(targetRow, 'fibre', settings.fibreTargetPerDay, 'g', aggregate.fibre);
        targetRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--actions' });

        // Remaining Row
        const remainingRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__row--remaining' });
        remainingRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Remaining' });
        
        this.renderRemainingCell(remainingRow, 'calories', settings.dailyCalorieTarget - aggregate.calories, settings.energyUnit);
        this.renderRemainingCell(remainingRow, 'protein', settings.dailyProteinTarget - aggregate.protein, 'g');
        this.renderRemainingCell(remainingRow, 'fat', settings.dailyFatTarget - aggregate.fat, 'g');
        this.renderRemainingCell(remainingRow, 'carbs', settings.dailyCarbsTarget - aggregate.carbs, 'g');
        this.renderRemainingCell(remainingRow, 'fibre', settings.fibreTargetPerDay - aggregate.fibre, 'g');
        remainingRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--actions' });
    }

    private formatNumber(val: number): string {
        return val % 1 !== 0 ? val.toFixed(1) : val.toString();
    }

    private getMacroColors(type: string): { base: string, lighter: string } {
        switch (type) {
            case 'calories': return { base: '#8E44AD', lighter: '#C39BD3' };
            case 'protein': return { base: '#27AE60', lighter: '#A9DFBF' };
            case 'fat': return { base: '#f1c21b', lighter: '#F7DC6F' };
            case 'carbs': return { base: '#3498DB', lighter: '#AED6F1' };
            case 'fibre': return { base: '#F39C12', lighter: '#FAD7A1' };
            default: return { base: '#95A5A6', lighter: '#D5DBDB' };
        }
    }

    private renderMacroCell(row: HTMLElement, type: string, value: number, target: number, unit: string): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--${type}` });
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(value) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });

        const percentage = target > 0 ? Math.round((value / target) * 100) : 0;
        valueWrapper.createSpan({ cls: 'tracker-table__percentage', text: ` (${percentage}%)` });

        // Tiny inline progress bar
        const fillWidth = Math.min(percentage, 100);
        const isOverload = value > target;
        const colors = this.getMacroColors(type);

        const barContainer = cell.createDiv({ cls: `tracker-table__bar tracker-table__bar--${type}` });
        const fill = barContainer.createDiv({ 
            cls: 'tracker-table__bar-fill',
            attr: { style: `width: ${fillWidth}%;` }
        });

        if (isOverload) {
            fill.style.background = `repeating-linear-gradient(
                45deg,
                ${colors.base},
                ${colors.base} 4px,
                ${colors.lighter} 4px,
                ${colors.lighter} 8px
            )`;
        } else {
            fill.style.backgroundColor = colors.base;
        }
    }

    private renderTotalCell(row: HTMLElement, type: string, value: number, unit: string): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--total-value tracker-table__cell--${type}` });
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(value) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });
    }

    private renderTargetCell(row: HTMLElement, type: string, target: number, unit: string, current: number): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--target-value tracker-table__cell--${type}` });
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(target) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });

        const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
        const fillWidth = Math.min(percentage, 100);
        const isOverload = current > target;
        const colors = this.getMacroColors(type);
        
        const barContainer = cell.createDiv({ cls: `tracker-table__bar tracker-table__bar--${type}` });
        const fill = barContainer.createDiv({ 
            cls: 'tracker-table__bar-fill',
            attr: { style: `width: ${fillWidth}%;` }
        });

        if (isOverload) {
            fill.style.background = `repeating-linear-gradient(
                45deg,
                ${colors.base},
                ${colors.base} 4px,
                ${colors.lighter} 4px,
                ${colors.lighter} 8px
            )`;
        } else {
            fill.style.backgroundColor = colors.base;
        }

        cell.createDiv({ cls: 'tracker-table__target-percentage', text: `${percentage}%` });
    }

    private renderRemainingCell(row: HTMLElement, type: string, remaining: number, unit: string): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--remaining-value tracker-table__cell--${type}` });
        
        const displayVal = remaining < 0 ? 0 : remaining;
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(displayVal) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });
    }
}