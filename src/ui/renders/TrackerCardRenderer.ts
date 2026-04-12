import { PantryPluginSettings } from '../../settings';
import { MacroAggregate } from '../../services/TrackerProcessor';

type MacroType = 'calories' | 'protein' | 'fat' | 'carbs' | 'fibre';

export class TrackerCardRenderer {
    
    /**
     * Renders the complete tracker widget
     */
    renderWidget(container: HTMLElement, dateStr: string, aggregate: MacroAggregate, settings: PantryPluginSettings, onAddClick?: () => void): void {
        const widget = container.createDiv({ cls: 'tracker-widget' });
        
        this.renderHeader(widget, dateStr, onAddClick);
        this.renderCards(widget, aggregate, settings);
    }

    /**
     * Formats YYYY-MM-DD into DD MMM YYYY
     */
    private formatDate(dateStr: string): string {
        // Simple manual parsing to avoid timezone timezone shifts
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const monthIndex = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            
            if (!isNaN(monthIndex) && !isNaN(day) && year.length === 4) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthStr = months[monthIndex] || parts[1];
                
                return `${day} ${monthStr} ${year}`;
            }
        }
        return dateStr;
    }

    private renderHeader(container: HTMLElement, dateStr: string, onAddClick?: () => void): void {
        const formattedDate = this.formatDate(dateStr);
        const header = container.createDiv({ 
            cls: 'tracker-widget__header'
        });
        
        header.createSpan({ text: `${formattedDate} Macros` });

        if (onAddClick) {
            const addButton = header.createDiv({ cls: 'tracker-add-button' });
            addButton.innerHTML = '+';
            addButton.onclick = onAddClick;
        }
    }

    private renderCards(container: HTMLElement, aggregate: MacroAggregate, settings: PantryPluginSettings): void {
        const cardsContainer = container.createDiv({ cls: 'tracker-widget__cards' });

        // Calorie card is first
        this.renderCard(
            cardsContainer, 
            'calories', 
            'Calories', 
            aggregate.calories, 
            settings.dailyCalorieTarget, 
            settings.energyUnit
        );

        this.renderCard(
            cardsContainer, 
            'protein', 
            'Protein', 
            aggregate.protein, 
            settings.dailyProteinTarget, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'fat', 
            'Fat', 
            aggregate.fat, 
            settings.dailyFatTarget, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'carbs', 
            'Carbs', 
            aggregate.carbs, 
            settings.dailyCarbsTarget, 
            'g'
        );

        this.renderCard(
            cardsContainer, 
            'fibre', 
            'Fibre', 
            aggregate.fibre, 
            settings.fibreTargetPerDay, 
            'g'
        );
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
        
        // Split value/unit onto different lines structurally or via CSS
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
}