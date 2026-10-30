import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { MEAL_TYPES, THEME_NIGHTS, f1, type Status } from "@/lib/recipe-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Recipe Library — Recipe Standardiser" },
      { name: "description", content: "Browse saved plant-based recipes by meal type and theme night." },
      { property: "og:title", content: "Recipe Library — Recipe Standardiser" },
      { property: "og:description", content: "Browse saved plant-based recipes by meal type and theme night." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryLayout,
});

function LibraryLayout() {
  const match = useMatchRoute();
  if (match({ to: "/library/$id" })) return <Outlet />;
  return <Library />;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-full border px-3 py-1 text-sm transition", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{children}</button>;
}

function Library() {
  const [meal, setMeal] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipes").select("id,title,servings,total_time_mins,meal_type,theme_nights,compliance_status,nutrition,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const list = data.filter((r) => (!meal || r.meal_type === meal) && (!theme || r.theme_nights.includes(theme)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="text-4xl font-extrabold">Recipe Library</h1>
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-sm font-medium">Meal type</span><Chip active={!meal} onClick={() => setMeal(null)}>All</Chip>{MEAL_TYPES.map((m) => <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>{m}</Chip>)}</div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-sm font-medium">Theme night</span><Chip active={!theme} onClick={() => setTheme(null)}>All</Chip>{THEME_NIGHTS.map((t) => <Chip key={t} active={theme === t} onClick={() => setTheme(t)}>{t}</Chip>)}</div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && list.length === 0 && <p className="text-muted-foreground">No recipes yet. <Link to="/" className="text-primary underline">Analyse one</Link>.</p>}
        {list.map((r) => {
          const n = (r.nutrition as { nutrition?: { protein: number; calories: number } } | null)?.nutrition;
          return (
            <Link key={r.id} to="/library/$id" params={{ id: r.id }} className="group rounded-2xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold group-hover:text-primary">{r.title}</h3>
                {r.compliance_status && <StatusBadge status={r.compliance_status as Status} />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.meal_type} · serves {f1(Number(r.servings))} · {f1(Number(r.total_time_mins ?? 0))} mins</p>
              {n && <p className="mt-3 text-sm"><strong className="text-primary">{f1(n.protein)} g protein</strong> · {f1(n.calories)} kcal</p>}
              <div className="mt-3 flex flex-wrap gap-1">{r.theme_nights.map((t) => <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{t}</span>)}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
