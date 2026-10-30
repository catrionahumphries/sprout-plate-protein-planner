import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Results } from "@/components/Results";
import type { Analysis, IngredientLine, RecipeInput } from "@/lib/recipe-engine";

export const Route = createFileRoute("/library/$id")({
  head: () => ({
    meta: [
      { title: "Saved recipe — Recipe Standardiser" },
      { name: "description", content: "Standardised recipe with nutrition and compliance results." },
      { property: "og:title", content: "Saved recipe — Recipe Standardiser" },
      { property: "og:description", content: "Standardised recipe with nutrition and compliance results." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Link to="/library" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Library</Link>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && !data && <p>Recipe not found.</p>}
      {data && (() => {
        const recipe: RecipeInput = { title: data.title, servings: Number(data.servings), total_time_mins: Number(data.total_time_mins ?? 0), ingredients: data.ingredients as unknown as IngredientLine[], method: data.method ?? "" };
        return (
          <>
            <div className="mb-5 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">{data.meal_type}</span>
              {data.theme_nights.map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{t}</span>)}
            </div>
            <Results recipe={recipe} a={data.nutrition as unknown as Analysis} />
          </>
        );
      })()}
    </div>
  );
}
