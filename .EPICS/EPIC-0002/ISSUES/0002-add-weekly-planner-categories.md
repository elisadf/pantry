# Add Category Section to Weekly Planner

**Goal:** Allow users to group their planned foods by category (e.g., Breakfast, Lunch, Dinner) in the Weekly Planner V2, without breaking backwards compatibility.

## Plan

1. **Update Data Model**
   - Update `src/data/WeeklyPlannerData.ts` to include `category?: string` on `WeeklyFoodItem`.
   
2. **Update Modals and Internal Types**
   - Update `PlannedFoodItem` in `src/ui/modals/FoodListEditorModal.ts` to include `category?: string`.
   - In `FoodListEditorModal`, assign the default category from the recipe's frontmatter when adding a new food.
   - Pass available categories to `EditWeeklyServingModal`.
   - Handle the `newCategory` returned from `EditWeeklyServingModal` in `FoodListEditorModal`.
   
3. **Update Renderer and YAML Serialization**
   - In `src/ui/renders/WeeklyPlannerRenderer.ts`, pass available categories to `EditWeeklyServingModal`.
   - Update the YAML serialization in `WeeklyPlannerRenderer` and `FoodListEditorModal` to output the `category` property.
   - Refactor the render logic in `WeeklyPlannerRenderer` to group the `data.foods` items by category and render them under section headers (e.g., "Breakfast", "Lunch"). Default missing categories to "Uncategorized".

## Status
- [x] Create Epic Issue
- [ ] Update `src/data/WeeklyPlannerData.ts`
- [ ] Update `src/ui/modals/FoodListEditorModal.ts`
- [ ] Update `src/ui/renders/WeeklyPlannerRenderer.ts`
- [ ] Test the build with `npm run deploy`