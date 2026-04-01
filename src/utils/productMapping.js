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
        canonical: 'Pantalón Palazzo De Jean Mujer Tiro Alto Ancho',
        aliases: [
            'Pantalon de jean palazzo',
            'Pantalón De Jean Palazzo',
            'Pantalón Palazzo Jeans Elastizado Negro Frika Mujer',
        ],
        colors: ['Azul', 'Negro'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
        canonical: 'Pantalón Palazzo Jean Mujer Cintura Elastizada Frika',
        aliases: [
            'Pantalon de jean palazzo elastizado',
        ],
        colors: ['Azul', 'Negro'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
        canonical: 'Bermuda Mujer Gabardina Cintura Elastizada Mod. Lirio Frika',
        aliases: [
            'Bermuda Lirio Gabardina',
            'Bermuda De Gabardina Mod. Lirio Frika Ropa Linda',
        ],
        colors: ['Tostado', 'Khaki'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
        canonical: 'Conjunto Morley Mujer Pantalon Recto Remera Oversize Frika',
        aliases: [
            'Conjunto de Morley',
            'Conjunto De Morley Mujer Pantalón Recto. Oversize',
        ],
        colors: ['Negro', 'Castaña'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
        canonical: 'Jean Oxford Mujer Tiro Alto Elastizado Pantalón Frika',
        aliases: [
            'Pantalon de jean oxford',
            'pantalon de jean oxford mujer elastizado',
        ],
        colors: ['Azul'],
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
 * Uses exact match first, then falls back to prefix matching
 * because ML appends variant info (size/color) to product titles
 * for variant-specific listings (e.g., "Negro Xxl" at the end).
 */
export function normalizeProductName(rawName) {
    if (!rawName) return rawName;
    const key = rawName.toLowerCase().trim();

    // 1. Exact match
    const exactMatch = _aliasMap.get(key);
    if (exactMatch) return exactMatch;

    // 2. Prefix match: check if the raw name starts with any known alias
    //    This handles ML's variant-specific titles like
    //    "Pantalón Palazzo De Jean Mujer Tiro Alto Ancho Negro Xxl"
    let bestMatch = null;
    let bestLength = 0;
    for (const [alias, canonical] of _aliasMap) {
        if (key.startsWith(alias) && alias.length > bestLength) {
            bestMatch = canonical;
            bestLength = alias.length;
        }
    }
    if (bestMatch) return bestMatch;

    return rawName.trim();
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
