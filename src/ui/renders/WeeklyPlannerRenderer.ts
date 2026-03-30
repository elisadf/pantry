import { App, MarkdownPostProcessorContext, parseYaml, setIcon, Notice } from 'obsidian';
import { PantryPluginSettings } from '../../settings';
import { calculateWeeklyBalance } from '../../calculators/weeklyBalance';
import { FoodListEditorModal } from '../modals/FoodListEditorModal';
import { EditWeeklyServingModal } from '../modals/EditWeeklyServingModal';
import { WeeklyPlannerData } from '../../data/WeeklyPlannerData';

export class WeeklyPlannerRenderer {
    public async render(
        source: string,
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext,
        app: App,
        recipeManager: any,
        settings: PantryPluginSettings,
        markdownSettingsService: any
    ): Promise<void> {
        const data = parseYaml(source) as WeeklyPlannerData;

        if (!data || !data.foods || !Array.isArray(data.foods)) {
            el.createEl("p", { text: "Invalid weeklyplannerV2 data. Ensure it has a 'foods' list." });
            return;
        }

        const container = el.createDiv({ cls: 'weeklyplanner-block' });
        
        const allRecipes = await recipeManager.getAllRecipes();
        const recipesForBalance: { frontmatter: any; servings: number }[] = [];
        
        // Collect recipes for balance
        for (let i = 0; i < data.foods.length; i++) {
            const item = data.foods[i];
            const matchedRecipe = allRecipes.find((r: any) => {
                const rName = r.frontmatter.name || r.path.split("/").pop()?.replace(".md", "");
                return rName === item.name;
            });
            if (matchedRecipe) {
                recipesForBalance.push({ frontmatter: matchedRecipe.frontmatter, servings: item.servings || 1 });
            } else {
                console.warn(`[Pantry V2] Could not find recipe matching name: ${item.name}`);
            }
        }
        
        // Render balance first
        if (recipesForBalance.length > 0) {
            const stats = calculateWeeklyBalance(
                recipesForBalance,
                settings.dailyCalorieTarget,
                settings.dailyProteinTarget,
                settings.dailyFatTarget,
                settings.dailyCarbsTarget,
                settings.fibreTargetPerDay
            );

            const calMultiplier = settings.energyUnit === 'kcal' ? 1 : 4.184;

            const macros = [
                { key: 'calories', label: '🔥 Energy', unit: settings.energyUnit, total: stats.totalCalories * calMultiplier, target: stats.weeklyTargets.calories * calMultiplier },
                { key: 'protein',  label: '💪 Protein', unit: 'g', total: stats.totalProtein, target: stats.weeklyTargets.protein },
                { key: 'fat',      label: '🥑 Fat',     unit: 'g', total: stats.totalFat, target: stats.weeklyTargets.fat },
                { key: 'carbs',    label: '🍞 Carbs',   unit: 'g', total: stats.totalCarbs, target: stats.weeklyTargets.carbs },
                { key: 'fibre',    label: '🌾 Fibre',   unit: 'g', total: stats.totalFibre, target: stats.weeklyTargets.fibre },
            ];

            // Status badge
            const statusLabel = stats.status === 'green' ? '🟢 On track'
                : stats.status === 'amber' ? '🟠 Needs review'
                : '🔴 Unbalanced';
            container.createDiv({ text: statusLabel, cls: `weeklyplanner-status weeklyplanner-status--${stats.status}` });

            // Macro bars
            macros.forEach(({ key, label, unit, total, target }) => {
                const pct = Math.min((total / target) * 100, 100);
                const colour = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#C0392B';

                const row = container.createDiv({ cls: 'macro-bar-row' });
                row.createSpan({ text: label, cls: 'macro-bar-label' });
                const fill = row.createDiv({ cls: 'macro-bar-track' }).createDiv({ cls: 'macro-bar-fill' });
                fill.style.width = `${pct}%`;
                fill.style.background = colour;
                row.createSpan({
                    text: `${Math.round(total)}${unit} / ${Math.round(target)}${unit}`,
                    cls: 'macro-bar-value'
                });
            });
        } else {
            container.createEl("p", { text: "No matched recipes found to calculate balance." });
        }
        
        // White break
        const separator = container.createDiv();
        separator.style.height = '2px';
        separator.style.backgroundColor = 'white';
        separator.style.margin = '20px 0';
        separator.style.borderRadius = '1px';
        
        // Render foods list
        const headerRow = container.createDiv({ cls: 'weeklyplanner-header' });
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        
        headerRow.createEl("h3", { text: "Selected Recipes", attr: { style: 'margin: 0;' } });
        
        const editBtn = headerRow.createEl('button', { text: 'Edit Plan', cls: 'pantry-btn pantry-btn-secondary' });
        editBtn.onclick = async () => {
            new FoodListEditorModal(
                app, 
                recipeManager, 
                settings,
                markdownSettingsService,
                data.foods.map(f => ({ name: f.name, servings: f.servings || 1, category: f.category })),
                async (updatedFoods) => {
                    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
                    if (!file || !('extension' in file)) return;
                    
                    const info = ctx.getSectionInfo(el);
                    if (!info) return;

                    const content = await app.vault.read(file as any);
                    const lines = content.split('\n');
                    
                    let newYaml = "foods:\n";
                    for (const f of updatedFoods) {
                        newYaml += `  - name: ${f.name}\n`;
                        newYaml += `    servings: ${f.servings}\n`;
                        if (f.category) {
                            newYaml += `    category: ${f.category}\n`;
                        }
                    }
                    
                    lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...newYaml.trimEnd().split('\n'));
                    await app.vault.modify(file as any, lines.join('\n'));
                }
            ).open();
        };

        const list = container.createEl('div', { cls: 'weeklyplanner-food-list' });
        list.style.marginTop = '12px';
        
        // Group foods by category
        const foodsByCategory: Record<string, typeof data.foods> = {};
        for (const item of data.foods) {
            const category = item.category || 'Uncategorized';
            if (!foodsByCategory[category]) {
                foodsByCategory[category] = [];
            }
            foodsByCategory[category].push(item);
        }

        const sortedCategories = Object.keys(foodsByCategory).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });

        for (const category of sortedCategories) {
            const categoryFoods = foodsByCategory[category];
            const itemCount = categoryFoods.length;
            
            const detailsEl = list.createEl('details');
            detailsEl.setAttribute('open', 'true');
            detailsEl.style.marginTop = '12px';
            
            const summaryEl = detailsEl.createEl('summary', { text: `${category} (${itemCount} item${itemCount !== 1 ? 's' : ''})` });
            summaryEl.style.marginBottom = '6px';
            summaryEl.style.color = 'var(--text-muted)';
            summaryEl.style.fontSize = '0.9em';
            summaryEl.style.textTransform = 'uppercase';
            summaryEl.style.letterSpacing = '0.05em';
            summaryEl.style.borderBottom = '1px solid var(--background-modifier-border)';
            summaryEl.style.paddingBottom = '4px';
            summaryEl.style.cursor = 'pointer';

            const itemsContainer = detailsEl.createDiv({ cls: 'weeklyplanner-category-items' });

            for (const item of categoryFoods) {
                const row = itemsContainer.createDiv({ cls: 'scheduler-row' });
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
                
                const countEl = counter.createEl('span', { text: `×${item.servings || 1}`, cls: 'scheduler-counter-value' });
                
                const updateServing = async (newServings: number, newCategory?: string) => {
                    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
                    if (!file || !('extension' in file)) return;
                    
                    const info = ctx.getSectionInfo(el);
                    if (!info) return;

                    const content = await app.vault.read(file as any);
                    const lines = content.split('\n');
                    
                    const blockLines = lines.slice(info.lineStart + 1, info.lineEnd);
                    const blockSource = blockLines.join('\n');
                    const parsedData = parseYaml(blockSource) as any;
                    
                    if (parsedData && parsedData.foods) {
                        const targetItem = parsedData.foods.find((f: any) => f.name === item.name);
                        if (targetItem) {
                            targetItem.servings = newServings;
                            if (newCategory !== undefined) {
                                targetItem.category = newCategory;
                            }
                            
                            if (targetItem.servings <= 0) {
                                const i = parsedData.foods.findIndex((f: any) => f.name === item.name);
                                if (i !== -1) {
                                    parsedData.foods.splice(i, 1);
                                }
                            }
                            
                            let newYaml = "foods:\n";
                            for (const f of parsedData.foods) {
                                newYaml += `  - name: ${f.name}\n`;
                                newYaml += `    servings: ${f.servings}\n`;
                                if (f.category) {
                                    newYaml += `    category: ${f.category}\n`;
                                }
                            }
                            
                            lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...newYaml.trimEnd().split('\n'));
                            await app.vault.modify(file as any, lines.join('\n'));
                        }
                    }
                };

                const editBtn = counter.createSpan({ cls: 'tracker-table__edit-icon' });
                editBtn.style.cursor = 'pointer';
                editBtn.style.marginLeft = '8px';
                setIcon(editBtn, 'pencil');

                editBtn.onclick = async () => {
                    const recipe = allRecipes.find((r: any) => 
                        r.frontmatter.name === item.name || 
                        r.path.endsWith(item.name + '.md') ||
                        item.name === r.path.split('/').pop()?.replace('.md', '')
                    );
                    
                    if (recipe) {
                        new EditWeeklyServingModal(
                            app,
                            { name: item.name, servings: item.servings || 1, category: item.category },
                            recipe.frontmatter,
                            markdownSettingsService, // Categories
                            settings,
                            (newServings, newCategory) => updateServing(newServings, newCategory)
                        ).open();
                    } else {
                        new Notice("Recipe details not found.");
                    }
                };
                
                const deleteBtn = counter.createSpan({ cls: 'tracker-table__edit-icon' });
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.marginLeft = '8px';
                deleteBtn.style.color = 'var(--text-error)';
                setIcon(deleteBtn, 'trash');
                
                deleteBtn.onclick = () => updateServing(0);
            }
        }
    }
}
