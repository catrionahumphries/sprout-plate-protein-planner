import { describe, expect, it } from "vitest";
import { analyseRecipe, formatLine, formatMethod, compliance, type Ingredient } from "./recipe-engine";

const ing = (name: string, p: number, kcal: number, fib: number, carb: number, fat: number, factor = 1, cup = 240): Ingredient => ({ ingredient_name: name, afcd_food_id: null, calories_per_100g: kcal, protein_per_100g: p, fibre_per_100g: fib, carbs_per_100g: carb, fat_per_100g: fat, cooked_conversion_factor: factor, density_g_per_cup: cup });
const db = [ing("quinoa", 14.1, 368, 7, 57.2, 6.1, 2.8, 170), ing("firm tofu", 15.8, 144, 2.3, 2.8, 8.7), ing("white rice", 6.8, 353, 1, 79, 0.6, 3, 185), ing("tempeh", 19, 193, 5, 7.6, 10.8, 1, 166)];

describe("formatting", () => {
  it("grams show oz in brackets to 1dp", () => expect(formatLine({ quantity: 185, unit: "g", name: "quinoa, rinsed" }, db[0])).toBe("185 g (6.5 oz) uncooked quinoa, rinsed"));
  it("cups show grams", () => expect(formatLine({ quantity: 1, unit: "cup", name: "quinoa" }, db[0])).toBe("1 cup (170 g) uncooked quinoa"));
  it("tbsp stays as-is", () => expect(formatLine({ quantity: 2, unit: "tbsp", name: "tahini" })).toBe("2 tbsp tahini"));
  it("°C converts to °F", () => expect(formatMethod("Bake at 180°C")).toBe("1. Bake at 180°C (356°F)"));
});

describe("compliance", () => {
  it("flags 5 min time for rice", () => {
    const a = analyseRecipe({ title: "x", servings: 1, total_time_mins: 5, ingredients: [{ quantity: 100, unit: "g", name: "white rice" }], method: "Cook rice." }, db);
    expect(a.time.flag).toMatch(/too low.*rice/);
  });
  it("1 protein source fails, 2 warns, 3 passes", () => {
    const run = (names: string[]) => analyseRecipe({ title: "x", servings: 1, total_time_mins: 30, ingredients: names.map((n) => ({ quantity: 100, unit: "g" as const, name: n })), method: "" }, db).compliance.checks.find((c) => c.label === "Distinct protein sources")!.status;
    expect(run(["tempeh"])).toBe("fail");
    expect(run(["tempeh", "firm tofu"])).toBe("warn");
    expect(run(["tempeh", "firm tofu", "quinoa"])).toBe("pass");
  });
  it("protein target is 30 g", () => {
    const c = compliance({ title: "", servings: 1, total_time_mins: 0, ingredients: [], method: "" }, [], { protein: 29.9, calories: 500, fibre: 8, carbs: 60, fat: 15 }, 400);
    expect(c.checks[0]?.status).toBe("fail");
  });
  it("more than 10 ingredients fails", () => {
    const a = analyseRecipe({ title: "x", servings: 1, total_time_mins: 30, ingredients: Array.from({ length: 11 }, () => ({ quantity: 10, unit: "g" as const, name: "tempeh" })), method: "" }, db);
    expect(a.compliance.checks.find((c) => c.label === "Ingredient limit")!.status).toBe("fail");
  });
  it("cooked yield uses conversion factor", () => {
    const a = analyseRecipe({ title: "x", servings: 1, total_time_mins: 30, ingredients: [{ quantity: 100, unit: "g", name: "white rice" }], method: "" }, db);
    expect(a.serving.grams).toBe(300);
  });
});

import { parseIngredientLine, fuzzyMatch } from "./recipe-engine";
describe("line parsing & matching", () => {
  it("parses grams, uncooked and note", () => {
    const p = parseIngredientLine("185 g uncooked quinoa, rinsed");
    expect([p.quantity, p.unit, p.name, p.cooked]).toEqual([185, "g", "quinoa, rinsed", false]);
  });
  it("parses fractions and cups and cooked", () => {
    const p = parseIngredientLine("1 1/2 cups cooked white rice");
    expect([p.quantity, p.unit, p.name, p.cooked]).toEqual([1.5, "cup", "white rice", true]);
  });
  it("fuzzy matches minor wording", () => {
    expect(fuzzyMatch(db, "quinoa, rinsed")?.ingredient_name).toBe("quinoa");
    expect(fuzzyMatch(db, "tofu, firm")?.ingredient_name).toBe("firm tofu");
    expect(fuzzyMatch(db, "chickpeas")).toBeNull();
  });
});

import { suggestCategory, THEME_NIGHTS } from "./recipe-engine";
describe("theme night suggestions", () => {
  const s = (title: string, mins = 30) => suggestCategory({ title, servings: 2, total_time_mins: mins, ingredients: [], method: "" });
  it("only ever suggests real theme nights", () => {
    for (const t of ["Spaghetti bolognese", "Ramen", "Dal", "Tofu toastie", "Chickpea katsu", "Porridge", "Pumpkin soup", "Veg stir-fry", "Quinoa bowl", "Taco night", "Paneer bake", "Garden salad"]) {
      for (const th of s(t).theme_nights) expect(THEME_NIGHTS).toContain(th);
    }
  });
  it("under 15 mins is Quick & Easy, 30 mins is not", () => {
    expect(s("Quinoa bowl", 12).theme_nights).toContain("Quick & Easy (under 15mins)");
    expect(s("Quinoa bowl", 30).theme_nights).not.toContain("Quick & Easy (under 15mins)");
    expect(s("Quinoa bowl", 0).theme_nights).not.toContain("Quick & Easy (under 15mins)");
  });
  it("noodles go to Noodle knockout, pasta to Pasta power hour", () => {
    expect(s("Ramen").theme_nights).toContain("Noodle knockout");
    expect(s("Ramen").theme_nights).not.toContain("Pasta power hour");
    expect(s("Spaghetti bolognese").theme_nights).toContain("Pasta power hour");
    expect(s("Spaghetti bolognese").theme_nights).not.toContain("Noodle knockout");
  });
  it("one theme night per style", () => {
    expect(s("Red lentil dal").theme_nights).toContain("Cosy curry & stew night");
    expect(s("Tofu toastie").theme_nights).toContain("Sandwich stack attack");
    expect(s("Chickpea katsu").theme_nights).toContain("Fake-away");
    expect(s("Porridge").theme_nights).toContain("Breakfast for dinner");
    expect(s("Pumpkin soup").theme_nights).toContain("Soup-er simple supper night");
    expect(s("Veg stir-fry").theme_nights).toContain("Stir-Fry & Sizzle Session");
    expect(s("Quinoa bowl").theme_nights).toContain("Build a bowl night");
  });
});
