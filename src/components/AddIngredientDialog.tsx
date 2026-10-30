import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ingredientsKey } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["afcd_food_id", "AFCD food ID", "text"],
  ["calories_per_100g", "Calories / 100 g", "number"],
  ["protein_per_100g", "Protein / 100 g", "number"],
  ["fibre_per_100g", "Fibre / 100 g", "number"],
  ["carbs_per_100g", "Carbs / 100 g", "number"],
  ["fat_per_100g", "Fat / 100 g", "number"],
  ["cooked_conversion_factor", "Cooked conversion factor", "number"],
  ["density_g_per_cup", "Grams per cup", "number"],
] as const;

export function AddIngredientDialog({ name, open, onOpenChange, onAdded }: { name: string; open: boolean; onOpenChange: (o: boolean) => void; onAdded?: (name: string) => void }) {
  const qc = useQueryClient();
  const [ingName, setIngName] = useState(name.trim().toLowerCase());
  const [vals, setVals] = useState<Record<string, string>>({ cooked_conversion_factor: "1", density_g_per_cup: "240" });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const num = (k: string) => Number(vals[k] || 0);
    const { error } = await supabase.from("ingredients").insert({
      ingredient_name: ingName.trim().toLowerCase(),
      afcd_food_id: vals["afcd_food_id"] || null,
      calories_per_100g: num("calories_per_100g"),
      protein_per_100g: num("protein_per_100g"),
      fibre_per_100g: num("fibre_per_100g"),
      carbs_per_100g: num("carbs_per_100g"),
      fat_per_100g: num("fat_per_100g"),
      cooked_conversion_factor: num("cooked_conversion_factor") || 1,
      density_g_per_cup: num("density_g_per_cup") || 240,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added “${ingName}” to the ingredient database`);
    await qc.invalidateQueries({ queryKey: ingredientsKey });
    onAdded?.(ingName.trim().toLowerCase());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add “{name}”</DialogTitle>
          <DialogDescription>Enter raw values per 100 g. Conversion factor = cooked weight ÷ raw weight (rice ≈ 3, spinach ≈ 0.1).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="ing_name">Ingredient name</Label>
            <Input id="ing_name" value={ingName} onChange={(e) => setIngName(e.target.value)} />
          </div>
          {FIELDS.map(([k, label, type]) => (
            <div key={k} className={k === "afcd_food_id" ? "col-span-2 space-y-1" : "space-y-1"}>
              <Label htmlFor={k}>{label}</Label>
              <Input id={k} type={type} step="any" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || !ingName.trim()}>{busy ? "Saving…" : "Add ingredient"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
