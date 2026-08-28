-- Add micronutrient columns to recent_foods table
ALTER TABLE public.recent_foods
  ADD COLUMN IF NOT EXISTS micro_vitamin_a numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_c numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_d numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_e numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_k numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_thiamin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_riboflavin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_niacin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_b6 numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_folate numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_b12 numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_calcium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_iron numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_magnesium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_potassium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_zinc numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_sodium numeric(10,3);

COMMENT ON TABLE public.recent_foods IS
  'Recently used foods for each authenticated user, including USDA, Open Food Facts, and custom entries with micronutrient tracking.';
