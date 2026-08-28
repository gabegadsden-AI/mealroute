export type Micronutrients = {
  vitaminA: number;
  vitaminC: number;
  vitaminD: number;
  vitaminE: number;
  vitaminK: number;
  thiamin: number;
  riboflavin: number;
  niacin: number;
  vitaminB6: number;
  folate: number;
  vitaminB12: number;
  calcium: number;
  iron: number;
  magnesium: number;
  potassium: number;
  zinc: number;
  sodium: number;
};

export const MICRONUTRIENT_KEYS: (keyof Micronutrients)[] = [
  "vitaminA", "vitaminC", "vitaminD", "vitaminE", "vitaminK",
  "thiamin", "riboflavin", "niacin", "vitaminB6", "folate", "vitaminB12",
  "calcium", "iron", "magnesium", "potassium", "zinc", "sodium",
];

export const MICRONUTRIENT_LABELS: Record<keyof Micronutrients, string> = {
  vitaminA: "Vitamin A", vitaminC: "Vitamin C", vitaminD: "Vitamin D",
  vitaminE: "Vitamin E", vitaminK: "Vitamin K", thiamin: "Thiamin (B1)",
  riboflavin: "Riboflavin (B2)", niacin: "Niacin (B3)", vitaminB6: "Vitamin B6",
  folate: "Folate (B9)", vitaminB12: "Vitamin B12", calcium: "Calcium",
  iron: "Iron", magnesium: "Magnesium", potassium: "Potassium",
  zinc: "Zinc", sodium: "Sodium",
};

export const MICRONUTRIENT_UNITS: Record<keyof Micronutrients, string> = {
  vitaminA: "mcg", vitaminC: "mg", vitaminD: "mcg", vitaminE: "mg", vitaminK: "mcg",
  thiamin: "mg", riboflavin: "mg", niacin: "mg", vitaminB6: "mg", folate: "mcg",
  vitaminB12: "mcg", calcium: "mg", iron: "mg", magnesium: "mg",
  potassium: "mg", zinc: "mg", sodium: "mg",
};

export const MICRONUTRIENT_DV: Record<keyof Micronutrients, number> = {
  vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 15, vitaminK: 120,
  thiamin: 1.2, riboflavin: 1.3, niacin: 16, vitaminB6: 1.7, folate: 400,
  vitaminB12: 2.4, calcium: 1300, iron: 18, magnesium: 420,
  potassium: 4700, zinc: 11, sodium: 2300,
};

export const EMPTY_MICRONUTRIENTS: Micronutrients = {
  vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0, vitaminK: 0,
  thiamin: 0, riboflavin: 0, niacin: 0, vitaminB6: 0, folate: 0,
  vitaminB12: 0, calcium: 0, iron: 0, magnesium: 0, potassium: 0,
  zinc: 0, sodium: 0,
};

const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function hasMicronutrientData(micros?: Micronutrients): boolean {
  if (!micros) return false;
  return Object.values(micros).some((v) => typeof v === "number" && v > 0);
}

export function addMicronutrients(a: Micronutrients, b: Micronutrients): Micronutrients {
  const result = { ...EMPTY_MICRONUTRIENTS };
  for (const key of MICRONUTRIENT_KEYS) {
    result[key] = (a?.[key] || 0) + (b?.[key] || 0);
  }
  return result;
}

export function extractOFFMicronutrients(nutriments: Record<string, any>): Micronutrients {
  if (!nutriments || typeof nutriments !== "object") return { ...EMPTY_MICRONUTRIENTS };
  return {
    vitaminA: round3(num(nutriments["vitamin-a_100g"] ?? nutriments["vitamin_a_100g"] ?? 0)),
    vitaminC: round3(num(nutriments["vitamin-c_100g"] ?? nutriments["vitamin_c_100g"] ?? 0)),
    vitaminD: round3(num(nutriments["vitamin-d_100g"] ?? nutriments["vitamin_d_100g"] ?? 0)),
    vitaminE: round3(num(nutriments["vitamin-e_100g"] ?? nutriments["vitamin_e_100g"] ?? 0)),
    vitaminK: round3(num(nutriments["vitamin-k_100g"] ?? nutriments["vitamin_k_100g"] ?? 0)),
    thiamin: round3(num(nutriments["thiamin_100g"] ?? 0)),
    riboflavin: round3(num(nutriments["riboflavin_100g"] ?? 0)),
    niacin: round3(num(nutriments["niacin_100g"] ?? 0)),
    vitaminB6: round3(num(nutriments["vitamin-b6_100g"] ?? nutriments["vitamin_b6_100g"] ?? 0)),
    folate: round3(num(nutriments["folate_100g"] ?? 0)),
    vitaminB12: round3(num(nutriments["vitamin-b12_100g"] ?? nutriments["vitamin_b12_100g"] ?? 0)),
    calcium: round3(num(nutriments["calcium_100g"] ?? 0)),
    iron: round3(num(nutriments["iron_100g"] ?? 0)),
    magnesium: round3(num(nutriments["magnesium_100g"] ?? 0)),
    potassium: round3(num(nutriments["potassium_100g"] ?? 0)),
    zinc: round3(num(nutriments["zinc_100g"] ?? 0)),
    sodium: round3(num(nutriments["sodium_100g"] ?? 0)),
  };
}

const USDA_NUTRIENT_MAP: Record<number, keyof Micronutrients> = {
  1106: "vitaminA", 1162: "vitaminC", 1114: "vitaminB12", 1166: "vitaminD",
  1167: "vitaminE", 1168: "vitaminK", 1170: "folate", 1175: "vitaminB6",
  1184: "thiamin", 1185: "riboflavin", 1186: "niacin",
  1087: "calcium", 1089: "iron", 1090: "magnesium",
  1092: "potassium", 1095: "zinc", 1093: "sodium",
};

export function extractUSDAMicronutrients(foodNutrients: any[]): Micronutrients {
  const result = { ...EMPTY_MICRONUTRIENTS };
  if (!Array.isArray(foodNutrients)) return result;
  for (const item of foodNutrients) {
    const id = Number(item?.nutrientId ?? item?.nutrient?.id ?? 0);
    const value = Number(item?.value ?? item?.amount ?? 0);
    if (!id || !Number.isFinite(value) || value <= 0) continue;
    const key = USDA_NUTRIENT_MAP[id];
    if (key) result[key] = round3(value);
  }
  return result;
}

export function scaleMicronutrients(micros: Micronutrients, grams: number): Micronutrients {
  const ratio = Math.min(5000, Math.max(0, grams)) / 100;
  const result = { ...EMPTY_MICRONUTRIENTS };
  for (const key of MICRONUTRIENT_KEYS) {
    result[key] = round3((micros?.[key] || 0) * ratio);
  }
  return result;
}
