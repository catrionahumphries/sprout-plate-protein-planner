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
  cooked?: boolean; // quantity is measured cooked
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
export const THEME_NIGHTS = ["Meatless Monday", "Taco Tuesday", "Curry Night", "Stir-fry Night", "Pasta Night", "Soup Night", "Bowl Night", "Fakeaway Friday", "Sunday Bake"];

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
  return name.split(",")[0].trim().toLowerCase();
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
  ing?: Ingredient;
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
export type Check = { label: string; value: string; target: string; status: Status; note?: string };

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

export type Fix = { kind: "scale" | "swap" | "add" | "side"; title: string; detail: string; projectedProtein?: number; projectedServingG?: number };

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
  let meal_type = "Bowl";
  if (/curry|dal|dhal|stew|masala|korma/.test(t)) meal_type = "Curry & Stew";
  else if (/stir.?fry|wok|noodle/.test(t)) meal_type = /noodle/.test(t) ? "Pasta & Noodles" : "Stir-fry";
  else if (/pasta|spaghetti|penne|lasagn/.test(t)) meal_type = "Pasta & Noodles";
  else if (/soup|broth/.test(t)) meal_type = "Soup";
  else if (/taco|wrap|burrito|tortilla/.test(t)) meal_type = "Wrap & Taco";
  else if (/bake|roast|casserole/.test(t)) meal_type = "Bake";
  else if (/salad/.test(t)) meal_type = "Salad";
  else if (/oats|porridge|yoghurt bowl/.test(t)) meal_type = "Breakfast";
  const themes = new Set<string>(["Meatless Monday"]);
  if (/taco|burrito|black beans|mexican|salsa/.test(t)) themes.add("Taco Tuesday");
  if (meal_type === "Curry & Stew") themes.add("Curry Night");
  if (meal_type === "Stir-fry" || /stir.?fry/.test(t)) themes.add("Stir-fry Night");
  if (meal_type === "Pasta & Noodles") themes.add("Pasta Night");
  if (meal_type === "Soup") themes.add("Soup Night");
  if (meal_type === "Bowl" || /bowl/.test(t)) themes.add("Bowl Night");
  if (/fakeaway|burger|satay|teriyaki|katsu|kebab/.test(t)) themes.add("Fakeaway Friday");
  if (meal_type === "Bake") themes.add("Sunday Bake");
  return { meal_type, theme_nights: [...themes] };
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
