# Epic: Weekly Planner UI and Note Output Upgrades

## Overview
**Epic ID:** 0001-Weekly-Planner-Upgrade
**Issue ID:** 0001-ui-and-note-output-upgrades
**Status:** Completed
**Date:** 2025-03-28

This epic covers targeted upgrades to the UI and note output for the Weekly Planner feature in the Pantry Obsidian plugin.

## Files Modified

### 1. WeeklyBalanceCalculator.ts
**Location:** `src/utils/WeeklyBalanceCalculator.ts`

#### Changes Made:

##### 1a. Added shortfalls calculation to calculateBalance()
- **Purpose:** Enables gap-aware suggestions in the modal
- **Implementation:** Computed shortfalls using Math.max(0, weeklyTargets[macro] - total[Macro])
- **Returned:** Added `shortfalls` object to the return value containing all macro shortfalls

##### 1b. Replaced generateSummaryMarkdown() with generateSummaryCodeblock()
- **Previous:** Generated markdown table with emoji bars
- **New:** Generates YAML codeblock wrapped in ```weeklyplanner fences
- **Benefits:** 
  - Cleaner note output
  - Rich rendering in Obsidian via custom processor
  - Consistent with Obsidian codeblock patterns
- **Output Structure:**
  - status: green|amber|red
  - energyUnit: kcal|kJ
  - targets: {calories, protein, fat, carbs, fibre}
  - totals: {calories, protein, fat, carbs, fibre}

##### 1c. Stripped frontmatter from createWeeklyNote()
- **Removed:** YAML frontmatter block (--- ... ---)
- **Removed:** Weekly Extras section
- **Kept:** 
  - Title: `# Weekly Plan: {weekString}`
  - Summary codeblock
  - Selected Recipes section with wiki links
- **Note:** extras parameter retained in signature for backward compatibility

### 2. WeeklyPlannerModal.ts
**Location:** `src/modals/WeeklyPlannerModal.ts`

#### Changes Made:

##### 2a. Added renderBar() helper method
- **Purpose:** Visual macro progress bars in modal
- **Parameters:** container, label, pct, current, target, unit
- **Output:** Creates a row with label, progress track, fill bar, and value display

##### 2b. Fixed bar colors to hardcoded hex values
- **Previous:** Used CSS variables (--color-green, --color-orange, --color-red)
- **New:** Hardcoded hex colors:
  - Green: #1D9E75 (≥80%)
  - Amber: #BA7517 (≥50%)
  - Red: #C0392B (<50%)
- **Reason:** CSS variables don't resolve in Obsidian's context

##### 2c. Replaced stat rows with renderBar() calls
- Replaced 5 manual stat divs with renderBar() calls
- Displays: Energy, Protein, Fat, Carbs, Fibre
- Shows current/target values with percentage

##### 2d. Added gap notice
- **Trigger:** When any macro is under 80%
- **Display:** Warning text showing which macros are under target
- **Format:** "⚠️ [macro(s)] are under target"

##### 2e. Added recipe suggestions for short macros
- **Logic:** Identifies primary gap (lowest macro) and suggests top 3 recipes
- **Sorting:** Unselected recipes sorted by deficient macro descending
- **UI:** Clickable suggestion pills that add recipes to selection
- **Behavior:** Clicking pill adds recipe and re-renders modal

##### 2f. Redesigned recipe list UI
- **Previous:** Simple checkbox list
- **New:** RecipeSearchModal-style interface with:
  - Debounced search input with icon
  - Category filter dropdown
  - Scrollable results container
  - Clickable row selection
  - Efficient updateSelectionUI pattern
- **Benefits:** Consistent UX across Pantry, better performance, easier filtering

### 3. main.ts
**Location:** `src/main.ts`

#### Changes Made:

##### 3a. Added parseYaml import
- **Import:** Added `parseYaml` from 'obsidian'
- **Purpose:** Parse YAML content from weeklyplanner codeblocks

##### 3b. Registered weeklyplanner codeblock processor
- **Method:** registerMarkdownCodeBlockProcessor('weeklyplanner', ...)
- **Functionality:**
  - Parses YAML from codeblock
  - Renders status badge with color coding
  - Creates visual macro progress bars
  - Displays current/target values
- **Colors:** Uses same hex values as modal bars
- **Benefits:** Rich preview in notes without editing

### 4. styles.css
**Location:** `styles.css`

#### Changes Made:

##### 4a. Added weeklyplanner-block styles
```css
.weeklyplanner-block {
    padding: 12px 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-secondary);
    margin: 8px 0;
}
.weeklyplanner-status { ... }
.weeklyplanner-status--green { color: #1D9E75; }
.weeklyplanner-status--amber { color: #BA7517; }
.weeklyplanner-status--red   { color: #C0392B; }
```

##### 4b. Updated macro bar dimensions
- **Previous:**
  - Label width: 60px
  - Track height: 8px
  - Border-radius: 4px
  - Value width: 120px
- **New:**
  - Label width: 72px
  - Track height: 10px
  - Border-radius: 5px
  - Value width: 140px
  - Label font: 13px, weight 500, color text-normal

##### 4c. Added gap-related styles
- `.gap-notice` - Warning text styling
- `.gap-suggestions` - Container for suggestion pills
- `.suggestion-pill` - Clickable recipe suggestion buttons
- `.suggestion-pill:hover` - Hover state

## Testing
- ✅ Shortfalls calculated correctly
- ✅ Codeblock format generated properly
- ✅ Notes created without frontmatter or extras
- ✅ Modal renders visual bars with correct colors
- ✅ Gap notice appears when macros <80%
- ✅ Suggestion pills generated for short macros
- ✅ Clicking pill adds recipe to selection
- ✅ CSS applied correctly to modal and codeblock
- ✅ Search and filter work with debouncing
- ✅ Recipe list redesigned with RecipeSearchModal patterns

## Summary
All requirements from the brief have been implemented:
- Core calculation logic preserved (no refactoring of calculateBalance())
- Shortfalls added to enable gap-aware suggestions
- Markdown output replaced with codeblock format
- Frontmatter and extras stripped from generated notes
- Visual macro bars added to modal with gap notices
- Recipe suggestions added for short macros
- Bar colors fixed to hardcoded hex values
- Recipe list UI redesigned to match RecipeSearchModal
- Custom codeblock processor registered in main.ts
- All CSS classes added and updated