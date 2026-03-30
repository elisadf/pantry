import { PantryPluginSettings } from '../../settings';
import { DailyAggregate, MacroAggregate, WeeklyData } from '../../services/TrackerProcessor';
import { calculateRollingAverage } from '../../calculators/rollingAverage';
import { calculateMacroRatios } from '../../calculators/macroRatios';

type MacroType = 'calories' | 'protein' | 'fat' | 'carbs' | 'fibre';

export class WeeklyTrackerRenderer {
    
    /**
     * Renders the complete weekly tracker widget
     */
    render(container: HTMLElement, weeklyData: WeeklyData, settings: PantryPluginSettings): void {
        const widget = container.createDiv({ cls: 'tracker-widget tracker-widget--weekly' });
        
        this.renderHeader(widget, weeklyData.weekRange);
        this.renderCards(widget, weeklyData.aggregate, weeklyData.targets, settings);
        this.renderMacroRatios(widget, weeklyData.aggregate);
        this.renderDailyTable(widget, weeklyData.dailyBreakdown, weeklyData.aggregate, weeklyData.targets, settings);
    }

    private renderHeader(container: HTMLElement, weekRange: string): void {
        const header = container.createDiv({ 
            cls: 'tracker-widget__header'
        });
        
        header.createSpan({ text: `Week Macros (${weekRange})` });
    }

    private renderCards(container: HTMLElement, aggregate: MacroAggregate, targets: MacroAggregate, settings: PantryPluginSettings): void {
        const cardsContainer = container.createDiv({ cls: 'tracker-widget__cards' });

        this.renderCard(
            cardsContainer, 
            'calories', 
            'Calories', 
            aggregate.calories, 
            targets.calories, 
            settings.energyUnit
        );

        this.renderCard(
            cardsContainer, 
            'protein', 
            'Protein', 
            aggregate.protein, 
            targets.protein, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'fat', 
            'Fat', 
            aggregate.fat, 
            targets.fat, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'carbs', 
            'Carbs', 
            aggregate.carbs, 
            targets.carbs, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'fibre', 
            'Fibre', 
            aggregate.fibre, 
            targets.fibre, 
            'g'
        );
    }

    private renderMacroRatios(container: HTMLElement, aggregate: MacroAggregate): void {
        const ratiosContainer = container.createDiv({ cls: 'tracker-widget__ratios' });
        ratiosContainer.createEl('h4', { text: 'MACRO RATIOS', cls: 'macro-ratios-title' });

        const ratios = calculateMacroRatios(aggregate);

        const cardsWrap = ratiosContainer.createDiv({ cls: 'macro-ratios-cards' });
        
        this.renderRatioCard(cardsWrap, 'protein', 'PROTEIN %', ratios.proteinPct);
        this.renderRatioCard(cardsWrap, 'fat', 'FAT %', ratios.fatPct);
        this.renderRatioCard(cardsWrap, 'carbs', 'CARBS %', ratios.carbsPct);
        // Fibre isn't in the mock but we'll include it if there's any fibre or standard
        this.renderRatioCard(cardsWrap, 'fibre', 'FIBRE %', ratios.fibrePct);
    }

    private renderRatioCard(container: HTMLElement, type: string, label: string, percentage: number): void {
        const card = container.createDiv({ cls: `macro-ratio-card macro-ratio-card--${type}` });
        const content = card.createDiv({ cls: 'macro-ratio-card__content' });
        content.createDiv({ cls: 'macro-ratio-card__label', text: label });
        content.createDiv({ cls: 'macro-ratio-card__value', text: `${percentage}%` });
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

    private renderCard(
        container: HTMLElement, 
        type: MacroType, 
        label: string, 
        current: number, 
        target: number,
        unit: string
    ): void {
        const card = container.createDiv({ cls: `tracker-card tracker-card--${type}` });
        
        const content = card.createDiv({ cls: 'tracker-card__content' });
        
        content.createDiv({ cls: 'tracker-card__name', text: label });

        const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
        const fillWidth = Math.min(percentage, 100);
        const isOverload = current > target;
        const colors = this.getMacroColors(type);

        const valueRow = content.createDiv({ cls: 'tracker-card__value-row' });
        
        const formattedCurrent = current % 1 !== 0 ? current.toFixed(1) : current.toString();
        
        const valCol = valueRow.createDiv({ cls: 'tracker-card__value-col' });
        valCol.createSpan({ cls: 'tracker-card__val', text: formattedCurrent });
        valCol.createSpan({ cls: 'tracker-card__unit', text: ` ${unit}` });

        valueRow.createDiv({ cls: 'tracker-card__percentage', text: `${percentage}%` });

        const barContainer = content.createDiv({ cls: 'tracker-card__bar' });
        const fill = barContainer.createDiv({ 
            cls: 'tracker-card__bar-fill',
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

    private renderDailyTable(container: HTMLElement, dailyBreakdown: DailyAggregate[], aggregate: MacroAggregate, targets: MacroAggregate, settings: PantryPluginSettings): void {
        const tableWrapper = container.createDiv({ cls: 'tracker-table-wrapper' });
        const table = tableWrapper.createEl('table', { cls: 'tracker-table tracker-weekly-table' });
        
        this.renderTableHeader(table);
        this.renderTableBody(table, dailyBreakdown, aggregate, targets, settings);
    }

    private renderTableHeader(table: HTMLElement): void {
        const thead = table.createEl('thead', { cls: 'tracker-table__head' });
        const row = thead.createEl('tr', { cls: 'tracker-table__row tracker-table__row--header' });
        
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--date', text: 'Date' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--calories', text: 'Calories' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--protein', text: 'Protein' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--fat', text: 'Fat' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--carbs', text: 'Carbs' });
        row.createEl('th', { cls: 'tracker-table__cell tracker-table__cell--header tracker-table__cell--fibre', text: 'Fibre' });
    }

    private renderTableBody(table: HTMLElement, dailyBreakdown: DailyAggregate[], aggregate: MacroAggregate, targets: MacroAggregate, settings: PantryPluginSettings): void {
        const tbody = table.createEl('tbody', { cls: 'tracker-table__body' });

        // Daily Rows
        for (const day of dailyBreakdown) {
            const row = tbody.createEl('tr', { cls: 'tracker-table__row' });
            
            // Date Cell
            const dateCell = row.createEl('td', { cls: 'tracker-table__cell tracker-weekly-table__cell--date' });
            // format date
            const dateStr = this.formatDate(day.date);
            dateCell.createSpan({ text: dateStr });
            
            // Macro Cells
            this.renderMacroCell(row, 'calories', day.aggregate.calories, settings.dailyCalorieTarget, settings.energyUnit);
            this.renderMacroCell(row, 'protein', day.aggregate.protein, settings.dailyProteinTarget, 'g');
            this.renderMacroCell(row, 'fat', day.aggregate.fat, settings.dailyFatTarget, 'g');
            this.renderMacroCell(row, 'carbs', day.aggregate.carbs, settings.dailyCarbsTarget, 'g');
            this.renderMacroCell(row, 'fibre', day.aggregate.fibre, settings.fibreTargetPerDay, 'g');
        }

        // Totals Row
        const totalRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-weekly-table__row--total' });
        totalRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Weekly Totals' });
        
        this.renderTotalCell(totalRow, 'calories', aggregate.calories, settings.energyUnit);
        this.renderTotalCell(totalRow, 'protein', aggregate.protein, 'g');
        this.renderTotalCell(totalRow, 'fat', aggregate.fat, 'g');
        this.renderTotalCell(totalRow, 'carbs', aggregate.carbs, 'g');
        this.renderTotalCell(totalRow, 'fibre', aggregate.fibre, 'g');

        // Targets Row
        const targetRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__row--target' });
        targetRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Weekly Targets' });
        
        this.renderTargetCell(targetRow, 'calories', targets.calories, settings.energyUnit, aggregate.calories);
        this.renderTargetCell(targetRow, 'protein', targets.protein, 'g', aggregate.protein);
        this.renderTargetCell(targetRow, 'fat', targets.fat, 'g', aggregate.fat);
        this.renderTargetCell(targetRow, 'carbs', targets.carbs, 'g', aggregate.carbs);
        this.renderTargetCell(targetRow, 'fibre', targets.fibre, 'g', aggregate.fibre);

        // Remaining Row
        const remainingRow = tbody.createEl('tr', { cls: 'tracker-table__row tracker-table__row--remaining' });
        remainingRow.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: 'Remaining' });
        
        this.renderRemainingCell(remainingRow, 'calories', targets.calories - aggregate.calories, settings.energyUnit);
        this.renderRemainingCell(remainingRow, 'protein', targets.protein - aggregate.protein, 'g');
        this.renderRemainingCell(remainingRow, 'fat', targets.fat - aggregate.fat, 'g');
        this.renderRemainingCell(remainingRow, 'carbs', targets.carbs - aggregate.carbs, 'g');
        this.renderRemainingCell(remainingRow, 'fibre', targets.fibre - aggregate.fibre, 'g');
        
        this.renderAveragesRow(tbody, dailyBreakdown, settings);
    }

    private formatDate(dateStr: string): string {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const monthIndex = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthStr = months[monthIndex] || parts[1];
            
            return `${day} ${monthStr} ${year}`;
        }
        return dateStr;
    }

    private getTodayStr(): string {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private renderAveragesRow(tbody: HTMLElement, dailyBreakdown: DailyAggregate[], settings: PantryPluginSettings): void {
        const todayStr = this.getTodayStr();
        console.log(`[Pantry] renderAveragesRow: todayStr=${todayStr}, dailyBreakdown length=${dailyBreakdown.length}`);
        
        const result = calculateRollingAverage(dailyBreakdown, todayStr);
        if (!result) return;

        const { count, averages: avg } = result;

        const row = tbody.createEl('tr', { cls: 'tracker-table__row tracker-weekly-table__row--averages' });
        row.createEl('td', { cls: 'tracker-table__cell tracker-table__cell--total-label', text: `Daily Avg (${count}d)` });

        this.renderAverageCell(row, 'calories', avg.calories, settings.energyUnit);
        this.renderAverageCell(row, 'protein', avg.protein, 'g');
        this.renderAverageCell(row, 'fat', avg.fat, 'g');
        this.renderAverageCell(row, 'carbs', avg.carbs, 'g');
        this.renderAverageCell(row, 'fibre', avg.fibre, 'g');
    }

    private renderAverageCell(row: HTMLElement, type: string, value: number, unit: string): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--avg-value tracker-table__cell--${type}` });
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(value) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });
    }

    private formatNumber(val: number): string {
        return val % 1 !== 0 ? val.toFixed(1) : val.toString();
    }

    private renderMacroCell(row: HTMLElement, type: string, value: number, target: number, unit: string): void {
        const cell = row.createEl('td', { cls: `tracker-table__cell tracker-table__cell--numeric tracker-table__cell--${type}` });
        
        const valueWrapper = cell.createDiv({ cls: 'tracker-table__value-wrapper' });
        valueWrapper.createSpan({ cls: 'tracker-table__value', text: this.formatNumber(value) });
        valueWrapper.createSpan({ cls: 'tracker-table__unit', text: ` ${unit}` });

        const percentage = target > 0 ? Math.round((value / target) * 100) : 0;
        valueWrapper.createSpan({ cls: 'tracker-table__percentage', text: ` (${percentage}%)` });

        const fillWidth = Math.min(percentage, 100);
        const barContainer = cell.createDiv({ cls: `tracker-table__bar tracker-table__bar--${type}` });
        barContainer.createDiv({ 
            cls: 'tracker-table__bar-fill',
            attr: { style: `width: ${fillWidth}%;` }
        });
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
        
        const barContainer = cell.createDiv({ cls: `tracker-table__bar tracker-table__bar--${type}` });
        barContainer.createDiv({ 
            cls: 'tracker-table__bar-fill',
            attr: { style: `width: ${fillWidth}%;` }
        });

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
