import { CategoryItem } from './CategoriesData';

export interface WeeklyPlannerData {
    foods: CategoryItem[];
}

export interface WeeklyFoodItem {
    name: string;
    servings: number;
    category?: string;
}

export interface WeeklyPlannerV2Data {
    foods: WeeklyFoodItem[];
}
