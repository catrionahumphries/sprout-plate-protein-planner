import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddIngredientDialog } from "@/components/AddIngredientDialog";
import { Results } from "@/components/Results";
import { SaveRecipe } from "@/components/SaveRecipe";
import { fetchIngredients, ingredientsKey } from "@/lib/db";
import { analyseRecipe, baseName, fuzzyMatch, noteOf, parseIngredientLine, type Analysis, type IngredientLine, type ParsedLine, type RecipeInput } from "@/lib/recipe-engine";

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

type Match = { parsed: ParsedLine; match: string | null; auto: boolean };

function Index() {
  const { data: db = [] } = useQuery({ queryKey: ingredientsKey, queryFn: fetchIngredients });
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("2");
  const [time, setTime] = useState("");
  const [ingText, setIngText] = useState("");
  const [method, setMethod] = useState("");
  const [adding, setAdding] = useState<{ name: string; index: number } | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [result, setResult] = useState<{ recipe: RecipeInput; a: Analysis } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);

  const lines = ingText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const allMatched = !!matches && matches.every((m) => m.match);

  function analyse() {
    const ms = lines.map((l) => {
      const parsed = parseIngredientLine(l);
      const m = fuzzyMatch(db, parsed.name);
      return { parsed, match: m?.ingredient_name ?? null, auto: true };
    });
    setMatches(ms);
    setResult(null);
    setTimeout(() => matchRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function setMatch(i: number, name: string) {
    setMatches((ms) => ms && ms.map((m, j) => (j === i ? { ...m, match: name, auto: false } : m)));
  }

  function calculate() {
    if (!matches || !allMatched) return;
    const recipe: RecipeInput = {
      title: title.trim() || "Untitled recipe",
      servings: Number(servings) || 1,
      total_time_mins: Number(time) || 0,
      ingredients: matches.map<IngredientLine>(({ parsed, match }) => {
        const note = noteOf(parsed.name);
        return { quantity: parsed.quantity, unit: parsed.unit, name: note ? `${match}, ${note}` : match!, cooked: parsed.cooked };
      }),
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

        <div className="space-y-1.5">
          <Label htmlFor="ings">Ingredients</Label>
          <Textarea id="ings" rows={8} value={ingText} onChange={(e) => { setIngText(e.target.value); setMatches(null); setResult(null); }} placeholder={"One ingredient per line...\n185 g uncooked quinoa, rinsed\n200 g tempeh, cubed\n2 cups baby spinach"} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="method">Method</Label>
          <Textarea id="method" rows={6} value={method} onChange={(e) => setMethod(e.target.value)} placeholder={"Rinse and simmer quinoa for 15 mins.\nPan-fry tempeh until golden.\nToss with spinach and serve."} />
        </div>

        <Button size="lg" className="w-full sm:w-auto" onClick={analyse} disabled={lines.length === 0}>
          <Sparkles className="h-4 w-4" /> Analyse Recipe
        </Button>
      </div>

      {matches && (
        <div ref={matchRef} className="mt-10 rounded-2xl border bg-card p-5 shadow-soft sm:p-8">
          <h2 className="text-2xl font-bold">Ingredient Match</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check what each line matched to. Fix any mismatches before calculating nutrition.</p>
          <div className="mt-4 divide-y">
            {matches.map((m, i) => (
              <div key={i} className="grid items-center gap-2 py-3 sm:grid-cols-[1fr_260px]">
                <div>
                  <div className="font-medium">{m.parsed.raw}</div>
                  <div className="text-xs text-muted-foreground">
                    Read as: {m.parsed.quantity || "?"} {m.parsed.unit}{m.parsed.cooked ? " (cooked)" : ""} · “{m.parsed.name}”
                  </div>
                  {!m.match && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" /> No match found
                      <Button size="sm" variant="secondary" onClick={() => setAdding({ name: baseName(m.parsed.name), index: i })}><Plus className="h-3 w-3" /> Add to database</Button>
                    </div>
                  )}
                </div>
                <Select value={m.match ?? ""} onValueChange={(v) => setMatch(i, v)}>
                  <SelectTrigger className={m.match ? "" : "border-destructive"}><SelectValue placeholder="Pick an ingredient…" /></SelectTrigger>
                  <SelectContent>{db.map((d) => <SelectItem key={d.ingredient_name} value={d.ingredient_name}><span className="capitalize">{d.ingredient_name}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={calculate} disabled={!allMatched}>
            <Check className="h-4 w-4" /> {allMatched ? "Confirm & calculate nutrition" : "Match all ingredients to continue"}
          </Button>
        </div>
      )}

      <div ref={resultsRef} className="mt-10 space-y-5">
        {result && (
          <>
            <Results recipe={result.recipe} a={result.a} />
            <SaveRecipe key={JSON.stringify(result.a.suggestion)} recipe={result.recipe} a={result.a} />
          </>
        )}
      </div>

      {adding && <AddIngredientDialog name={adding.name} open onOpenChange={(o) => !o && setAdding(null)} onAdded={(n) => setMatch(adding.index, n)} />}
    </div>
  );
}
