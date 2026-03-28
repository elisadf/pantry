import { App, Modal, Notice } from "obsidian";

export class ErrorModal extends Modal {
    private message: string;
    private retryAction?: () => void;

    constructor(app: App, message: string, retryAction?: () => void) {
        super(app);
        this.message = message;
        this.retryAction = retryAction;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("nutrition-planner-modal");

        contentEl.createEl("h2", { text: "Error" });

        const errorContainer = contentEl.createDiv("error-message");
        errorContainer.setText(this.message);

        const buttonGroup = contentEl.createDiv("button-group");

        if (this.retryAction) {
            const retryBtn = buttonGroup.createEl("button", { text: "Retry", cls: "primary" });
            retryBtn.onclick = () => {
                this.close();
                if (this.retryAction) this.retryAction();
            };
        }

            }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
