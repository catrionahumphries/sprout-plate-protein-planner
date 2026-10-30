import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEAL_TYPES, THEME_NIGHTS, type Analysis, type RecipeInput } from "@/lib/recipe-engine";
import { cn } from "@/lib/utils";

export function SaveRecipe({ recipe, a }: { recipe: RecipeInput; a: Analysis }) {
  const [mealType, setMealType] = useState(a.suggestion.meal_type);
  const [themes, setThemes] = useState<string[]>(a.suggestion.theme_nights);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const toggle = (t: string) => setThemes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  async function save() {
    setBusy(true);
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: recipe.title,
        servings: recipe.servings,
        total_time_mins: recipe.total_time_mins,
        ingredients: recipe.ingredients,
        method: recipe.method,
        meal_type: mealType,
        theme_nights: themes,
        nutrition: a as never,
        compliance_status: a.compliance.overall,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved to library");
    nav({ to: "/library/$id", params: { id: data.id } });
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/40 p-5 sm:p-6">
      <h2 className="text-xl font-bold">Save & Categorise</h2>
      <p className="text-sm text-muted-foreground">Suggested from the recipe — adjust before saving.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          <Label>Meal type</Label>
          <Select value={mealType} onValueChange={setMealType}>
            <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{MEAL_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Theme nights</Label>
          <div className="flex flex-wrap gap-2">
            {THEME_NIGHTS.map((t) => (
              <button key={t} type="button" onClick={() => toggle(t)} className={cn("rounded-full border px-3 py-1 text-sm transition", themes.includes(t) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button className="mt-5" size="lg" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save to library"}</Button>
    </section>
  );
}
