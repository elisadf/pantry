import { App, PluginSettingTab, Setting, Notice } from "obsidian";

export interface PantryPluginSettings {
    recipeFolder: string;
    
    // Nutrition Targets
    dailyCalorieTarget: number;
    dailyProteinTarget: number;
    dailyFatTarget: number;
    dailyCarbsTarget: number;
    fibreTargetPerDay: number;
    energyUnit: 'kcal' | 'kJ';
    
    // LLM API Settings
    llmApiKey: string;
    llmEndpoint: string;
    llmModel: string;
    
    // FatSecret Settings
    fatSecretClientId: string;
    fatSecretClientSecret: string;
}

export const DEFAULT_SETTINGS: PantryPluginSettings = {
    recipeFolder: "Pantry",
    
    // Default Nutrition Targets
    dailyCalorieTarget: 2395,
    dailyProteinTarget: 120,
    dailyFatTarget: 70,
    dailyCarbsTarget: 275,
    fibreTargetPerDay: 30,
    energyUnit: "kcal",
    
    // Default LLM Settings
    llmApiKey: "",
    llmEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    llmModel: "google/gemini-2.5-flash",
    
    // Default FatSecret Settings
    fatSecretClientId: "",
    fatSecretClientSecret: "",
};

export class PantrySettingsTab extends PluginSettingTab {
    plugin: any;
    private activeTab: 'general' | 'llm-apis' | 'food-sources' = 'general';

    private tabs = [
        { id: 'general', label: 'General', icon: '📁' },
        { id: 'llm-apis', label: 'Pantry LLMs', icon: '🤖' },
        { id: 'food-sources', label: 'Food Sources', icon: '🍎' }
    ];

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Pantry Settings" });
        
        this.renderTabNavigation(containerEl);
        
        const tabContentContainer = containerEl.createDiv("pantry-tab-content");
        this.renderTabContent(tabContentContainer);
    }
    
    private renderTabNavigation(containerEl: HTMLElement) {
        const navContainer = containerEl.createDiv("pantry-tabs-container");
        
        this.tabs.forEach(tab => {
            const tabEl = navContainer.createDiv(`pantry-tab ${this.activeTab === tab.id ? 'is-active' : ''}`);
            tabEl.createSpan({ text: tab.icon, cls: "pantry-tab-icon" });
            tabEl.createSpan({ text: tab.label });
            
            tabEl.onclick = () => {
                this.activeTab = tab.id as any;
                this.display(); // Re-render the whole settings pane
            };
        });
    }
    
    private renderTabContent(containerEl: HTMLElement) {
        switch (this.activeTab) {
            case 'general':
                this.displayGeneralTab(containerEl);
                break;
            case 'llm-apis':
                this.displayLLMApiTab(containerEl);
                break;
            case 'food-sources':
                this.displayFoodSourcesTab(containerEl);
                break;
        }
    }
    
    private displayGeneralTab(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName("Storage Location")
            .setDesc("Folder where all recipe files will be stored in your vault. Weekly plans will go to a 'Weekly plans' subfolder.")
            .addText((text) =>
                text
                    .setPlaceholder("Pantry")
                    .setValue(this.plugin.settings.recipeFolder)
                    .onChange(async (value: string) => {
                        this.plugin.settings.recipeFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl("h3", { text: "🎯 Daily Nutrition Targets" });

        new Setting(containerEl)
            .setName("Daily Calorie Target")
            .setDesc("Your daily calorie intake target")
            .addText((text) =>
                text
                    .setPlaceholder("2395")
                    .setValue(String(this.plugin.settings.dailyCalorieTarget))
                    .onChange(async (value: string) => {
                        this.plugin.settings.dailyCalorieTarget = parseInt(value) || 2395;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Daily Protein Target (g)")
            .setDesc("Your daily protein intake target in grams")
            .addText((text) =>
                text
                    .setPlaceholder("120")
                    .setValue(String(this.plugin.settings.dailyProteinTarget))
                    .onChange(async (value: string) => {
                        this.plugin.settings.dailyProteinTarget = parseInt(value) || 120;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Daily Fat Target (g)")
            .setDesc("Your daily fat intake target in grams")
            .addText((text) =>
                text
                    .setPlaceholder("70")
                    .setValue(String(this.plugin.settings.dailyFatTarget))
                    .onChange(async (value: string) => {
                        this.plugin.settings.dailyFatTarget = parseInt(value) || 70;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Daily Carbs Target (g)")
            .setDesc("Your daily carbohydrate intake target in grams")
            .addText((text) =>
                text
                    .setPlaceholder("275")
                    .setValue(String(this.plugin.settings.dailyCarbsTarget))
                    .onChange(async (value: string) => {
                        this.plugin.settings.dailyCarbsTarget = parseInt(value) || 275;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Daily Fibre Target (g)")
            .setDesc("Your daily fibre intake target in grams")
            .addText((text) =>
                text
                    .setPlaceholder("30")
                    .setValue(String(this.plugin.settings.fibreTargetPerDay))
                    .onChange(async (value: string) => {
                        this.plugin.settings.fibreTargetPerDay = parseInt(value) || 30;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Energy Unit")
            .setDesc("Choose between kilocalories (kcal) and kilojoules (kJ) for energy display")
            .addDropdown(dropdown => 
                dropdown
                    .addOption('kcal', 'Kilocalories (kcal)')
                    .addOption('kJ', 'Kilojoules (kJ)')
                    .setValue(this.plugin.settings.energyUnit)
                    .onChange(async (value) => {
                        this.plugin.settings.energyUnit = value as 'kcal' | 'kJ';
                        await this.plugin.saveSettings();
                    })
            );
    }
    
    private displayLLMApiTab(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName("LLM API Key")
            .setDesc("Enter your API key for recipe parsing (OpenRouter, OpenAI, etc.)")
            .addText((text) => {
                text.inputEl.type = "password";
                return text
                    .setPlaceholder("sk-or-v1-...")
                    .setValue(this.plugin.settings.llmApiKey)
                    .onChange(async (value: string) => {
                        this.plugin.settings.llmApiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("LLM Endpoint")
            .setDesc("The OpenAI-compatible API endpoint url")
            .addText((text) =>
                text
                    .setPlaceholder("https://openrouter.ai/api/v1/chat/completions")
                    .setValue(this.plugin.settings.llmEndpoint)
                    .onChange(async (value: string) => {
                        this.plugin.settings.llmEndpoint = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("LLM Model")
            .setDesc("Model to use for recipe parsing (e.g., google/gemini-2.5-flash)")
            .addText((text) =>
                text
                    .setPlaceholder("google/gemini-2.5-flash")
                    .setValue(this.plugin.settings.llmModel)
                    .onChange(async (value: string) => {
                        this.plugin.settings.llmModel = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
    
    private displayFoodSourcesTab(containerEl: HTMLElement) {
        containerEl.createEl("p", { 
            text: "Configure food database APIs to enable search functionality. Sign up for free FatSecret API credentials at: https://platform.fatsecret.com/platform-api",
            cls: "setting-item-description"
        });
        
        new Setting(containerEl)
            .setName("FatSecret API key")
            .setDesc("Your FatSecret API client ID (required for FatSecret search functionality)")
            .addText((text) => {
                text.inputEl.type = "password";
                return text
                    .setPlaceholder("Enter your API key")
                    .setValue(this.plugin.settings.fatSecretClientId)
                    .onChange(async (value: string) => {
                        this.plugin.settings.fatSecretClientId = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("FatSecret API secret")
            .setDesc("Your FatSecret API client secret (required for FatSecret search functionality)")
            .addText((text) => {
                text.inputEl.type = "password";
                return text
                    .setPlaceholder("Enter your API secret")
                    .setValue(this.plugin.settings.fatSecretClientSecret)
                    .onChange(async (value: string) => {
                        this.plugin.settings.fatSecretClientSecret = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Test FatSecret connection")
            .setDesc("Click to test your FatSecret API credentials.")
            .addButton((button) =>
                button
                    .setButtonText("Test Connection")
                    .onClick(async () => {
                        button.setButtonText("Testing...").setDisabled(true);
                        try {
                            await this.plugin.fatSecretService.testConnection();
                            new Notice("FatSecret connection successful!");
                        } catch (error) {
                            new Notice("FatSecret connection failed. Check your API key and secret.");
                        } finally {
                            button.setButtonText("Test Connection").setDisabled(false);
                        }
                    })
            );
    }
}
