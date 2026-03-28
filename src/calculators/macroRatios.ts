import { MacroAggregate } from "../services/TrackerProcessor";

export interface MacroRatios {
    proteinPct: number;
    fatPct: number;
    carbsPct: number;
    fibrePct: number;
}

export function calculateMacroRatios(aggregate: MacroAggregate): MacroRatios {
    const totalCals = aggregate.calories || 1; // avoid division by zero
    
    // Calculate calories from each macro based on standard multipliers
    // Protein: 4 kcal/g, Fat: 9 kcal/g, Carbs: 4 kcal/g, Fibre: 2 kcal/g (optional, but standard for this plugin)
    const proteinPct = Math.round((aggregate.protein * 4 / totalCals) * 100) || 0;
    const fatPct = Math.round((aggregate.fat * 9 / totalCals) * 100) || 0;
    const carbsPct = Math.round((aggregate.carbs * 4 / totalCals) * 100) || 0;
    const fibrePct = Math.round((aggregate.fibre * 2 / totalCals) * 100) || 0;

    return {
        proteinPct,
        fatPct,
        carbsPct,
        fibrePct
    };
}
