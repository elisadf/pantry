import { MacroAggregate } from "../services/TrackerProcessor";
import { CategoryItem } from "../data/CategoriesData";

export function parseServingSize(size: string | number | undefined): number | null {
    if (size === undefined || size === null) return null;
    
    const sizeStr = size.toString().trim();
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)g$/i);
    
    if (match) {
        return parseFloat(match[1]);
    }
    
    return null;
}

export function calculateMacros(entry: CategoryItem, recipe: any): { macros: MacroAggregate, originalServingSize?: number, servingSize?: number } | null {
    const parseNum = (val: any) => {
        if (val === undefined || val === null) return 0;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    };

    const originalServingSize = parseServingSize(recipe.serving_size || recipe.default_serving_size);
    
    const baseServingSize = originalServingSize || 100;
    const effectiveServingSize = entry.units || baseServingSize;
    const scaleFactor = effectiveServingSize / baseServingSize;

    const macros = {
        calories: Math.round(parseNum(recipe.calories || recipe.calorie_estimate_kcal || 0) * scaleFactor),
        protein: Math.round(parseNum(recipe.protein || recipe.protein_estimate_g || 0) * scaleFactor * 10) / 10,
        fat: Math.round(parseNum(recipe.fat || recipe.fat_estimate_g || 0) * scaleFactor * 10) / 10,
        carbs: Math.round(parseNum(recipe.carbs || recipe.carbs_estimate_g || 0) * scaleFactor * 10) / 10,
        fibre: Math.round(parseNum(recipe.fibre || recipe.fibre_estimate_g || 0) * scaleFactor * 10) / 10,
    };

    console.info(`[Pantry] Calculated macros for "${entry.name}" with serving size ${effectiveServingSize}g:`, macros, "from raw recipe:", recipe);
    
    return { 
        macros, 
        originalServingSize: originalServingSize || undefined,
        servingSize: effectiveServingSize 
    };
}
