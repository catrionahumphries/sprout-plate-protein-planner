import { useState } from "react";
import { Input } from "@/components/ui/input";
import { baseName, type Ingredient } from "@/lib/recipe-engine";

export function IngredientAutocomplete({ value, onChange, db, invalid }: { value: string; onChange: (v: string) => void; db: Ingredient[]; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = baseName(value);
  const matches = q ? db.filter((i) => i.ingredient_name.toLowerCase().includes(q) && i.ingredient_name.toLowerCase() !== q).slice(0, 6) : db.slice(0, 6);
  const note = value.includes(",") ? value.slice(value.indexOf(",")) : "";

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder="e.g. quinoa, rinsed"
        aria-invalid={invalid}
        className={invalid ? "border-warning ring-1 ring-warning" : ""}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-soft">
          {matches.map((m) => (
            <li key={m.ingredient_name}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-secondary" onMouseDown={(e) => { e.preventDefault(); onChange(m.ingredient_name + note); setOpen(false); }}>
                <span className="capitalize">{m.ingredient_name}</span>
                <span className="text-xs text-muted-foreground">{m.protein_per_100g} g protein</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
