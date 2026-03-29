import { App, Plugin, PluginSettingTab, Setting, Notice, requestUrl, parseYaml, TFile, setIcon } from "obsidian";
import { PantryPluginSettings, DEFAULT_SETTINGS, PantrySettingsTab } from "./settings";
import { RecipeFileManager } from "./services/RecipeFileManager";
import { LLMAPIService } from "./services/apis/LLMAPIService";
import { FatSecretAPIService } from "./services/apis/FatSecretAPIService";
import { WeeklyNoteManager } from "./services/WeeklyNoteManager";
import { RecipeInputModal } from "./ui/modals/RecipeInputModal";
import { RecipeImageModal } from "./ui/modals/RecipeImageModal";
import { WeeklyPlannerV2Modal } from "./ui/modals/WeeklyPlannerV2Modal";
import { FatSecretSearchModal } from "./ui/modals/FatSecretSearchModal";
import { AddMenuModal } from "./ui/modals/AddMenuModal";
import { registerTrackerProcessor } from "./processors/tracker";
import { calculateWeeklyBalance } from "./calculators/weeklyBalance";
import { FoodListEditorModal } from "./ui/modals/FoodListEditorModal";
import { EditWeeklyServingModal } from "./ui/modals/EditWeeklyServingModal";

export default class PantryPlugin extends Plugin {
    settings: PantryPluginSettings;
    recipeManager: RecipeFileManager;
    llmService: LLMAPIService;
    fatSecretService: FatSecretAPIService;
    noteManager: WeeklyNoteManager;

    async onload() {
        console.log("PANTRY_V2_LOADED");
        await this.loadSettings();

        // Initialize Services
        this.recipeManager = new RecipeFileManager(this.app, this.settings);
        this.llmService = new LLMAPIService(this.settings.llmApiKey, this.settings.llmEndpoint, this.settings.llmModel);
        this.fatSecretService = new FatSecretAPIService(this.settings.fatSecretClientId, this.settings.fatSecretClientSecret, requestUrl);
        this.noteManager = new WeeklyNoteManager(this.app, this.settings);

        // Ensure folders exist
        this.app.workspace.onLayoutReady(async () => {
            await this.recipeManager.ensureFolderStructure();
            await this.noteManager.ensureFolder();
        });

        // Add Settings Tab
        this.addSettingTab(new PantrySettingsTab(this.app, this));

        // Commands
        this.addCommand({
            id: "add-recipe-url",
            name: "Add Recipe from URL",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeInputModal(this.app, "url", this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "add-recipe-manual",
            name: "Add Recipe Manually (Text)",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeInputModal(this.app, "manual", this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "add-recipe-image",
            name: "Add Recipe from Image/Screenshot",
            callback: () => {
                if (!this.checkApiKey()) return;
                new RecipeImageModal(this.app, this.llmService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "search-fatsecret-food",
            name: "Add Food from FatSecret",
            callback: () => {
                if (!this.checkFatSecretCredentials()) return;
                new FatSecretSearchModal(this.app, this.fatSecretService, this.recipeManager).open();
            }
        });

        this.addCommand({
            id: "create-weekly-plan",
            name: "Create Weekly Plan",
            callback: () => {
                new WeeklyPlannerV2Modal(this.app, this.recipeManager, this.noteManager, this.settings).open();
            }
        });

        // Ribbon Icons
        this.addRibbonIcon("calendar-check", "Pantry", () => {
            new WeeklyPlannerV2Modal(this.app, this.recipeManager, this.noteManager, this.settings).open();
        });
        
        this.addRibbonIcon("chef-hat", "Add Food/Recipe", () => {
            new AddMenuModal(this.app, this).open();
        });

        // Register Markdown Processors
        registerTrackerProcessor(this);

        this.registerMarkdownCodeBlockProcessor('weeklyplanner', (source, el, ctx) => {
            // Parse YAML
            const data = parseYaml(source) as {
                status: 'green' | 'amber' | 'red';
                energyUnit: string;
                targets: Record<string, number>;
                totals: Record<string, number>;
            };

            const macros = [
                { key: 'calories', label: '🔥 Energy', unit: data.energyUnit },
                { key: 'protein',  label: '💪 Protein', unit: 'g' },
                { key: 'fat',      label: '🥑 Fat',     unit: 'g' },
                { key: 'carbs',    label: '🍞 Carbs',   unit: 'g' },
                { key: 'fibre',    label: '🌾 Fibre',   unit: 'g' },
            ];

            const container = el.createDiv({ cls: 'weeklyplanner-block' });

            // Status badge
            const statusLabel = data.status === 'green' ? '🟢 On track'
                : data.status === 'amber' ? '🟠 Needs review'
                : '🔴 Unbalanced';
            container.createDiv({ text: statusLabel, cls: `weeklyplanner-status weeklyplanner-status--${data.status}` });

            // Macro bars
            macros.forEach(({ key, label, unit }) => {
                const current = data.totals[key] ?? 0;
                const target  = data.targets[key] ?? 1;
                const pct     = Math.min((current / target) * 100, 100);

                const colour = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#C0392B';

                const row = container.createDiv({ cls: 'macro-bar-row' });
                row.createSpan({ text: label, cls: 'macro-bar-label' });
                const fill = row.createDiv({ cls: 'macro-bar-track' }).createDiv({ cls: 'macro-bar-fill' });
                fill.style.width = `${pct}%`;
                fill.style.background = colour;
                row.createSpan({
                    text: `${Math.round(current)}${unit} / ${Math.round(target)}${unit}`,
                    cls: 'macro-bar-value'
                });
            });
        });

        this.registerMarkdownCodeBlockProcessor('weeklyplannerV2', async (source, el, ctx) => {
            const data = parseYaml(source) as {
                foods: { name: string, servings: number }[]
            };

            if (!data || !data.foods || !Array.isArray(data.foods)) {
                el.createEl("p", { text: "Invalid weeklyplannerV2 data. Ensure it has a 'foods' list." });
                return;
            }

            const container = el.createDiv({ cls: 'weeklyplanner-block' });
            
            const allRecipes = await this.recipeManager.getAllRecipes();
            const recipesForBalance: { frontmatter: any; servings: number }[] = [];
            
            // Collect recipes for balance
            for (let i = 0; i < data.foods.length; i++) {
                const item = data.foods[i];
                const matchedRecipe = allRecipes.find(r => {
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
                    this.settings.dailyCalorieTarget,
                    this.settings.dailyProteinTarget,
                    this.settings.dailyFatTarget,
                    this.settings.dailyCarbsTarget,
                    this.settings.fibreTargetPerDay
                );

                const calMultiplier = this.settings.energyUnit === 'kcal' ? 1 : 4.184;

                const macros = [
                    { key: 'calories', label: '🔥 Energy', unit: this.settings.energyUnit, total: stats.totalCalories * calMultiplier, target: stats.weeklyTargets.calories * calMultiplier },
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
            editBtn.onclick = () => {
                new FoodListEditorModal(
                    this.app, 
                    this.recipeManager, 
                    this.settings,
                    data.foods.map(f => ({ name: f.name, servings: f.servings || 1 })),
                    async (updatedFoods) => {
                        const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
                        if (!file || !('extension' in file)) return;
                        
                        const info = ctx.getSectionInfo(el);
                        if (!info) return;

                        const content = await this.app.vault.read(file as any);
                        const lines = content.split('\n');
                        
                        let newYaml = "foods:\n";
                        for (const f of updatedFoods) {
                            newYaml += `  - name: ${f.name}\n`;
                            newYaml += `    servings: ${f.servings}\n`;
                        }
                        
                        lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...newYaml.trimEnd().split('\n'));
                        await this.app.vault.modify(file as any, lines.join('\n'));
                    }
                ).open();
            };

            const list = container.createEl('div', { cls: 'weeklyplanner-food-list' });
            list.style.marginTop = '12px';
            
            for (let i = 0; i < data.foods.length; i++) {
                const item = data.foods[i];
                
                const row = list.createDiv({ cls: 'scheduler-row' });
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
                
                const updateServing = async (newServings: number) => {
                    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
                    if (!file || !('extension' in file)) return;
                    
                    const info = ctx.getSectionInfo(el);
                    if (!info) return;

                    const content = await this.app.vault.read(file as any);
                    const lines = content.split('\n');
                    
                    const blockLines = lines.slice(info.lineStart + 1, info.lineEnd);
                    const blockSource = blockLines.join('\n');
                    const parsedData = parseYaml(blockSource) as any;
                    
                    if (parsedData && parsedData.foods) {
                        const targetItem = parsedData.foods[i];
                        if (targetItem && targetItem.name === item.name) {
                            targetItem.servings = newServings;
                            
                            if (targetItem.servings <= 0) {
                                parsedData.foods.splice(i, 1);
                            }
                            
                            let newYaml = "foods:\n";
                            for (const f of parsedData.foods) {
                                newYaml += `  - name: ${f.name}\n`;
                                newYaml += `    servings: ${f.servings}\n`;
                            }
                            
                            lines.splice(info.lineStart + 1, info.lineEnd - info.lineStart - 1, ...newYaml.trimEnd().split('\n'));
                            await this.app.vault.modify(file as any, lines.join('\n'));
                        }
                    }
                };

                const editBtn = counter.createSpan({ cls: 'tracker-table__edit-icon' });
                editBtn.style.cursor = 'pointer';
                editBtn.style.marginLeft = '8px';
                setIcon(editBtn, 'pencil');

                editBtn.onclick = () => {
                    const recipe = allRecipes.find(r => 
                        r.frontmatter.name === item.name || 
                        r.path.endsWith(item.name + '.md') ||
                        item.name === r.path.split('/').pop()?.replace('.md', '')
                    );
                    
                    if (recipe) {
                        new EditWeeklyServingModal(
                            this.app,
                            item.name,
                            recipe.frontmatter,
                            item.servings || 1,
                            [], // Categories
                            this.settings,
                            (newServings, newCategory) => updateServing(newServings)
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
        });
    }

    public checkApiKey(): boolean {
        if (!this.settings.llmApiKey) {
            new Notice("Please set your LLM API Key in the plugin settings.");
            return false;
        }
        return true;
    }

    public checkFatSecretCredentials(): boolean {
        if (!this.settings.fatSecretClientId || !this.settings.fatSecretClientSecret) {
            new Notice("Please set your FatSecret Client ID and Secret in the plugin settings.");
            return false;
        }
        return true;
    }

    onunload() {
        // Cleanup if necessary
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Re-initialize services with new settings
        this.llmService = new LLMAPIService(this.settings.llmApiKey, this.settings.llmEndpoint, this.settings.llmModel);
        this.fatSecretService = new FatSecretAPIService(this.settings.fatSecretClientId, this.settings.fatSecretClientSecret, requestUrl);
    }
}
