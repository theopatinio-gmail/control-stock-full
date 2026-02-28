/**
 * Core logic for the Stock Management App.
 */
import { normalizeProductName } from './productMapping';

/**
 * Calculates current stock levels based on entries and sales.
 * Uses product name normalization to unify ML variant names.
 * @param {Array} stockEntries - List of entries to stock.
 * @param {Array} sales - List of recorded sales.
 * @returns {Array} - Array of objects containing product, color, size, and remaining quantity.
 */
export const calculateStock = (stockEntries, sales) => {
  const stockMap = {};

  // Process entries
  stockEntries.forEach(entry => {
    const product = normalizeProductName(entry.product);
    const { variants } = entry;
    variants.forEach(variant => {
      const { talle, color, cantidad } = variant;
      const normalizedTalle = talle.toUpperCase().trim();
      const normalizedColor = color.trim();
      const key = `${product}|${normalizedColor}|${normalizedTalle}`;
      if (!stockMap[key]) {
        stockMap[key] = { product, color: normalizedColor, talle: normalizedTalle, quantity: 0 };
      }
      stockMap[key].quantity += Number(cantidad);
    });
  });

  // Process sales
  sales.forEach(sale => {
    const product = normalizeProductName(sale.product);
    const { talle, color, cantidad = 1 } = sale;
    const normalizedTalle = talle.toUpperCase().trim();
    const normalizedColor = color.trim();
    const key = `${product}|${normalizedColor}|${normalizedTalle}`;
    if (stockMap[key]) {
      stockMap[key].quantity -= Number(cantidad);
    } else {
      // Sale without a matching entry (e.g. old product no longer stocked)
      stockMap[key] = { product, color: normalizedColor, talle: normalizedTalle, quantity: -Number(cantidad) };
    }
  });

  return Object.values(stockMap);
};

/**
 * Checks if an operation number already exists in the sales records.
 * @param {Array} sales - List of recorded sales.
 * @param {string} opNumber - Operation number to check.
 * @returns {boolean} - True if it exists, false otherwise.
 */
export const isDuplicateOp = (sales, opNumber) => {
  return sales.some(sale => sale.opNumber === opNumber);
};

/**
 * Gets a unique list of products from existing stock entries.
 */
export const getProductList = (stockEntries) => {
  const products = stockEntries.map(e => e.product);
  return [...new Set(products)];
};

/**
 * Convierte el array de stock (de calculateStock) a un mapa clave -> cantidad
 * para uso en Dashboard. Clave: "producto|talle|color"
 */
export const stockToMap = (stockArray) => {
  const map = {};
  (stockArray || []).forEach(item => {
    const key = `${item.product}|${(item.talle || '').toUpperCase()}|${item.color || ''}`;
    map[key] = item.quantity;
  });
  return map;
};
