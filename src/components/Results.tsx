import { toast } from "sonner";
import { Copy, AlertTriangle, TrendingUp, Repeat, Plus, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { f1, recipeToText, TARGETS, type Analysis, type RecipeInput } from "@/lib/recipe-engine";

function Section({ n, title, children, right }: { n: number; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-sm text-secondary-foreground">{n}</span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 rounded-lg bg-warning/20 p-3 text-sm text-warning-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span>
    </div>
  );
}

const fixIcon = { scale: TrendingUp, swap: Repeat, add: Plus, side: Salad };

export function Results({ recipe, a }: { recipe: RecipeInput; a: Analysis }) {
  const n = a.nutrition;
  const copy = async () => {
    await navigator.clipboard.writeText(recipeToText(recipe, a));
    toast.success("Formatted recipe copied");
  };
  return (
    <div className="space-y-5">
      <Section n={1} title="Standardised Recipe" right={<Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" /> Copy Formatted Recipe</Button>}>
        <h3 className="text-2xl font-bold">{recipe.title}</h3>
        <p className="text-sm text-muted-foreground">Serves {f1(recipe.servings)} · Total time {f1(recipe.total_time_mins)} mins</p>
        {a.time.flag && <Flag>{a.time.flag}</Flag>}
        <div className="mt-5 grid gap-6 md:grid-cols-[2fr_3fr]">
          <div>
            <h4 className="mb-2 font-semibold">Ingredients</h4>
            <ul className="space-y-1.5 text-sm">
              {a.formattedIngredients.map((l, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{l}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">Method</h4>
            <ol className="space-y-2 text-sm">
              {a.formattedMethod.split("\n").filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        </div>
      </Section>

      <Section n={2} title="Nutrition Report (per serving)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="col-span-2 rounded-xl bg-primary p-4 text-primary-foreground sm:col-span-1">
            <div className="text-xs uppercase opacity-80">Protein</div>
            <div className="font-display text-3xl font-bold">{f1(n.protein)} g</div>
          </div>
          {[["Calories", `${f1(n.calories)} kcal`], ["Fibre", `${f1(n.fibre)} g`], ["Carbs", `${f1(n.carbs)} g`], ["Fat", `${f1(n.fat)} g`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-muted p-4">
              <div className="text-xs uppercase text-muted-foreground">{k}</div>
              <div className="text-xl font-bold">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border p-4 text-sm">
          <div className="font-semibold">Serving size check</div>
          <p className="text-muted-foreground">Estimated cooked yield per serving: <strong className="text-foreground">{f1(a.serving.grams)} g ({f1(a.serving.cups)} cups)</strong> · target {TARGETS.servingGrams.min}–{TARGETS.servingGrams.max} g / {TARGETS.servingCups.min}–{TARGETS.servingCups.max} cups plated.</p>
          {a.serving.flag ? <Flag>{a.serving.flag}</Flag> : <p className="mt-1 text-success">✅ Sensible main-meal portion.</p>}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ingredient breakdown</summary>
          <table className="mt-2 w-full text-left">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1">Ingredient</th><th>Raw (total)</th><th>Cooked (total)</th><th>Protein / serve</th></tr></thead>
            <tbody>
              {a.lines.map((l, i) => (
                <tr key={i} className="border-t"><td className="py-1">{l.name}{!l.known && " ⚠️"}</td><td>{f1(l.raw)} g</td><td>{f1(l.cooked)} g</td><td>{f1(l.protein)} g</td></tr>
              ))}
            </tbody>
          </table>
        </details>
        {a.unknown.length > 0 && <Flag>Not in database (excluded from nutrition): {a.unknown.join(", ")}</Flag>}
      </Section>

      <Section n={3} title="Compliance Check" right={<StatusBadge status={a.compliance.overall} big />}>
        <div className="divide-y rounded-xl border">
          {a.compliance.checks.map((c) => (
            <div key={c.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{c.label}</div>
                {c.note && <div className="text-xs text-muted-foreground">{c.note}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{c.value}</span>
                <span className="text-xs text-muted-foreground">{c.target}</span>
                <StatusBadge status={c.status} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {a.compliance.overall !== "pass" && a.fixes.length > 0 && (
        <Section n={4} title="Fix Suggestions">
          <ol className="space-y-3">
            {a.fixes.map((f, i) => {
              const Icon = fixIcon[f.kind];
              return (
                <li key={i} className="flex gap-3 rounded-xl border p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold">{f.title}</div>
                    <p className="text-sm text-muted-foreground">{f.detail}</p>
                  </div>
                  {f.projectedProtein !== undefined && (
                    <div className="text-right text-sm">
                      <div className="font-bold text-primary">{f1(f.projectedProtein)} g</div>
                      <div className="text-xs text-muted-foreground">protein{f.projectedServingG ? ` · ${f1(f.projectedServingG)} g serve` : ""}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      )}
    </div>
  );
}
