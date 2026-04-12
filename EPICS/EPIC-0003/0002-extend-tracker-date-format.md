# 0002-extend-tracker-date-format

## Objective
The weekly tracker currently only parses `YYYY-MM-DD` formats from daily trackers. We need to extend this to support other formats such as `DD-Mmm-YYYY` (e.g. `12-Apr-2026`).

## Plan
1. Update `parseDate` in `src/services/TrackerProcessor.ts` to use `new Date(dateStr)` or `moment(dateStr)` to support various formats.
2. Ensure backward compatibility with the existing dash-split `YYYY-MM-DD` parser.
3. Write unit tests to verify both old and new date formats are correctly parsed.

## Todos
- [ ] Implement `parseDate` improvements
- [ ] Add unit tests
- [ ] Verify build and deploy