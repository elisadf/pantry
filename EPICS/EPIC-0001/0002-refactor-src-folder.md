# Issue 0002: Refactor `src` folder architecture

## Goal
Refactor the `src` folder to group UI elements, services, APIs, and calculators into distinct, cleanly separated domains as per architectural guidelines.

## TODOs
- [x] Create folder `src/ui/modals` and move all files from `src/modals`
- [x] Create folder `src/ui/renders` and move `WeeklyTrackerRenderer.ts`, `TrackerTableRenderer.ts`, and `TrackerCardRenderer.ts` from `src/services`
- [x] Create folder `src/services/apis` and move `FatSecretAPIService.ts` and `LLMAPIService.ts` from `src/services`
- [x] Move `src/utils/WeeklyBalanceCalculator.ts` to `src/services/WeeklyNoteManager.ts`
- [x] Verify `src/calculators` contains only statistical/math functions (`energy.ts`, `macroCalculators.ts`, `macroRatios.ts`, `rollingAverage.ts`, `weeklyBalance.ts`)
- [x] Update all import paths across the codebase (`main.ts`, `settings.ts`, etc.)
- [x] Create tests folder: `EPICS/EPIC-0001/0002-refactor-src-folder/tests/`
- [x] Run `npm run deploy && obsidian plugin:reload id=obsidian-pantry` to verify build