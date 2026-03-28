import { App, MarkdownPostProcessorContext } from 'obsidian';
import PantryPlugin from '../../main';
import { TrackerProcessor } from '../../services/TrackerProcessor';

export function registerTrackerProcessor(plugin: PantryPlugin): void {
    // Pass the app, recipeManager, and settings to the TrackerProcessor
    const processor = new TrackerProcessor(plugin.app, plugin.recipeManager, plugin.settings);
    
    plugin.registerMarkdownCodeBlockProcessor('tracker', async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        await processor.process(source, el, ctx);
    });
}
