import { DailyAggregate, MacroAggregate } from "../services/TrackerProcessor";

export interface RollingAverageResult {
    count: number;
    averages: MacroAggregate;
}

export function calculateRollingAverage(dailyBreakdown: DailyAggregate[], todayStr: string): RollingAverageResult | null {
    const validDays = dailyBreakdown.filter(day => {
        const isValidDate = day.date <= todayStr;
        const hasMacros = day.aggregate.calories > 0 || 
               day.aggregate.protein > 0 || 
               day.aggregate.fat > 0 || 
               day.aggregate.carbs > 0 || 
               day.aggregate.fibre > 0;
        return isValidDate && hasMacros;
    });

    const count = validDays.length;
    if (count === 0) return null;

    const sum = validDays.reduce((acc, day) => {
        acc.calories += day.aggregate.calories;
        acc.protein += day.aggregate.protein;
        acc.fat += day.aggregate.fat;
        acc.carbs += day.aggregate.carbs;
        acc.fibre += day.aggregate.fibre;
        return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 });

    const averages = {
        calories: sum.calories / count,
        protein: sum.protein / count,
        fat: sum.fat / count,
        carbs: sum.carbs / count,
        fibre: sum.fibre / count
    };

    return { count, averages };
}
