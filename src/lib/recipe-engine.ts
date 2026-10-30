// Pure recipe analysis logic: formatting, nutrition, compliance, fixes.

export type Ingredient = {
  id?: string;
  ingredient_name: string;
  afcd_food_id: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  fibre_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  cooked_conversion_factor: number;
  density_g_per_cup: number;
};

export const UNITS = ["g", "kg", "ml", "l", "cup", "tbsp", "tsp", "oz", "lb", "fl oz"] as const;
export type Unit = (typeof UNITS)[number];

export type IngredientLine = {
  quantity: number;
  unit: Unit;
  name: string; // may include a note after a comma, e.g. "quinoa, rinsed"
  cooked?: boolean | undefined; // quantity is measured cooked
};

export type RecipeInput = {
  title: string;
  servings: number;
  total_time_mins: number;
  ingredients: IngredientLine[];
  method: string;
};

export const TARGETS = {
  protein: { min: 30 },
  fibre: { min: 8 },
  carbs: { min: 55, max: 70 },
  fat: { min: 14, max: 18 },
  calories: { min: 450, max: 550 },
  maxIngredients: 10,
  servingGrams: { min: 350, max: 550 },
  servingCups: { min: 2, max: 3.5 },
  proteinSourceMinG: 5, // per serving, to count as a distinct protein source
};

export const MEAL_TYPES = ["Bowl", "Curry & Stew", "Stir-fry", "Pasta & Noodles", "Salad", "Soup", "Bake", "Wrap & Taco", "Breakfast"];
export const THEME_NIGHTS = ["Breakfast for dinner", "Build a bowl night", "Cosy curry & stew night", "Noodle knockout", "Pasta power hour", "Sandwich stack attack", "Soup-er simple supper night", "Stir-Fry & Sizzle Session", "Quick & Easy (under 15mins)", "Fake-away"];

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const f1 = (n: number) => {
  const v = r1(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

export const ML_PER_CUP = 240;
const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;
const ML_PER_FLOZ = 29.5735;

export function baseName(name: string) {
  return (name.split(",")[0] ?? "").trim().toLowerCase();
}
export function noteOf(name: string) {
  const i = name.indexOf(",");
  return i >= 0 ? name.slice(i + 1).trim() : "";
}

export function findIngredient(db: Ingredient[], name: string) {
  const b = baseName(name);
  return db.find((i) => i.ingredient_name.toLowerCase() === b);
}

/** Grams of the line as entered (raw unless `cooked`). */
export function lineGrams(line: IngredientLine, ing?: Ingredient): number {
  const d = ing?.density_g_per_cup ?? ML_PER_CUP;
  const q = line.quantity || 0;
  switch (line.unit) {
    case "g": return q;
    case "kg": return q * 1000;
    case "oz": return q * G_PER_OZ;
    case "lb": return q * G_PER_LB;
    case "cup": return q * d;
    case "tbsp": return (q * d) / 16;
    case "tsp": return (q * d) / 48;
    case "ml": return (q * d) / ML_PER_CUP;
    case "l": return (q * 1000 * d) / ML_PER_CUP;
    case "fl oz": return (q * ML_PER_FLOZ * d) / ML_PER_CUP;
  }
}

/** Raw grams and cooked grams/cups for a line. */
export function lineYield(line: IngredientLine, ing?: Ingredient) {
  const factor = ing?.cooked_conversion_factor || 1;
  const density = ing?.density_g_per_cup || ML_PER_CUP;
  const entered = lineGrams(line, ing);
  const raw = line.cooked ? entered / factor : entered;
  const cooked = raw * factor;
  const cookedCups = (raw / density) * factor; // volume scales with the same factor
  return { raw, cooked, cookedCups };
}

export function formatLine(line: IngredientLine, ing?: Ingredient): string {
  const q = line.quantity;
  const name = line.name.trim();
  const state = line.cooked ? "cooked " : ing && ing.cooked_conversion_factor > 1.2 ? "uncooked " : "";
  const label = `${state}${name}`;
  switch (line.unit) {
    case "g": return `${f1(q)} g (${f1(q / G_PER_OZ)} oz) ${label}`;
    case "kg": return `${f1(q)} kg (${f1((q * 1000) / G_PER_LB)} lb) ${label}`;
    case "oz": return `${f1(q * G_PER_OZ)} g (${f1(q)} oz) ${label}`;
    case "lb": return `${f1(q * G_PER_LB)} g (${f1(q)} lb) ${label}`;
    case "ml": return `${f1(q)} ml (${f1(q / ML_PER_FLOZ)} fl oz) ${label}`;
    case "l": return `${f1(q)} l (${f1((q * 1000) / ML_PER_FLOZ)} fl oz) ${label}`;
    case "fl oz": return `${f1(q * ML_PER_FLOZ)} ml (${f1(q)} fl oz) ${label}`;
    case "cup": {
      const g = lineGrams(line, ing);
      const unit = q === 1 ? "cup" : "cups";
      return ing ? `${f1(q)} ${unit} (${f1(g)} g) ${label}` : `${f1(q)} ${unit} (${f1(q * ML_PER_CUP)} ml) ${label}`;
    }
    case "tbsp": return `${f1(q)} tbsp ${label}`;
    case "tsp": return `${f1(q)} tsp ${label}`;
  }
}

/** Convert °C/°F temps and metric g/ml in free text to "metric (imperial)". */
export function formatMethod(method: string): string {
  let out = method.replace(/(\d+(?:\.\d+)?)\s*(?:°\s*|degrees\s*)([CF])\b(?:elsius|ahrenheit)?(?!\s*\()/gi, (_m, a, u) => {
    const v = parseFloat(a);
    return u.toUpperCase() === "C" ? `${f1(v)}°C (${f1(v * 9 / 5 + 32)}°F)` : `${f1((v - 32) * 5 / 9)}°C (${f1(v)}°F)`;
  });
  out = out.replace(/(\d+(?:\.\d+)?)\s*(g|ml)\b(?!\s*\()/g, (_m, a, u) => {
    const n = parseFloat(a);
    return u === "g" ? `${f1(n)} g (${f1(n / G_PER_OZ)} oz)` : `${f1(n)} ml (${f1(n / ML_PER_FLOZ)} fl oz)`;
  });
  return out
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
}

const TIME_RULES: { re: RegExp; mins: number; label: string }[] = [
  { re: /brown rice/i, mins: 35, label: "cooking brown rice" },
  { re: /\brice\b/i, mins: 18, label: "cooking rice" },
  { re: /quinoa/i, mins: 15, label: "cooking quinoa" },
  { re: /lentil/i, mins: 18, label: "cooking lentils" },
  { re: /\b(bake|roast)/i, mins: 25, label: "baking/roasting" },
  { re: /simmer/i, mins: 15, label: "simmering" },
  { re: /\bboil/i, mins: 10, label: "boiling" },
  { re: /\b(saut[eé]|fry|pan-fry|stir-fry|brown)/i, mins: 6, label: "pan cooking" },
  { re: /\b(marinate|soak)/i, mins: 30, label: "marinating/soaking" },
];

export function checkTime(r: RecipeInput, db: Ingredient[]) {
  const text = `${r.method} ${r.ingredients.filter((l) => !l.cooked).map((l) => l.name).join(" ")}`;
  const hits = TIME_RULES.filter((t) => t.re.test(text));
  // longest cooking step drives time; brown rice supersedes generic rice
  const filtered = hits.filter((h) => !(h.label === "cooking rice" && hits.some((x) => x.label === "cooking brown rice")));
  const longest = filtered.reduce((m, h) => (h.mins > m.mins ? h : m), { mins: 0, label: "" } as { mins: number; label: string });
  const steps = r.method.split(/\n+/).filter((s) => s.trim()).length;
  const prep = Math.min(15, 2 + r.ingredients.length);
  const estimate = Math.max(longest.mins + prep, steps * 1.5);
  void db;
  const stated = r.total_time_mins;
  let flag: string | null = null;
  if (stated < estimate * 0.6) {
    flag = `Total time of ${f1(stated)} mins seems too low${longest.label ? ` for a recipe involving ${longest.label}` : ` for ${steps} method steps`} (estimated ~${Math.round(estimate)} mins).`;
  } else if (stated > estimate * 2.5 && stated - estimate > 20) {
    flag = `Total time of ${f1(stated)} mins seems high for this method (estimated ~${Math.round(estimate)} mins).`;
  }
  return { estimate: Math.round(estimate), flag };
}

export type Nutrition = { calories: number; protein: number; fibre: number; carbs: number; fat: number };

export type LineAnalysis = {
  line: IngredientLine;
  ing?: Ingredient | undefined;
  raw: number;
  cooked: number;
  cookedCups: number;
  perServing: Nutrition;
};

export function analyseLines(r: RecipeInput, db: Ingredient[]): LineAnalysis[] {
  const s = Math.max(1, r.servings || 1);
  return r.ingredients.map((line) => {
    const ing = findIngredient(db, line.name);
    const y = lineYield(line, ing);
    const k = y.raw / 100 / s;
    const perServing: Nutrition = ing
      ? { calories: ing.calories_per_100g * k, protein: ing.protein_per_100g * k, fibre: ing.fibre_per_100g * k, carbs: ing.carbs_per_100g * k, fat: ing.fat_per_100g * k }
      : { calories: 0, protein: 0, fibre: 0, carbs: 0, fat: 0 };
    return { line, ing, ...y, perServing };
  });
}

export function sumNutrition(lines: LineAnalysis[]): Nutrition {
  return lines.reduce(
    (a, l) => ({ calories: a.calories + l.perServing.calories, protein: a.protein + l.perServing.protein, fibre: a.fibre + l.perServing.fibre, carbs: a.carbs + l.perServing.carbs, fat: a.fat + l.perServing.fat }),
    { calories: 0, protein: 0, fibre: 0, carbs: 0, fat: 0 },
  );
}

/** Serving size: total cooked yield (g and cups) ÷ servings. Always computed the same way. */
export function servingSize(lines: LineAnalysis[], servings: number) {
  const s = Math.max(1, servings || 1);
  const grams = lines.reduce((a, l) => a + l.cooked, 0) / s;
  const cups = lines.reduce((a, l) => a + l.cookedCups, 0) / s;
  const { min, max } = TARGETS.servingGrams;
  let flag: string | null = null;
  if (grams < min) flag = `Each serving is about ${f1(grams)} g (${f1(cups)} cups) plated — below the ${min}–${max} g main-meal range. Consider fewer servings or more ingredients.`;
  else if (grams > max) flag = `Each serving is about ${f1(grams)} g (${f1(cups)} cups) plated — above the ${min}–${max} g main-meal range. Consider more servings.`;
  return { grams, cups, flag };
}

export type Status = "pass" | "warn" | "fail";
export type Check = { label: string; value: string; target: string; status: Status; note?: string | undefined };

export function proteinSources(lines: LineAnalysis[]) {
  return lines.filter((l) => l.ing && l.perServing.protein >= TARGETS.proteinSourceMinG);
}

export function mealTypeFlag(n: Nutrition, grams: number, lines: LineAnalysis[]): string | null {
  const names = lines.map((l) => baseName(l.line.name)).join(" ");
  if (n.calories < 300 || grams < 250) return "This looks more like a snack than a main meal.";
  if (/oats|yoghurt|granola/.test(names) && !/rice|quinoa|lentil|tofu|tempeh|beans|chickpea/.test(names)) return "This looks more like a breakfast than a main meal.";
  return null;
}

const range = (v: number, t: { min: number; max?: number }): Status => (v >= t.min && (t.max === undefined || v <= t.max) ? "pass" : "fail");

export function compliance(r: RecipeInput, lines: LineAnalysis[], n: Nutrition, grams: number) {
  const checks: Check[] = [
    { label: "Protein", value: `${f1(n.protein)} g`, target: "≥ 30 g", status: range(n.protein, TARGETS.protein) },
    { label: "Fibre", value: `${f1(n.fibre)} g`, target: "≥ 8 g", status: range(n.fibre, TARGETS.fibre) },
    { label: "Carbs", value: `${f1(n.carbs)} g`, target: "55–70 g", status: range(n.carbs, TARGETS.carbs) },
    { label: "Fats", value: `${f1(n.fat)} g`, target: "14–18 g", status: range(n.fat, TARGETS.fat) },
    { label: "Calories", value: `${f1(n.calories)} kcal`, target: "450–550 kcal", status: range(n.calories, TARGETS.calories) },
  ];
  const count = r.ingredients.length;
  checks.push({ label: "Ingredient limit", value: `${count}`, target: "≤ 10", status: count <= TARGETS.maxIngredients ? "pass" : "fail", note: count > 10 ? `${count - 10} over the limit` : undefined });
  const ps = proteinSources(lines);
  checks.push({
    label: "Distinct protein sources",
    value: `${ps.length}`,
    target: "3+",
    status: ps.length >= 3 ? "pass" : ps.length === 2 ? "warn" : "fail",
    note: ps.length ? ps.map((p) => p.ing!.ingredient_name).join(", ") : "None found",
  });
  const mt = mealTypeFlag(n, grams, lines);
  checks.push({ label: "Meal type", value: mt ? "Not a main" : "Main meal", target: "Main meal", status: mt ? "warn" : "pass", note: mt ?? undefined });
  const overall: Status = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "pass";
  return { checks, overall };
}

export type Fix = { kind: "scale" | "swap" | "add" | "side"; title: string; detail: string; projectedProtein?: number | undefined; projectedServingG?: number | undefined };

const SWAPS: Record<string, string[]> = {
  "white rice": ["quinoa", "red lentils"],
  "brown rice": ["quinoa", "red lentils"],
  "rolled oats": ["quinoa"],
  "baby spinach": ["edamame"],
  chickpeas: ["edamame", "tempeh"],
  "white beans": ["edamame", "tempeh"],
  "black beans": ["edamame", "tempeh"],
};

/** Fix suggestions in priority order: scale → swap → add 3rd protein; plus sides. */
export function fixSuggestions(r: RecipeInput, db: Ingredient[], lines: LineAnalysis[], n: Nutrition, grams: number): Fix[] {
  const fixes: Fix[] = [];
  const s = Math.max(1, r.servings || 1);
  const deficit = TARGETS.protein.min - n.protein;
  const maxG = TARGETS.servingGrams.max;
  const sources = proteinSources(lines);

  if (deficit > 0) {
    // 1. Scale existing protein ingredients (up to 2x each), staying within serving size.
    const candidates = lines.filter((l) => l.ing && l.ing.protein_per_100g >= 5).sort((a, b) => b.ing!.protein_per_100g - a.ing!.protein_per_100g);
    let scaledOk = false;
    for (const l of candidates) {
      const ing = l.ing!;
      const extraRawPerServing = (deficit / ing.protein_per_100g) * 100;
      const newServing = grams + extraRawPerServing * ing.cooked_conversion_factor;
      const ratio = 1 + (extraRawPerServing * s) / Math.max(l.raw, 1);
      if (ratio <= 2 && newServing <= maxG) {
        const newQty = l.line.quantity * ratio;
        fixes.push({
          kind: "scale",
          title: `Increase ${ing.ingredient_name}`,
          detail: `${formatLine(l.line, ing)} → ${formatLine({ ...l.line, quantity: r1(newQty) }, ing)} (+${f1((ratio - 1) * 100)}%).`,
          projectedProtein: n.protein + deficit,
          projectedServingG: newServing,
        });
        scaledOk = true;
        break;
      }
    }
    if (!scaledOk && candidates.length) {
      // proportional 1.5x across all protein ingredients as a partial option
      const gain = candidates.reduce((a, l) => a + l.perServing.protein * 0.5, 0);
      const addG = candidates.reduce((a, l) => a + (l.cooked / s) * 0.5, 0);
      if (grams + addG <= maxG && gain > 0) {
        fixes.push({ kind: "scale", title: "Scale all protein ingredients by 1.5×", detail: `Increase ${candidates.map((c) => c.ing!.ingredient_name).join(", ")} by 50%. Helps, but may not reach 30 g alone.`, projectedProtein: n.protein + gain, projectedServingG: grams + addG });
      }
    }

    // 2. Swap lower-protein ingredient for a higher-protein equivalent.
    if (!scaledOk) {
      const inRecipe = new Set(lines.map((l) => baseName(l.line.name)));
      for (const l of lines) {
        if (!l.ing) continue;
        const opts = SWAPS[l.ing.ingredient_name.toLowerCase()] ?? [];
        const target = opts.map((o) => db.find((d) => d.ingredient_name.toLowerCase() === o)).find((d) => d && !inRecipe.has(d.ingredient_name.toLowerCase()) && d.protein_per_100g > l.ing!.protein_per_100g);
        if (!target) continue;
        const gain = ((target.protein_per_100g - l.ing.protein_per_100g) * l.raw) / 100 / s;
        const newServing = grams + ((l.raw * target.cooked_conversion_factor) - l.cooked) / s;
        fixes.push({ kind: "swap", title: `Swap ${l.ing.ingredient_name} → ${target.ingredient_name}`, detail: `Use ${f1(l.raw)} g (${f1(l.raw / G_PER_OZ)} oz) uncooked ${target.ingredient_name} instead of ${l.ing.ingredient_name}.`, projectedProtein: n.protein + gain, projectedServingG: newServing });
      }
    }

    // 3. Add a 3rd protein source if needed (and room under the ingredient limit).
    const best = fixes.reduce((m, f) => Math.max(m, f.projectedProtein ?? 0), n.protein);
    if ((best < TARGETS.protein.min || sources.length < 3) && r.ingredients.length < TARGETS.maxIngredients) {
      const inRecipe = new Set(lines.map((l) => baseName(l.line.name)));
      const pick = db.filter((d) => !inRecipe.has(d.ingredient_name.toLowerCase()) && d.protein_per_100g >= 10).sort((a, b) => b.protein_per_100g / b.calories_per_100g - a.protein_per_100g / a.calories_per_100g)[0];
      if (pick) {
        const need = Math.max(deficit, TARGETS.proteinSourceMinG);
        const gPer = (need / pick.protein_per_100g) * 100;
        fixes.push({ kind: "add", title: `Add ${pick.ingredient_name} as a 3rd protein`, detail: `Add ${f1(gPer * s)} g (${f1((gPer * s) / G_PER_OZ)} oz) ${pick.ingredient_name} (${f1(gPer)} g per serving).`, projectedProtein: n.protein + need, projectedServingG: grams + gPer * pick.cooked_conversion_factor });
      }
    }
  } else if (sources.length < 3 && r.ingredients.length < TARGETS.maxIngredients) {
    const inRecipe = new Set(lines.map((l) => baseName(l.line.name)));
    const pick = db.filter((d) => !inRecipe.has(d.ingredient_name.toLowerCase()) && d.protein_per_100g >= 10).sort((a, b) => b.protein_per_100g - a.protein_per_100g)[0];
    if (pick) {
      const gPer = (TARGETS.proteinSourceMinG / pick.protein_per_100g) * 100;
      fixes.push({ kind: "add", title: `Add ${pick.ingredient_name} as a 3rd protein`, detail: `Add ${f1(gPer * s)} g ${pick.ingredient_name} (${f1(gPer)} g per serving) to reach 3 distinct proteins.`, projectedProtein: n.protein + TARGETS.proteinSourceMinG, projectedServingG: grams + gPer * pick.cooked_conversion_factor });
    }
  }

  // Complementary sides
  if (n.fibre < TARGETS.fibre.min) fixes.push({ kind: "side", title: "Side: leafy green salad", detail: "A side of greens with a handful of beans lifts fibre without changing the main." });
  if (n.carbs < TARGETS.carbs.min) fixes.push({ kind: "side", title: "Side: wholegrain flatbread", detail: "Adds complex carbs to bring the meal into the 55–70 g range." });
  if (n.calories < TARGETS.calories.min && n.fat < TARGETS.fat.min) fixes.push({ kind: "side", title: "Side: avocado or tahini drizzle", detail: "Healthy fats to lift calories and fat into range." });
  return fixes;
}

export function suggestCategory(r: RecipeInput): { meal_type: string; theme_nights: string[] } {
  const t = `${r.title} ${r.method} ${r.ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
  const isNoodle = /noodle|ramen|udon|soba|\bpho\b|vermicelli|lo mein|chow mein/.test(t);
  const isPasta = /pasta|spaghetti|penne|fusilli|lasagn|macaroni|tagliatelle|farfalle|gnocchi/.test(t);
  let meal_type = "Bowl";
  if (/curry|dal|dhal|stew|masala|korma/.test(t)) meal_type = "Curry & Stew";
  else if (/stir.?fry|wok|noodle|ramen|udon|soba|\bpho\b/.test(t)) meal_type = isNoodle ? "Pasta & Noodles" : "Stir-fry";
  else if (isPasta) meal_type = "Pasta & Noodles";
  else if (/soup|broth/.test(t)) meal_type = "Soup";
  else if (/taco|wrap|burrito|tortilla/.test(t)) meal_type = "Wrap & Taco";
  else if (/bake|roast|casserole/.test(t)) meal_type = "Bake";
  else if (/salad/.test(t)) meal_type = "Salad";
  else if (/oats|porridge|yoghurt bowl/.test(t)) meal_type = "Breakfast";
  const themes = new Set<string>();
  if (meal_type === "Breakfast" || /porridge|oats|yoghurt|yogurt|tofu scramble|pancake|breakfast/.test(t)) themes.add("Breakfast for dinner");
  if (meal_type === "Bowl" || /bowl/.test(t)) themes.add("Build a bowl night");
  if (meal_type === "Curry & Stew") themes.add("Cosy curry & stew night");
  if (isNoodle) themes.add("Noodle knockout");
  if (isPasta) themes.add("Pasta power hour");
  if (meal_type === "Wrap & Taco" || /sandwich|toastie|bagel|panini|quesadilla|\bsub\b|\broll\b|filler/.test(t)) themes.add("Sandwich stack attack");
  if (meal_type === "Soup") themes.add("Soup-er simple supper night");
  if (meal_type === "Stir-fry" || /stir.?fry|wok/.test(t)) themes.add("Stir-Fry & Sizzle Session");
  if (r.total_time_mins > 0 && r.total_time_mins <= 15) themes.add("Quick & Easy (under 15mins)");
  if (/fake.?away|burger|satay|teriyaki|katsu|kebab|schnitzel|nugget|fish finger|pizza|mac ?& ?cheese|fish and chip|spring roll|dim sum/.test(t)) themes.add("Fake-away");
  return { meal_type, theme_nights: THEME_NIGHTS.filter((x) => themes.has(x)) };
}

export type Analysis = ReturnType<typeof analyseRecipe>;

export function analyseRecipe(r: RecipeInput, db: Ingredient[]) {
  const lines = analyseLines(r, db);
  const unknown = lines.filter((l) => !l.ing).map((l) => baseName(l.line.name));
  const nutrition = sumNutrition(lines);
  const serving = servingSize(lines, r.servings);
  const time = checkTime(r, db);
  const comp = compliance(r, lines, nutrition, serving.grams);
  const fixes = comp.overall === "pass" ? [] : fixSuggestions(r, db, lines, nutrition, serving.grams);
  const formattedIngredients = lines.map((l) => formatLine(l.line, l.ing));
  const formattedMethod = formatMethod(r.method);
  const suggestion = suggestCategory(r);
  return { lines: lines.map((l) => ({ name: l.line.name, raw: l.raw, cooked: l.cooked, protein: l.perServing.protein, known: !!l.ing })), unknown, nutrition, serving, time, compliance: comp, fixes, formattedIngredients, formattedMethod, suggestion };
}

export function recipeToText(r: RecipeInput, a: Pick<Analysis, "formattedIngredients" | "formattedMethod">) {
  return [
    r.title,
    `Serves ${f1(r.servings)} · Total time ${f1(r.total_time_mins)} mins`,
    "",
    "Ingredients",
    ...a.formattedIngredients.map((l) => `- ${l}`),
    "",
    "Method",
    a.formattedMethod,
  ].join("\n");
}

// ---------- Free-text ingredient parsing & fuzzy matching ----------

const UNIT_ALIASES: Record<string, Unit> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  cup: "cup", cups: "cup", c: "cup",
  tbsp: "tbsp", tbs: "tbsp", tbl: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", T: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", t: "tsp",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  "fl oz": "fl oz", floz: "fl oz",
};
const FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };

export type ParsedLine = IngredientLine & { raw: string };

function parseQty(s: string): number {
  let t = s.trim();
  let total = 0;
  for (const [f, v] of Object.entries(FRACTIONS)) if (t.includes(f)) { total += v; t = t.replace(f, "").trim(); }
  if (!t) return total;
  if (/^\d+\s+\d+\/\d+$/.test(t)) { const [w, fr] = t.split(/\s+/); const [a, b] = fr!.split("/"); return total + Number(w) + Number(a) / Number(b); }
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split("/"); return total + Number(a) / Number(b); }
  if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(t)) { const [a, b] = t.split("-"); return total + (Number(a) + Number(b)) / 2; }
  return total + (Number(t) || 0);
}

/** Parse "185 g uncooked quinoa, rinsed" → {quantity:185, unit:"g", name:"quinoa, rinsed"}. */
export function parseIngredientLine(raw: string): ParsedLine {
  let s = raw.trim().replace(/^[-*•]\s*/, "");
  const qm = s.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)|(?:\d*(?:\.\d+)?\s*[½⅓⅔¼¾⅛])|(?:\d+(?:\.\d+)?))\s*/);
  let quantity = 0;
  if (qm && qm[1]!.trim()) { quantity = parseQty(qm[1]!); s = s.slice(qm[0].length); }
  let unit: Unit = "g";
  const um = s.match(/^(fl\.?\s?oz|[A-Za-z]+)\.?(?=\s|$)\s*/);
  let hasUnit = false;
  if (um) {
    const key = um[1]!.replace(/\.|\s/g, "").toLowerCase() === "floz" ? "fl oz" : (um[1] === "T" || um[1] === "t" ? um[1] : um[1]!.toLowerCase());
    const u = UNIT_ALIASES[key];
    if (u) { unit = u; hasUnit = true; s = s.slice(um[0].length); }
  }
  if (!hasUnit && quantity) unit = "g";
  s = s.replace(/^of\s+/i, "");
  let cooked = false;
  if (/\b(uncooked|raw|dry|dried)\b/i.test(s.split(",")[0]!)) s = s.replace(/\b(uncooked|raw)\b\s*/i, "");
  else if (/\bcooked\b/i.test(s.split(",")[0]!)) { cooked = true; s = s.replace(/\bcooked\b\s*/i, ""); }
  return { raw, quantity, unit, name: s.trim().replace(/\s+/g, " "), cooked };
}

const STOP = new Set(["of", "the", "a", "an", "fresh", "chopped", "diced", "sliced", "minced", "rinsed", "drained", "uncooked", "cooked", "raw", "large", "small", "medium", "organic", "and"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/(es|s)$/, ""));

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]!; d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length]!;
}

/** Similarity 0..1 between a typed name and a database ingredient name. */
export function matchScore(typed: string, dbName: string): number {
  return Math.max(scoreTokens(tokens(baseName(typed)), tokens(dbName)), scoreTokens(tokens(typed), tokens(dbName)));
}
function scoreTokens(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  if (a.join(" ") === b.join(" ")) return 1;
  let hit = 0;
  for (const w of b) {
    const best = Math.max(...a.map((x) => (x === w ? 1 : Math.max(x.length, w.length) >= 4 && lev(x, w) <= 1 ? 0.85 : 0)));
    hit += best;
  }
  const extra = a.filter((x) => !b.some((w) => x === w || lev(x, w) <= 1)).length;
  return (hit / b.length) * (1 / (1 + extra * 0.25));
}

/** Best database match for a typed name, or null if nothing is close enough. */
export function fuzzyMatch(db: Ingredient[], typed: string, threshold = 0.6): Ingredient | null {
  const exact = findIngredient(db, typed);
  if (exact) return exact;
  let best: Ingredient | null = null, bestS = 0;
  for (const i of db) { const s = matchScore(typed, i.ingredient_name); if (s > bestS) { bestS = s; best = i; } }
  return bestS >= threshold ? best : null;
}
