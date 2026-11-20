# Sprout Plate Protein Planner

Build me a web app called "Recipe Standardiser" — a tool for checking and standardising high-protein, plant-based main-meal recipes.

Overview
This app helps me standardise my "1-minute meal" recipes into a consistent format, calculate protein per serving, check the serving size makes sense, verify the recipe meets my macro targets, and suggest fixes if it falls short. It also stores recipes in a filterable library.

Tech
Use Supabase for the backend (ingredient database + saved recipe library).
Clean, friendly, modern UI. Mobile-responsive.
Database tables (Supabase)
1. ingredients table with columns:

ingredient_name (text)
afcd_food_id (text)
calories_per_100g (numeric)
protein_per_100g (numeric)
fibre_per_100g (numeric)
carbs_per_100g (numeric)
fat_per_100g (numeric)
cooked_conversion_factor (numeric) — how much the ingredient's weight/volume changes when cooked (e.g. rice 3.0, lentils 2.5, spinach 0.1)
density_g_per_cup (numeric) — grams per cup, for converting cups ↔ grams
Seed this table with ~15 common plant-based ingredients (quinoa, red lentils, firm tofu, chickpeas, hemp seeds, white beans, baby spinach, brown rice, rolled oats, black beans, edamame, tempeh, peanut butter, pumpkin seeds, Greek-style soy yoghurt) using realistic AFCD-style per-100g values and conversion factors. I will replace/expand this later via CSV import.

2. recipes table to save recipes, with: title, servings, total_time_mins, ingredients (JSON), method (text), meal_type, theme_nights (array), nutrition results (JSON), compliance status, created_at.

The input form
A form to type in a recipe:

Recipe title
Servings (number)
Total time (minutes)
Ingredients — add rows, each with quantity + unit + ingredient. The ingredient field must have an autocomplete dropdown that matches the ingredients table. If an ingredient isn't found, flag it and let me add it to the database on the spot (entering its per-100g values + conversion factor + cup density).
Method — multi-line text
A single "Analyse Recipe" button runs everything at once and shows results in four clear sections on one results screen.

Results — Section 1: Standardised Recipe
Reformat the recipe into a consistent format:

Metric first, imperial in brackets, e.g. 185 g (6.5 oz) uncooked quinoa, rinsed
Apply to: weights (g → oz), volumes (ml → fl oz), temperatures (°C → °F)
Cups must also show grams/ml, e.g. 1 cup (170 g) quinoa
tbsp and tsp stay as-is (no conversion)
Round everything to 1 decimal place
Sense-check the total time: compare the stated total time against the method complexity and flag if it doesn't seem to match (e.g. "Total time of 5 mins seems too low for a recipe involving cooking rice").
Include a "Copy Formatted Recipe" button that copies the cleaned recipe to clipboard.
Results — Section 2: Nutrition Report (per serving)
Calculate protein per serving (primary metric) using the ingredient database. Also show calories, fibre, carbs, and fat per serving.
Account for cooked vs raw: use the cooked_conversion_factor so volume/weight estimates reflect cooked ingredients (rice doubles/triples, spinach shrinks, etc.).
Serving-size sense check: estimate the total cooked yield from the ingredients, divide by servings, and check each serving falls within a sensible main-meal range of roughly 2–3.5 cups / 350–550 g plated. Flag if outside this range. Keep this calculation method consistent every time.
Results — Section 3: Compliance Check
Check the recipe against these hardcoded main-meal macro targets (per serving):

Protein: 30 g or more ✅/❌
Fibre: 8 g or more ✅/❌
Carbs: 55–70 g ✅/❌
Fats: 14–18 g ✅/❌
Calories: 450–550 kcal ✅/❌
Also check these rules:

Ingredient limit: maximum 10 ingredients. Flag if over.
Distinct protein sources: FAIL if only 1 protein source, WARN/FLAG if 2, PASS if 3 or more.
Meal-type check: if the recipe's profile doesn't look like a main meal, flag it (e.g. "This looks more like a snack than a main meal").
Show an overall PASS / WARN / FAIL status.

Results — Section 4: Fix Suggestions (only shows if it fails)
The recipe must reach 30 g+ protein on its own — no protein boosters/add-ons philosophy. When a recipe falls short, suggest fixes in this priority order:

Scale up existing protein ingredients first (increase amounts within sensible limits, staying inside the serving-size range).
Swap a lower-protein ingredient for a higher-protein equivalent (e.g. white rice → quinoa) if scaling alone can't hit the target without breaking the serving size or the 10-ingredient limit.
Add a 3rd protein source only if needed to hit both 30 g protein AND satisfy the "3 distinct proteins = pass" rule — while staying under 10 ingredients.
For each suggestion, show the projected new protein value so I can see the impact. Also suggest complementary sides where relevant.

After analysis: Save & Categorise
Let me save the recipe to the library.
During analysis, suggest which meal type and which theme night(s) the recipe could be added to.
Let me confirm/edit the meal type and theme nights before saving.
Library page
A page listing all saved recipes.
Filter by meal type and by theme night.
Click a recipe to view its full standardised version + nutrition + compliance.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sprout-plate-protein-planner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2a0ab33f-4c59-4a6c-bda8-f7231e27d8ad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
