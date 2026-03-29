export interface WeeklyFoodItem {
    name: string;
    servings: number;
    category?: string;
}

export interface WeeklyPlannerData {
    foods: WeeklyFoodItem[];
}
