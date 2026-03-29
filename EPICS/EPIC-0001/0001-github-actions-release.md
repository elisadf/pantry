# EPIC-0001: GitHub Actions Release

## Issue
Create a GitHub Actions workflow to automate the release process of the Obsidian plugin based on standard Obsidian practices.

## Plan
1. Create a `.github/workflows/release.yml` file.
2. Configure the workflow to trigger on the push of any tag (`*`).
3. Define a build job running on `ubuntu-latest`.
4. Setup Node.js v20.
5. Install dependencies and run `npm run build`.
6. Use `softprops/action-gh-release@v2` to create a GitHub release and attach the build artifacts (`main.js`, `manifest.json`, `styles.css`).
7. Store the plan and todo inside the `EPICS` directory structure.

## Todos
- [x] Create `.github/workflows` directory
- [x] Write `release.yml` workflow file
- [x] Create EPIC directory structure
- [x] Write Plan and Todo to EPIC markdown file
