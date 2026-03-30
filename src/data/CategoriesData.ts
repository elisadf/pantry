export interface CategoryItemBase {
    name: string;
    category?: string;
}

export interface CategoryItemUnits extends CategoryItemBase {
    units: number;
    servings?: never;
}

export interface CategoryItemServings extends CategoryItemBase {
    servings: number;
    units?: never;
}

export type CategoryItem = CategoryItemUnits | CategoryItemServings;

export interface CategoriesData {
    categories: string[];
    items?: CategoryItem[];
}
