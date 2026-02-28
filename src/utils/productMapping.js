/**
 * Product name normalization system.
 * Maps all ML variant names to canonical product names used in the app.
 * 
 * To add a new product: add a new entry to PRODUCT_CATALOG with:
 *   - canonical: the name you use for manual entries
 *   - aliases: all the names ML uses for the same product
 *   - colors: the available colors
 *   - sizes: the available sizes (in display order)
 */

export const PRODUCT_CATALOG = [
    {
        canonical: 'Pantalon de jean palazzo',
        aliases: [
            'Pantalón De Jean Palazzo',
            'Pantalón De Jean Palazzo ',
            'Pantalón Palazzo De Jean Mujer Tiro Alto Ancho',
            'Pantalón Palazzo Jeans Elastizado  Negro Frika Mujer',
        ],
        colors: ['Azul', 'Negro'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
        canonical: 'Bermuda Lirio Gabardina',
        aliases: [
            'Bermuda De Gabardina Mod. Lirio Frika Ropa Linda',
            'Bermuda Mujer Gabardina Cintura Elastizada Mod. Lirio Frika',
        ],
        colors: ['Tostado', 'Khaki'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    }
];

// Build a fast lookup map: alias → canonical name
const _aliasMap = new Map();
PRODUCT_CATALOG.forEach(product => {
    // The canonical name maps to itself
    _aliasMap.set(product.canonical.toLowerCase().trim(), product.canonical);
    // Each alias maps to canonical
    product.aliases.forEach(alias => {
        _aliasMap.set(alias.toLowerCase().trim(), product.canonical);
    });
});

/**
 * Normalizes a product name to its canonical form.
 * If no match is found, returns the original name trimmed.
 */
export function normalizeProductName(rawName) {
    if (!rawName) return rawName;
    const key = rawName.toLowerCase().trim();
    return _aliasMap.get(key) || rawName.trim();
}

/**
 * Gets the catalog entry for a product (by canonical or alias name).
 * Returns undefined if not in the catalog.
 */
export function getProductCatalogEntry(rawName) {
    const canonical = normalizeProductName(rawName);
    return PRODUCT_CATALOG.find(p => p.canonical === canonical);
}

/**
 * Gets only the canonical product names (for dropdowns, etc.)
 */
export function getCanonicalProductNames() {
    return PRODUCT_CATALOG.map(p => p.canonical);
}

/**
 * Standard size order for sorting
 */
export const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];

export function sortBySizeOrder(a, b) {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
}
