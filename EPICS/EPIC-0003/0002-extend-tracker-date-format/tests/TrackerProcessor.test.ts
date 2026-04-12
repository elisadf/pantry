import { TrackerProcessor } from "../../../../src/services/TrackerProcessor";
import { App } from "obsidian";
import { RecipeFileManager } from "../../../../src/services/RecipeFileManager";
import { PantryPluginSettings } from "../../../../src/settings";
import { MarkdownSettingsService } from "../../../../src/services/MarkdownSettingsService";

jest.mock("obsidian", () => ({
    App: jest.fn(),
    TFile: jest.fn(),
    Notice: jest.fn(),
    parseYaml: jest.fn(),
    Modal: class {},
    Setting: class {},
    Plugin: class {},
    MarkdownView: class {}
}));

describe("TrackerProcessor.parseDate", () => {
    let processor: TrackerProcessor;

    beforeEach(() => {
        // Create dummy objects since parseDate doesn't use them
        const app = {} as App;
        const recipeManager = {} as RecipeFileManager;
        const settings = {} as PantryPluginSettings;
        const markdownSettingsService = {} as MarkdownSettingsService;
        
        processor = new TrackerProcessor(app, recipeManager, settings, markdownSettingsService);
    });

    it("should parse legacy YYYY-MM-DD format correctly", () => {
        const date = processor.parseDate("2026-04-12");
        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(3); // April is 0-indexed
        expect(date?.getDate()).toBe(12);
    });

    it("should parse DD-Mmm-YYYY format correctly", () => {
        const date = processor.parseDate("12-Apr-2026");
        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(3);
        expect(date?.getDate()).toBe(12);
    });

    it("should parse standard string date format correctly", () => {
        const date = processor.parseDate("April 12, 2026");
        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2026);
        expect(date?.getMonth()).toBe(3);
        expect(date?.getDate()).toBe(12);
    });

    it("should return null for invalid date strings", () => {
        const date = processor.parseDate("not-a-valid-date-string");
        expect(date).toBeNull();
    });
});
