/**
 * Helpers para extraer y filtrar datos de cards de coches (modelo, precio).
 * Lógica pura sin dependencia de Playwright; reutilizable desde CarsPage u otros.
 */

/** Patrón para extraer precio: "299 €/mes", "299€", "299 €", etc. */
export const PRICE_PATTERN = /(\d[\d.,]*)\s*€(\s*\/\s*mes)?/;

/** Etiquetas que no son modelo: no usar como nombre ni mostrar en el listado. */
export const LABEL_EXCLUDE = /^(Rebajas?|Nuevo\s*a\s*estrenar|Nuevo)$/i;

/** Quitar del texto mostrado: solo Opel + modelo (Frontera, Mokka, ...). */
export const STRIP_FROM_MODEL = /\s*(Rebajas?|Nuevo\s*a\s*estrenar|Nuevo)\s*/gi;

/** Dejar solo letras, números y espacios en el modelo (quitar 🚨, €, etc.). */
export const MODEL_CLEAN = /[^\p{L}\p{N}\s]/gu;

/** Patrón para "Opel" + nombre de modelo (Corsa, Frontera, MOKA, …) en el texto de la card. */
export function getBrandPlusModel(brand: string): RegExp {
  const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc}\\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\\s]+?)(?=\\s*\\d|\\s*€|\\n|$)`, 'i');
}

export interface CarModelPrice {
  model: string;
  price: string;
}

/**
 * Devuelve solo entradas que son coches (marca + precio).
 * Con marca: máx. 4 por defecto; si maxItems se pasa, usa ese límite (para listar todos).
 */
export function limitToCarsOnly(
  items: CarModelPrice[],
  brandName: string,
  maxItems?: number
): CarModelPrice[] {
  const filtered = items.filter((x) => x.model && x.price && !LABEL_EXCLUDE.test(x.model));
  if (brandName.trim()) return filtered.slice(0, (maxItems != null && maxItems > 0) ? maxItems : 4);
  if (maxItems != null && maxItems > 0) return filtered.slice(0, maxItems);
  return filtered;
}
