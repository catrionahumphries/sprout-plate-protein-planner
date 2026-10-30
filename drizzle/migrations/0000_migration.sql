CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name text NOT NULL UNIQUE,
  afcd_food_id text,
  calories_per_100g numeric NOT NULL DEFAULT 0,
  protein_per_100g numeric NOT NULL DEFAULT 0,
  fibre_per_100g numeric NOT NULL DEFAULT 0,
  carbs_per_100g numeric NOT NULL DEFAULT 0,
  fat_per_100g numeric NOT NULL DEFAULT 0,
  cooked_conversion_factor numeric NOT NULL DEFAULT 1,
  density_g_per_cup numeric NOT NULL DEFAULT 240,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO anon, authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open ingredients" ON public.ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  servings numeric NOT NULL DEFAULT 1,
  total_time_mins numeric,
  ingredients jsonb NOT NULL DEFAULT '[]',
  method text,
  meal_type text,
  theme_nights text[] NOT NULL DEFAULT '{}',
  nutrition jsonb,
  compliance_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO anon, authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open recipes" ON public.recipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ingredients (ingredient_name, afcd_food_id, calories_per_100g, protein_per_100g, fibre_per_100g, carbs_per_100g, fat_per_100g, cooked_conversion_factor, density_g_per_cup) VALUES
('quinoa','F007445',368,14.1,7.0,57.2,6.1,2.8,170),
('red lentils','F005211',334,24.6,11.0,48.0,1.3,2.5,190),
('firm tofu','F009210',144,15.8,2.3,2.8,8.7,1.0,250),
('chickpeas','F002201',139,7.0,6.4,15.5,2.4,1.0,165),
('hemp seeds','F004102',553,31.6,4.0,8.7,48.8,1.0,160),
('white beans','F001630',105,6.6,6.3,12.8,0.6,1.0,180),
('baby spinach','F008632',23,2.9,2.2,1.4,0.4,0.1,30),
('brown rice','F007560',360,7.5,3.4,75.0,2.7,2.5,190),
('rolled oats','F006324',375,12.5,10.0,58.0,8.5,2.0,90),
('black beans','F001615',114,7.6,7.5,13.6,0.5,1.0,172),
('edamame','F002810',121,11.9,5.2,3.6,5.2,1.0,155),
('tempeh','F009205',193,19.0,5.0,7.6,10.8,1.0,166),
('peanut butter','F006870',622,24.7,8.1,12.4,51.4,1.0,258),
('pumpkin seeds','F004120',574,29.8,6.0,10.7,49.1,1.0,129),
('greek-style soy yoghurt','F003450',76,6.0,1.5,4.0,3.5,1.0,245),
('white rice','F007580',353,6.8,1.0,79.0,0.6,3.0,185);