import { App, Modal, Setting } from "obsidian";
import { MacroAggregate } from "../services/TrackerProcessor";

export class ServingSizeModal extends Modal {
    private recipeName: string;
    private currentServingSize: number;
    private originalServingSize: number;
    private originalMacros: MacroAggregate;
    private onConfirm: (newServingSize: number) => void;
    
    private currentMacrosPreview: MacroAggregate;
    private newServingSize: number;
    private previewContainer: HTMLElement;

    constructor(
        app: App,
        recipeName: string,
        currentServingSize: number,
        originalServingSize: number,
        currentMacros: MacroAggregate,
        onConfirm: (newServingSize: number) => void
    ) {
        super(app);
        this.recipeName = recipeName;
        this.currentServingSize = currentServingSize;
        this.originalServingSize = originalServingSize;
        // Reconstruct the original macros based on original serving size
        const scaleBack = originalServingSize / currentServingSize;
        this.originalMacros = {
            calories: Math.round(currentMacros.calories * scaleBack),
            protein: Math.round(currentMacros.protein * scaleBack * 10) / 10,
            fat: Math.round(currentMacros.fat * scaleBack * 10) / 10,
            carbs: Math.round(currentMacros.carbs * scaleBack * 10) / 10,
            fibre: Math.round(currentMacros.fibre * scaleBack * 10) / 10,
        };
        this.currentMacrosPreview = { ...currentMacros };
        this.newServingSize = currentServingSize;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: `Edit Serving Size` });
        contentEl.createEl("h3", { text: this.recipeName, cls: "serving-size-modal-recipe-name" });
        
        if (this.originalServingSize) {
            contentEl.createEl("p", { 
                text: `Recipe default: ${this.originalServingSize}g`,
                cls: "serving-size-modal-info" 
            });
        }

        new Setting(contentEl)
            .setName("Serving Size (g)")
            .setDesc("Enter the amount you actually consumed")
            .addText(text => text
                .setValue(this.newServingSize.toString())
                .onChange(value => {
                    const parsed = parseFloat(value);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.newServingSize = parsed;
                        this.updatePreview();
                    }
                })
            );

        this.previewContainer = contentEl.createDiv({ cls: "serving-size-preview" });
        this.renderPreview();

        const buttonContainer = contentEl.createDiv({ cls: "serving-size-modal-buttons" });
        
        const saveButton = buttonContainer.createEl("button", { text: "Save", cls: "mod-cta" });
        saveButton.onclick = () => {
            this.onConfirm(this.newServingSize);
            this.close();
        };

        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.onclick = () => {
            this.close();
        };
    }

    private updatePreview() {
        const scale = this.newServingSize / this.originalServingSize;
        this.currentMacrosPreview = {
            calories: Math.round(this.originalMacros.calories * scale),
            protein: Math.round(this.originalMacros.protein * scale * 10) / 10,
            fat: Math.round(this.originalMacros.fat * scale * 10) / 10,
            carbs: Math.round(this.originalMacros.carbs * scale * 10) / 10,
            fibre: Math.round(this.originalMacros.fibre * scale * 10) / 10,
        };
        this.renderPreview();
    }

    private renderPreview() {
        this.previewContainer.empty();
        this.previewContainer.createEl("h4", { text: "Macros Preview" });
        
        const grid = this.previewContainer.createDiv({ cls: "serving-size-preview-grid" });
        
        const renderMacro = (label: string, value: number, unit: string) => {
            const row = grid.createDiv({ cls: "serving-size-preview-row" });
            row.createSpan({ text: label, cls: "serving-size-preview-label" });
            row.createSpan({ text: `${value}${unit}`, cls: "serving-size-preview-value" });
        };

        renderMacro("Calories", this.currentMacrosPreview.calories, " kcal");
        renderMacro("Protein", this.currentMacrosPreview.protein, "g");
        renderMacro("Fat", this.currentMacrosPreview.fat, "g");
        renderMacro("Carbs", this.currentMacrosPreview.carbs, "g");
        renderMacro("Fibre", this.currentMacrosPreview.fibre, "g");
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
