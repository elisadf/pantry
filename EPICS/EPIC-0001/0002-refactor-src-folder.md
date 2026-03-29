# Issue 0002: Refactor `src` folder architecture

## Goal
Refactor the `src` folder to group UI elements, services, APIs, and calculators into distinct, cleanly separated domains as per architectural guidelines.

## TODOs
- [ ] Create folder `src/ui/modals` and move all files from `src/modals`
- [ ] Create folder `src/ui/renders` and move `WeeklyTrackerRenderer.ts`, `TrackerTableRenderer.ts`, and `TrackerCardRenderer.ts` from `src/services`
- [ ] Create folder `src/services/apis` and move `FatSecretAPIService.ts` and `LLMAPIService.ts` from `src/services`
- [ ] Move `src/utils/WeeklyBalanceCalculator.ts` to `src/services/WeeklyNoteManager.ts`
- [ ] Verify `src/calculators` contains only statistical/math functions (`energy.ts`, `macroCalculators.ts`, `macroRatios.ts`, `rollingAverage.ts`, `weeklyBalance.ts`)
- [ ] Update all import paths across the codebase (`main.ts`, `settings.ts`, etc.)
- [ ] Create tests folder: `EPICS/EPIC-0001/0002-refactor-src-folder/tests/`
- [ ] Run `npm run deploy && obsidian plugin:reload id=obsidian-pantry` to verify build