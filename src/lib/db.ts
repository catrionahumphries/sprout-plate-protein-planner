import { supabase } from "@/integrations/supabase/client";
import type { Ingredient } from "./recipe-engine";

export const ingredientsKey = ["ingredients"];

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase.from("ingredients").select("*").order("ingredient_name");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    calories_per_100g: Number(d.calories_per_100g),
    protein_per_100g: Number(d.protein_per_100g),
    fibre_per_100g: Number(d.fibre_per_100g),
    carbs_per_100g: Number(d.carbs_per_100g),
    fat_per_100g: Number(d.fat_per_100g),
    cooked_conversion_factor: Number(d.cooked_conversion_factor),
    density_g_per_cup: Number(d.density_g_per_cup),
  }));
}
