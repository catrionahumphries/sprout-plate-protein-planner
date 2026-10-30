import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IngredientAutocomplete } from "@/components/IngredientAutocomplete";
import { AddIngredientDialog } from "@/components/AddIngredientDialog";
import { Results } from "@/components/Results";
import { SaveRecipe } from "@/components/SaveRecipe";
import { fetchIngredients, ingredientsKey } from "@/lib/db";
import { analyseRecipe, baseName, findIngredient, UNITS, type Analysis, type IngredientLine, type RecipeInput, type Unit } from "@/lib/recipe-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recipe Standardiser — analyse high-protein plant-based meals" },
      { name: "description", content: "Standardise plant-based recipes, calculate protein per serving and check macro targets." },
      { property: "og:title", content: "Recipe Standardiser" },
      { property: "og:description", content: "Standardise plant-based recipes, calculate protein per serving and check macro targets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Row = { quantity: string; unit: Unit; name: string; cooked: boolean };
const blank = (): Row => ({ quantity: "", unit: "g", name: "", cooked: false });

function Index() {
  const { data: db = [] } = useQuery({ queryKey: ingredientsKey, queryFn: fetchIngredients });
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("2");
  const [time, setTime] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);
  const [method, setMethod] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipe: RecipeInput; a: Analysis } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const filled = rows.filter((r) => r.name.trim());
  const missing = [...new Set(filled.filter((r) => !findIngredient(db, r.name)).map((r) => baseName(r.name)))];

  function analyse() {
    const recipe: RecipeInput = {
      title: title.trim() || "Untitled recipe",
      servings: Number(servings) || 1,
      total_time_mins: Number(time) || 0,
      ingredients: filled.map<IngredientLine>((r) => ({ quantity: Number(r.quantity) || 0, unit: r.unit, name: r.name.trim(), cooked: r.cooked })),
      method,
    };
    setResult({ recipe, a: analyseRecipe(recipe, db) });
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 rounded-3xl bg-hero p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">1-minute meals</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Standardise your recipe</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">Format, calculate protein per serving, check your macro targets and get fixes — in one click.</p>
      </header>

      <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-8">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
          <div className="space-y-1.5"><Label htmlFor="title">Recipe title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Smoky tempeh quinoa bowl" /></div>
          <div className="space-y-1.5"><Label htmlFor="serv">Servings</Label><Input id="serv" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="time">Total time (mins)</Label><Input id="time" type="number" min={0} value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>

        <div>
          <Label>Ingredients</Label>
          <div className="mt-2 space-y-2">
            {rows.map((r, i) => {
              const unknown = r.name.trim() && db.length > 0 && !findIngredient(db, r.name);
              return (
                <div key={i} className="grid grid-cols-[80px_100px_1fr_auto] items-center gap-2 sm:grid-cols-[90px_110px_1fr_auto_auto]">
                  <Input type="number" step="any" placeholder="Qty" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                  <Select value={r.unit} onValueChange={(v) => update(i, { unit: v as Unit })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <IngredientAutocomplete value={r.name} onChange={(v) => update(i, { name: v })} db={db} invalid={!!unknown} />
                  <Button variant="ghost" size="icon" aria-label="Remove ingredient" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  <label className="col-span-4 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-1">
                    <Checkbox checked={r.cooked} onCheckedChange={(c) => update(i, { cooked: !!c })} /> cooked
                  </label>
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setRows((r) => [...r, blank()])}><Plus className="h-4 w-4" /> Add ingredient</Button>
          {missing.length > 0 && (
            <div className="mt-3 rounded-lg bg-warning/20 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Not in the ingredient database:</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {missing.map((m) => <Button key={m} size="sm" variant="secondary" onClick={() => setAdding(m)}><Plus className="h-3 w-3" /> Add “{m}”</Button>)}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <Textarea id="method" rows={6} value={method} onChange={(e) => setMethod(e.target.value)} placeholder={"Rinse and simmer quinoa for 15 mins.\nPan-fry tempeh until golden.\nToss with spinach and serve."} />
        </div>

        <Button size="lg" className="w-full sm:w-auto" onClick={analyse} disabled={filled.length === 0}>
          <Sparkles className="h-4 w-4" /> Analyse Recipe
        </Button>
      </div>

      <div ref={resultsRef} className="mt-10 space-y-5">
        {result && (
          <>
            <Results recipe={result.recipe} a={result.a} />
            <SaveRecipe key={JSON.stringify(result.a.suggestion)} recipe={result.recipe} a={result.a} />
          </>
        )}
      </div>

      {adding && <AddIngredientDialog name={adding} open onOpenChange={(o) => !o && setAdding(null)} />}
    </div>
  );
}
