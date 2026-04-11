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
            'Pantalón De Jeans Oxford Frika Ropa Linda',
        ],
        colors: ['Azul'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
    }
];

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Build a fast lookup map: alias → canonical name
const _aliasMap = new Map();
PRODUCT_CATALOG.forEach(product => {
    // The canonical name maps to itself
    _aliasMap.set(normalizeText(product.canonical), product.canonical);
    // Each alias maps to canonical
    product.aliases.forEach(alias => {
        _aliasMap.set(normalizeText(alias), product.canonical);
    });
});

function buildCandidateList(rawName, allowedProducts = []) {
    const key = normalizeText(rawName);
    const candidates = [];
    const seen = new Set();
    const addCandidate = (name, score, source) => {
        const normalizedName = normalizeText(name);
        if (!name || seen.has(normalizedName)) return;
        seen.add(normalizedName);
        candidates.push({ name, score, source });
    };

    const allowedSet = [...new Set(allowedProducts.filter(Boolean))];
    allowedSet.forEach(name => {
        const normalizedName = normalizeText(name);
        if (normalizedName && (key === normalizedName || key.startsWith(normalizedName))) {
            addCandidate(name, key === normalizedName ? 100 : 80 + Math.min(normalizedName.length, 20), 'allowed');
        }
    });

    for (const [alias, canonical] of _aliasMap) {
        if (key === alias) {
            addCandidate(canonical, 100, 'catalog-exact');
        } else if (key.startsWith(alias)) {
            addCandidate(canonical, 90 + Math.min(alias.length / 10, 9), 'catalog-prefix');
        }
    }

    return candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/**
 * Normalizes a product name to its canonical form.
 * Uses exact match first, then falls back to prefix matching
 * because ML appends variant info (size/color) to product titles
 * for variant-specific listings (e.g., "Negro Xxl" at the end).
 */
export function normalizeProductName(rawName) {
    if (!rawName) return rawName;
    const key = normalizeText(rawName);

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
 * Tries to resolve a raw product name against the known catalog plus the
 * products currently enabled in the app. Returns a structured match so the UI
 * can ask the user when the match is ambiguous or missing.
 */
export function resolveProductMatch(rawName, allowedProducts = []) {
    const raw = String(rawName || '').trim();
    if (!raw) {
        return {
            product: null,
            needsReview: true,
            candidates: [],
            rawName: ''
        };
    }

    const candidates = buildCandidateList(raw, allowedProducts);
    const topCandidate = candidates[0] || null;
    const secondCandidate = candidates[1] || null;
    const needsReview = !topCandidate || Boolean(secondCandidate && secondCandidate.score === topCandidate.score);

    return {
        product: needsReview ? null : topCandidate.name,
        needsReview,
        candidates: candidates.map(c => c.name),
        rawName: raw
    };
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
