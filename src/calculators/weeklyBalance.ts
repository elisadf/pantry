import { FoodItemFrontmatter } from "../services/RecipeFileManager";

export interface WeeklyBalanceStats {
    totalCalories: number;
    totalProtein: number;
    totalFat: number;
    totalCarbs: number;
    totalFibre: number;
    percentages: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        fibre: number;
    };
    shortfalls: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        fibre: number;
    };
    weeklyTargets: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        fibre: number;
    };
    status: "green" | "amber" | "red";
}

export function calculateWeeklyBalance(
    recipes: { frontmatter: FoodItemFrontmatter; servings: number }[], 
    dailyCalorieTarget: number,
    dailyProteinTarget: number,
    dailyFatTarget: number,
    dailyCarbsTarget: number,
    dailyFibreTarget: number
): WeeklyBalanceStats {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalFibre = 0;

    // Aggregate from recipes
    recipes.forEach(({ frontmatter: recipe, servings }) => {
        const r = recipe as any;
        const parseNum = (val: any) => {
            if (val === undefined || val === null) return 0;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        };

        totalCalories += parseNum(r.calories || r.calorie_estimate_kcal) * servings;
        totalProtein += parseNum(r.protein || r.protein_estimate_g) * servings;
        totalFat += parseNum(r.fat || r.fat_estimate_g) * servings;
        totalCarbs += parseNum(r.carbs || r.carbs_estimate_g) * servings;
        totalFibre += parseNum(r.fibre || r.fibre_estimate_g) * servings;
    });

    // Weekly targets
    const weeklyTargets = {
        calories: dailyCalorieTarget * 7,
        protein: dailyProteinTarget * 7,
        fat: dailyFatTarget * 7,
        carbs: dailyCarbsTarget * 7,
        fibre: dailyFibreTarget * 7
    };

    const percentages = {
        calories: (totalCalories / weeklyTargets.calories) * 100,
        protein: (totalProtein / weeklyTargets.protein) * 100,
        fat: (totalFat / weeklyTargets.fat) * 100,
        carbs: (totalCarbs / weeklyTargets.carbs) * 100,
        fibre: (totalFibre / weeklyTargets.fibre) * 100
    };

    const shortfalls = {
        calories: Math.max(0, weeklyTargets.calories - totalCalories),
        protein: Math.max(0, weeklyTargets.protein - totalProtein),
        fat: Math.max(0, weeklyTargets.fat - totalFat),
        carbs: Math.max(0, weeklyTargets.carbs - totalCarbs),
        fibre: Math.max(0, weeklyTargets.fibre - totalFibre),
    };

    // Status calculation based on whether most macros are within 25% of target
    let status: "green" | "amber" | "red" = "red";
    
    const goodMacros = Object.values(percentages).filter(p => p >= 75 && p <= 125).length;
    const acceptableMacros = Object.values(percentages).filter(p => p >= 50 && p <= 150).length;

    if (goodMacros >= 4) {
        status = "green";
    } else if (acceptableMacros >= 3) {
        status = "amber";
    }

    return {
        totalCalories,
        totalProtein,
        totalFat,
        totalCarbs,
        totalFibre,
        percentages,
        shortfalls,
        weeklyTargets,
        status
    };
}

export function generateWeeklySummaryCodeblock(
    stats: WeeklyBalanceStats,
    energyUnit: 'kcal' | 'kJ'
): string {
    const calMultiplier = energyUnit === 'kcal' ? 1 : 4.184;

    return [
        '```weeklyplanner',
        `status: ${stats.status}`,
        `energyUnit: ${energyUnit}`,
        'targets:',
        `  calories: ${Math.round(stats.weeklyTargets.calories * calMultiplier)}`,
        `  protein: ${Math.round(stats.weeklyTargets.protein)}`,
        `  fat: ${Math.round(stats.weeklyTargets.fat)}`,
        `  carbs: ${Math.round(stats.weeklyTargets.carbs)}`,
        `  fibre: ${Math.round(stats.weeklyTargets.fibre)}`,
        'totals:',
        `  calories: ${Math.round(stats.totalCalories * calMultiplier)}`,
        `  protein: ${Math.round(stats.totalProtein)}`,
        `  fat: ${Math.round(stats.totalFat)}`,
        `  carbs: ${Math.round(stats.totalCarbs)}`,
        `  fibre: ${Math.round(stats.totalFibre)}`,
        '```',
    ].join('\n');
}
