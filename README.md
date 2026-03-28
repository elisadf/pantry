# Pantry

An Obsidian plugin for people who batch cook. Save recipes from anywhere, plan your week, and keep an eye on your nutrition — all inside your vault.

---

## What Pantry does

Pantry turns your Obsidian vault into a personal recipe library and nutrition tracker. You save recipes and foods as plain markdown files, plan your weekly meals, log what you eat each day, and see whether your week is balanced — without needing any external apps.

---

## Save recipes and foods from multiple sources

Pantry gives you four ways to add things to your library:

- **Paste a URL** — Drop in a link to any recipe page. Pantry sends it to an LLM of your choice, which reads the page, extracts the ingredients and instructions, estimates the macros, and gives you a structured recipe to review before saving.

- **Take a screenshot** — Useful for recipes behind paywalls (like Thermomix Cookidoo). Take a screenshot, and the LLM of your choice reads the image, pulls out the ingredients and steps, and estimates the nutrition. No login sharing needed.

- **Search FatSecret** — Look up individual foods (banana, chicken breast, oats) using the FatSecret API. Pantry pulls in the nutritional data per 100g and lets you set a custom default serving size before saving.

- **Add manually** — Type in a food name and its macros yourself. Good for homemade staples or anything you already know the numbers for.

Every item is saved as a markdown file in your vault with a standard YAML frontmatter schema:

```yaml
---
protein: 24
carbs: 3
fat: 8
fibre: 0
calories: 180
serving_size: 150g
source: manual
---
```

Recipes also get a markdown body with an ingredient list, step-by-step instructions, and optional callout notes (like "high in sodium" or "good source of fibre").

Foods and recipes use the same frontmatter schema, so the rest of the plugin treats them identically.

---

## Plan your week

The weekly planner is designed around a batch-cooking workflow. You open it up (when you do your planning), pick recipes for the week ahead, and Pantry immediately shows you how the week looks nutritionally.

**What the planner does:**

- Lets you select recipes from your library for each day of the week
- Calculates your weekly macro totals and compares them against your personal targets
- Shows macro progress bars colour-coded by how close you are to target (green = on track, amber = close, red = short)
- Flags nutritional gaps and suggests recipes from your own library to fill them — for example, "You're 83g short on carbs per day. Try adding Pasta ×2 or a brown rice side."
- Creates a weekly note in your vault with the full plan

Your macro targets (calories, protein, carbs, fat, fibre) are set in the plugin settings and calculated on a weekly basis.

Example of a week plan: 

<img width="727" height="472" alt="Screenshot 2026-03-28 at 20 36 13" src="https://github.com/user-attachments/assets/05c567ea-222d-4a49-81a9-d3f93b19cca2" />


---

## Track your daily macros

In your daily notes, you log what you eat using a simple fenced code block:

````
```tracker
id: 2026-03-22
Peanut Cacao Overnight Oats:300g
Quick and easy pork noodles:100g
Apples:50g
```
````

Example of a day of tracking: 

<img width="730" height="761" alt="Screenshot 2026-03-28 at 20 38 16" src="https://github.com/user-attachments/assets/0d313e56-6261-42a8-bfea-bfd7352b20d7" />



Pantry reads each entry, finds the matching file in your vault, scales the macros to the portion size you logged, and renders a summary widget with:

- A breakdown of each item's macros
- Daily totals for calories, protein, carbs, fat, and fibre
- Progress bars showing how you're tracking against your daily targets

There's a **+** button on the tracker that opens a modal where you can add a meal from your planner or an individual food from your library, set a custom serving size, and confirm. The entry gets written to your daily note automatically. You can also assign the meals to categories and build meals as you go.

---

## See how your week went

At the end of the week, Pantry gives you a view of how your actual intake compared to your targets across all seven days. This isn't about being perfect every day — it's about seeing whether your overall pattern is balanced.

The weekly view shows:

- Daily averages vs your targets for each macro
- Which macros you consistently hit and which ones tend to fall short
- Whether your diet covers the main food groups or is leaning too heavily in one direction (e.g. high protein but low on plants and fibre)

The goal is a quick sanity check: "Did my batch cook give me a balanced base this week?"

Example of a weekly view:

<img width="740" height="719" alt="Screenshot 2026-03-28 at 20 40 04" src="https://github.com/user-attachments/assets/e305f5da-b9e0-482e-8c66-68670889c047" />
<img width="676" height="346" alt="Screenshot 2026-03-28 at 20 39 56" src="https://github.com/user-attachments/assets/c6b1bb66-0e76-4564-b249-ff2127e04467" />

---

## Plugin settings

- **An LLM API key** — Required for URL parsing and screenshot-based recipe imports
- **FatSecret API credentials** — Required for food search
- **Recipe folder path** — Where recipe and food files are stored in your vault
- **Weekly notes folder path** — Where weekly plan notes are saved
- **Daily macro targets** — Calories, protein, carbs, fat, and fibre (used for progress bars and gap analysis)

Example of customised settings:

<img width="789" height="633" alt="Screenshot 2026-03-28 at 20 41 43" src="https://github.com/user-attachments/assets/2ca9a76d-ce03-4f85-81cc-8b96fca60d97" />

---

## How data is stored

Everything lives in your Obsidian vault as plain markdown files with YAML frontmatter. There's no database, no external sync, no cloud dependency. Your recipes, foods, meals, and weekly plans are just files you own.

- **Foods and recipes**: Markdown files with macro data in frontmatter
- **Meals**: Markdown files with computed macros and an ingredients list in frontmatter
- **Daily tracking**: Fenced code blocks in your daily notes
- **Weekly plans**: Generated markdown notes

---

## Tech stack

- TypeScript (standard Obsidian plugin)
- LLM API of your choice for recipe parsing from URLs and screenshots
- FatSecret API for food nutritional data lookup
- No Dataview dependency — all calculations are done on the fly by the plugin

---

## Requirements

- Obsidian v1.0+
- An LLM API key (for URL and screenshot recipe imports)
- A FatSecret API key (for food search)
