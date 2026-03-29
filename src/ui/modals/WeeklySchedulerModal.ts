import { App, Modal, setIcon } from 'obsidian';
import { FoodItemFrontmatter } from '../../services/RecipeFileManager';
import { PantryPluginSettings } from '../../settings';
import { EditWeeklyServingModal } from './EditWeeklyServingModal';

export interface RecipeSchedule {
    path: string;
    name: string;
    frontmatter: FoodItemFrontmatter;
    servings: number;
}

export class WeeklySchedulerModal extends Modal {
    private schedules: RecipeSchedule[];
    private onConfirm: (schedules: RecipeSchedule[]) => void;
    private settings: PantryPluginSettings;

    constructor(
        app: App,
        recipes: { path: string; name: string; frontmatter: FoodItemFrontmatter }[],
        settings: PantryPluginSettings,
        onConfirm: (schedules: RecipeSchedule[]) => void
    ) {
        super(app);
        this.schedules = recipes.map(r => ({ ...r, servings: 1 }));
        this.settings = settings;
        this.onConfirm = onConfirm;
    }

    onOpen() { this.display(); }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nutrition-planner-modal');

        contentEl.createEl('h2', { text: 'How many times this week?' });
        contentEl.createEl('p', {
            text: "All recipes default to once. Adjust any you'll eat more often.",
            attr: { style: 'color:var(--text-muted); font-size:13px; margin-bottom:20px;' }
        });

        this.schedules.forEach(schedule => {
            const row = contentEl.createDiv({ cls: 'scheduler-row' });
            row.createEl('span', { text: schedule.name, cls: 'scheduler-recipe-name' });

            const counter  = row.createDiv({ cls: 'scheduler-counter' });
            
            counter.createEl('span', { text: `×${schedule.servings}`, cls: 'scheduler-counter-value' });
            
            const editBtn = counter.createSpan({ cls: 'tracker-table__edit-icon' });
            editBtn.style.cursor = 'pointer';
            editBtn.style.marginLeft = '8px';
            setIcon(editBtn, 'pencil');

            editBtn.onclick = () => {
                new EditWeeklyServingModal(
                    this.app,
                    schedule.name,
                    schedule.frontmatter,
                    schedule.servings,
                    [], // Categories
                    this.settings,
                    (newServings, newCategory) => {
                        schedule.servings = newServings;
                        this.display(); // re-render the list
                    }
                ).open();
            };
        });

        const footer = contentEl.createDiv({ cls: 'pantry-actions' });
        footer.style.marginTop = '20px';
        footer.createEl('button', { text: 'Back', cls: 'pantry-btn pantry-btn-secondary' })
            .onclick = () => this.close();
        footer.createEl('button', { text: 'Create Weekly Note', cls: 'pantry-btn pantry-btn-primary' })
            .onclick = () => { this.onConfirm(this.schedules); this.close(); };
    }

    onClose() { this.contentEl.empty(); }
}
