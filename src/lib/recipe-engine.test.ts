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
    expect(c.checks[0].status).toBe("fail");
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
