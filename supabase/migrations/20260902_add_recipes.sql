-- Custom recipe creator: recipes table
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  servings int NOT NULL DEFAULT 1 CHECK (servings >= 1 AND servings <= 50),
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  calories_per_serving numeric(10,1) NOT NULL DEFAULT 0,
  protein_per_serving numeric(10,1) NOT NULL DEFAULT 0,
  carbs_per_serving numeric(10,1) NOT NULL DEFAULT 0,
  fat_per_serving numeric(10,1) NOT NULL DEFAULT 0,
  fibre_per_serving numeric(10,1) NOT NULL DEFAULT 0,
  micro_vitamin_a numeric(10,3) DEFAULT 0,
  micro_vitamin_c numeric(10,3) DEFAULT 0,
  micro_vitamin_d numeric(10,3) DEFAULT 0,
  micro_vitamin_e numeric(10,3) DEFAULT 0,
  micro_vitamin_k numeric(10,3) DEFAULT 0,
  micro_thiamin numeric(10,3) DEFAULT 0,
  micro_riboflavin numeric(10,3) DEFAULT 0,
  micro_niacin numeric(10,3) DEFAULT 0,
  micro_vitamin_b6 numeric(10,3) DEFAULT 0,
  micro_folate numeric(10,3) DEFAULT 0,
  micro_vitamin_b12 numeric(10,3) DEFAULT 0,
  micro_calcium numeric(10,3) DEFAULT 0,
  micro_iron numeric(10,3) DEFAULT 0,
  micro_magnesium numeric(10,3) DEFAULT 0,
  micro_potassium numeric(10,3) DEFAULT 0,
  micro_zinc numeric(10,3) DEFAULT 0,
  micro_sodium numeric(10,3) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipes_owner_select ON public.recipes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY recipes_owner_insert ON public.recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY recipes_owner_update ON public.recipes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY recipes_owner_delete ON public.recipes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX recipes_user_id_idx ON public.recipes(user_id);

COMMENT ON TABLE public.recipes IS
  'Custom recipes created by users with calculated nutrition per serving.';
