import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProductCatalogEntry, normalizeProductName, resolveProductMatch } from './src/utils/productMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_CONFIG_FILE = path.join(__dirname, 'ml_config.json');

app.use(cors());
app.use(express.json());

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ Data File Init Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

const INITIAL_DATA = { 
    manualMovements: [], 
    sales: [], 
    products: [
        'Pantal�n Palazzo De Jean Mujer Tiro Alto Ancho',
        'Pantal�n Palazzo Jean Mujer Cintura Elastizada Frika',
        'Bermuda Mujer Gabardina Cintura Elastizada Mod. Lirio Frika',
        'Jean Oxford Mujer Tiro Alto Elastizado Pantal�n Frika',
        'Conjunto Morley Mujer Pantalon Recto Remera Oversize Frika'
    ], 
    mlStock: [], 
    mlStockFetchedAt: null,
    productCosts: {}
};
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
}

const INITIAL_ML_CONFIG = {
    client_id: '',
    client_secret: '',
    access_token: '',
    refresh_token: '',
    user_id: '',
    last_sync: null,
    redirect_uri: 'https://127.0.0.1',
    // IDs de productos Full a sincronizar (agregar los que uses)
    full_item_ids: ['MLA864272312', 'MLA2686396878'],
    // Corte histÃƒÂ³rico para la sync Full
    snapshot_date: '2025-07-01'
};
if (!fs.existsSync(ML_CONFIG_FILE)) {
    fs.writeFileSync(ML_CONFIG_FILE, JSON.stringify(INITIAL_ML_CONFIG, null, 2));
}

function readMlConfig() {
    return JSON.parse(fs.readFileSync(ML_CONFIG_FILE, 'utf8'));
}
function saveMlConfig(cfg) {
    fs.writeFileSync(ML_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
// Safe atomic JSON write - prevents file truncation on OneDrive paths
// Writes to a .tmp file first, then replaces the original atomically
function safeWriteJSON(filePath, data) {
    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    const json = JSON.stringify(data, null, 2);
    try {
        fs.writeFileSync(tmpPath, json, 'utf8');
        if (fs.existsSync(filePath)) {
            try { fs.copyFileSync(filePath, bakPath); } catch (e) {}
        }
        try {
            fs.renameSync(tmpPath, filePath);
        } catch (e) {
            // Fallback: copy + delete temp (handles Windows file lock by OneDrive)
            fs.copyFileSync(tmpPath, filePath);
            try { fs.unlinkSync(tmpPath); } catch (e2) {}
        }
    } catch (err) {
        console.error('[safeWriteJSON] Error writing', filePath, ':', err.message);
        throw err;
    }
}



const FULL_MOVEMENTS_START_DATE = '2025-07-01';

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ Data endpoints Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

app.get('/api/data', (req, res) => {
    console.log('[GET] Reading data.json...');
    try {
        let raw;
        try {
            raw = fs.readFileSync(DATA_FILE, 'utf8');
            JSON.parse(raw); // validate
        } catch (e) {
            // data.json is corrupted - try to restore from backup
            const bakPath = DATA_FILE + '.bak';
            if (fs.existsSync(bakPath)) {
                console.warn('[GET] data.json corrupted, restoring from .bak');
                fs.copyFileSync(bakPath, DATA_FILE);
                raw = fs.readFileSync(DATA_FILE, 'utf8');
            } else {
                throw e;
            }
        }
        res.json(JSON.parse(raw));
    } catch (error) {
        console.error('[ERROR] Reading:', error);
        res.status(500).json({ error: 'Error reading data file' });
    }
});

app.post('/api/data', (req, res) => {
    console.log('[POST] Saving data... Manual movements:', req.body.manualMovements?.length || 0);
    try {
        safeWriteJSON(DATA_FILE, req.body);
        console.log('[SUCCESS] Data saved to disk.');
        res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] Writing:', error);
        res.status(500).json({ error: 'Error writing data file' });
    }
});

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ ML Config endpoints Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

// GET ml config (no devuelve secrets)
app.get('/api/ml/status', (req, res) => {
    try {
        const cfg = readMlConfig();
        res.json({
            hasClientId: !!cfg.client_id,
            client_id: cfg.client_id || '',
            hasToken: !!cfg.access_token,
            user_id: cfg.user_id || null,
            last_sync: cfg.last_sync,
            redirect_uri: cfg.redirect_uri || 'https://127.0.0.1',
            full_item_ids: cfg.full_item_ids || [],
            snapshot_date: FULL_MOVEMENTS_START_DATE,
            full_movements_start_date: FULL_MOVEMENTS_START_DATE
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST guardar credenciales y configuraciÃƒÂ³n de sync
app.post('/api/ml/config', (req, res) => {
    try {
        const { client_id, client_secret, redirect_uri, full_item_ids, snapshot_date } = req.body;
        const cfg = readMlConfig();

        if (client_id !== undefined) cfg.client_id = client_id;
        if (client_secret !== undefined) cfg.client_secret = client_secret;
        if (redirect_uri !== undefined) cfg.redirect_uri = redirect_uri;
        if (Array.isArray(full_item_ids)) cfg.full_item_ids = full_item_ids;
        if (snapshot_date) cfg.snapshot_date = snapshot_date;

        if (!cfg.client_id || !cfg.client_secret) {
            return res.status(400).json({ error: 'Se requiere al menos el Client ID y Secret una vez.' });
        }

        saveMlConfig(cfg);
        console.log('[ML] ConfiguraciÃƒÂ³n actualizada:', { client_id: cfg.client_id, redirect_uri: cfg.redirect_uri });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET url de autorizaciÃƒÂ³n
app.get('/api/ml/authorize-url', (req, res) => {
    try {
        const cfg = readMlConfig();
        if (!cfg.client_id) {
            return res.status(400).json({ error: 'No hay client_id configurado' });
        }
        const redirectUri = cfg.redirect_uri || 'https://127.0.0.1';
        // Agregamos scopes explÃƒÂ­citos para tener permisos de lectura, escritura y renovaciÃƒÂ³n de token
        const scopes = 'offline_access read write';
        const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${cfg.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
        res.json({ url: authUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST intercambiar code por token (flujo manual: el usuario pega el code)
app.post('/api/ml/exchange-token', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Falta el code' });

        const cfg = readMlConfig();
        if (!cfg.client_id || !cfg.client_secret) {
            return res.status(400).json({ error: 'ConfigurÃƒÂ¡ las credenciales primero' });
        }

        const params = {
            grant_type: 'authorization_code',
            client_id: cfg.client_id,
            client_secret: cfg.client_secret,
            code: code,
            redirect_uri: cfg.redirect_uri || 'https://127.0.0.1'
        };
        console.log('[ML Exchange] Enviando parÃƒÂ¡metros:', { ...params, client_secret: '***' });

        const body = new URLSearchParams(params);

        const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: body.toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            console.error('[ML] Token error:', tokenData);
            return res.status(400).json({ error: tokenData.message || 'Error al obtener token', detail: tokenData });
        }

        cfg.access_token = tokenData.access_token;
        cfg.refresh_token = tokenData.refresh_token;
        cfg.user_id = String(tokenData.user_id);
        saveMlConfig(cfg);
        console.log('[ML] Token guardado. User:', cfg.user_id);
        res.json({ success: true, user_id: cfg.user_id });
    } catch (e) {
        console.error('[ML] Exchange error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ ML Sync Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

async function mlGet(path, token) {
    const url = `https://api.mercadolibre.com${path}`;
    let r;
    try {
        r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
        const cause = e?.cause?.code ? ` (${e.cause.code})` : '';
        throw new Error(`Fetch failed for ${path}${cause}: ${e.message}`);
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`ML API error ${r.status} for ${path}: ${JSON.stringify(data)}`);
    return data;
}

async function getShipmentSellerCost(shipmentId, token, sellerId = null) {
    if (!shipmentId) return 0;

    try {
        const costs = await mlGet(`/shipments/${shipmentId}/costs`, token);
        const senders = Array.isArray(costs.senders) ? costs.senders : [];
        if (senders.length > 0) {
            if (sellerId !== null && sellerId !== undefined) {
                const match = senders.find(sender => String(sender.user_id) === String(sellerId));
                if (match) return parseFloat(match.cost || 0);
            }
            return parseFloat(senders[0].cost || 0);
        }
    } catch (e) {
        console.warn(`[ML Sync] No se pudo leer /costs para shipment ${shipmentId}: ${e.message}`);
    }

    try {
        const shipmentRes = await mlGet(`/shipments/${shipmentId}`, token);
        return parseFloat(shipmentRes.base_cost || shipmentRes.cost || 0);
    } catch (e) {
        console.warn(`[ML Sync] No se pudo leer shipment ${shipmentId}: ${e.message}`);
        return 0;
    }
}

// Refresca el token si venciÃƒÂ³
async function refreshTokenIfNeeded(cfg) {
    if (!cfg.refresh_token || !cfg.client_id || !cfg.client_secret) return cfg;
    try {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: cfg.client_id,
            client_secret: cfg.client_secret,
            refresh_token: cfg.refresh_token
        });
        const r = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        if (r.ok) {
            const d = await r.json();
            cfg.access_token = d.access_token;
            cfg.refresh_token = d.refresh_token;
            saveMlConfig(cfg);
            console.log('[ML] Token refrescado automÃƒÂ¡ticamente.');
        }
    } catch (e) {
        console.warn('[ML] No se pudo refrescar token:', e.message);
    }
    return cfg;
}

function addDaysToDateStr(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00.000-03:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function getDateWindows(startDate, endDate, maxWindowDays = 60) {
    const windows = [];
    let cursor = startDate;

    while (cursor <= endDate) {
        const windowEnd = addDaysToDateStr(cursor, maxWindowDays - 1);
        const boundedEnd = windowEnd < endDate ? windowEnd : endDate;
        windows.push({ from: cursor, to: boundedEnd });
        cursor = addDaysToDateStr(boundedEnd, 1);
    }

    return windows;
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function findBestTokenMatch(text, candidates = []) {
    const normalizedText = normalizeText(text);
    let bestMatch = null;
    let bestLength = 0;

    for (const candidate of candidates) {
        const normalizedCandidate = normalizeText(candidate);
        if (!normalizedCandidate) continue;
        if (normalizedText.includes(normalizedCandidate) && normalizedCandidate.length > bestLength) {
            bestMatch = candidate;
            bestLength = normalizedCandidate.length;
        }
    }

    return bestMatch;
}

function extractVariantAttributes(orderItem = {}, productEntry = null) {
    let talle = 'Unico';
    let color = 'Unico';

    const attributeSources = [
        orderItem.item?.variation_attributes,
        orderItem.item?.attribute_combinations,
        orderItem.item?.attributes,
        orderItem.variation?.attributes,
        orderItem.variation_attributes
    ].filter(Array.isArray);

    for (const attributes of attributeSources) {
        for (const attr of attributes) {
            const name = normalizeText(attr?.name);
            if (name.includes('talle') || name.includes('talla') || name.includes('size')) {
                talle = attr.value_name || talle;
            }
            if (name.includes('color')) {
                color = attr.value_name || color;
            }
        }
    }

    const titleText = [
        orderItem.item?.title,
        orderItem.item?.variation_name,
        orderItem.variation?.name
    ].filter(Boolean).join(' ');

    if (talle === 'Unico' && productEntry?.sizes?.length) {
        const matchedSize = findBestTokenMatch(titleText, productEntry.sizes);
        if (matchedSize) talle = matchedSize;
    }

    if (color === 'Unico' && productEntry?.colors?.length) {
        const matchedColor = findBestTokenMatch(titleText, productEntry.colors);
        if (matchedColor) color = matchedColor;
    }

    return { talle, color };
}

app.post('/api/ml/sync', async (req, res) => {
    try {
        let cfg = readMlConfig();
        if (!cfg.access_token) {
            return res.status(400).json({ error: 'No hay token. AutorizÃƒÂ¡ la app primero.' });
        }

        // Intentar refrescar token
        cfg = await refreshTokenIfNeeded(cfg);
        const token = cfg.access_token;

        // 0. Validar token y obtener info del seller
        console.log('[ML Sync] Validando token con /users/me...');
        const me = await mlGet('/users/me', token);
        const sellerId = me.id;
        console.log('[ML Sync] Token vÃƒÂ¡lido. User:', me.nickname, 'ID:', sellerId);

        const SNAPSHOT_DATE = FULL_MOVEMENTS_START_DATE;
        const OPERATIONS_DATE_FROM = FULL_MOVEMENTS_START_DATE;
        const TODAY_DATE = new Date().toISOString().split('T')[0];

        // 1. Obtener todas las ÃƒÂ³rdenes pagadas desde el snapshot
        console.log(`[ML Sync] Buscando ÃƒÂ³rdenes pagadas desde ${SNAPSHOT_DATE}...`);
        const dateFrom = `${SNAPSHOT_DATE}T00:00:00.000-03:00`;

        let allOrders = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            const ordersRes = await mlGet(
                `/orders/search?seller=${sellerId}&order.status=paid&sort=date_desc&limit=${limit}&offset=${offset}&order.date_created.from=${encodeURIComponent(dateFrom)}`,
                token
            );
            const orders = ordersRes.results || [];
            allOrders = allOrders.concat(orders);
            const total = ordersRes.paging?.total || 0;
            offset += limit;
            hasMore = offset < total && orders.length > 0;
            if (offset > 10000) break; // Increased from 500 to 10000
        }

        console.log(`[ML Sync] Ãƒâ€œrdenes pagadas encontradas: ${allOrders.length}`);

        // Leer datos actuales para desduplicar
        const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const existingOpNumbers = new Set(currentData.sales.map(s => String(s.opNumber).trim()));
        const allowedProducts = Array.isArray(currentData.products) ? currentData.products : [];

        // Cache de logistic_type por item ID (persiste en ml_config.json)
        // Evita consultar /items/{id} repetidamente para el mismo item
        const fulfillmentCache = cfg.fulfillment_cache || {};
        let cacheUpdated = false;
        const itemCache = {};

        async function getItem(itemId) {
            if (!itemId) return null;
            if (itemCache[itemId]) return itemCache[itemId];
            const item = await mlGet(`/items/${itemId}`, token);
            itemCache[itemId] = item;
            return item;
        }

        // FunciÃƒÂ³n para verificar si un item es Full (fulfillment)
        async function isFullItem(itemId) {
            if (!itemId) return false;
            if (fulfillmentCache[itemId] !== undefined) {
                return fulfillmentCache[itemId];
            }
            try {
                const item = await getItem(itemId);
                const logisticType = item.shipping?.logistic_type || '';
                const isFull = logisticType === 'fulfillment';
                fulfillmentCache[itemId] = isFull;
                cacheUpdated = true;
                console.log(`[ML Sync]   Ã°Å¸â€œÂ¦ Item ${itemId}: logistic_type="${logisticType}" Ã¢â€ â€™ ${isFull ? 'FULL Ã¢Å“â€¦' : 'NO Full Ã¢Â�?Å’'}`);
                return isFull;
            } catch (e) {
                console.warn(`[ML Sync]   Ã¢Å¡Â Ã¯Â¸Â�? No se pudo verificar item ${itemId}: ${e.message}`);
                return false;
            }
        }

        let allNewSales = [];
        let skippedNonFull = 0;
        for (const order of allOrders) {
            const orderId = String(order.id);
            if (existingOpNumbers.has(orderId)) continue;

            const orderDate = order.date_closed
                ? order.date_closed.split('T')[0]
                : order.date_created?.split('T')[0];

            if (orderDate < SNAPSHOT_DATE) continue;

            const orderItems = (order.order_items || []).filter(oi => oi.item?.id);
            const totalOrderQty = orderItems.reduce((sum, oi) => sum + (parseInt(oi.quantity || 1, 10)), 0);
            let shippingCost = parseFloat(order.shipping_cost || order.shipping?.shipping_cost || 0);
            if (order.shipping?.id) {
                const shipmentSellerCost = await getShipmentSellerCost(order.shipping.id, token, sellerId);
                if (shipmentSellerCost > 0) shippingCost = shipmentSellerCost;
            }
            const shippingCostPerUnit = totalOrderQty > 0 ? shippingCost / totalOrderQty : 0;
            
            for (const orderItem of (order.order_items || [])) {
                const itemId = orderItem.item?.id;
                const isFull = await isFullItem(itemId);
                if (!isFull) {
                    skippedNonFull++;
                    continue;
                }

                const rawProductName = orderItem.item?.title || '';
                const productMatch = resolveProductMatch(rawProductName, allowedProducts);
                const productName = productMatch.product || normalizeProductName(rawProductName) || rawProductName.trim() || 'Producto sin nombre';
                const productEntry = getProductCatalogEntry(productName) || getProductCatalogEntry(rawProductName);
                const { talle, color } = extractVariantAttributes(orderItem, productEntry);
                const quantity = parseInt(orderItem.quantity || 1, 10);
                const unitPrice = parseFloat(orderItem.unit_price || 0);
                const saleFee = parseFloat(orderItem.sale_fee || 0);
                const totalVenta = unitPrice * quantity;
                const totalComision = saleFee * quantity;
                const totalEnvio = shippingCostPerUnit * quantity;
                
                const saleId = `ml-${orderId}-${orderItem.item?.variation_id || 'nv'}`;
                const existingSale = currentData.sales.find(s => s.id === saleId);
                if (existingSale) {
                    existingSale.product = productName;
                    existingSale.productRawName = rawProductName;
                    existingSale.productNeedsReview = productMatch.needsReview;
                    existingSale.productCandidates = productMatch.candidates;
                    existingSale.productResolved = !productMatch.needsReview;
                    existingSale.talle = talle;
                    existingSale.color = color;
                    existingSale.unitPrice = unitPrice;
                    existingSale.totalVenta = totalVenta;
                    existingSale.comisionML = totalComision;
                    existingSale.costoEnvio = totalEnvio;
                    existingSale.orderTotalAmount = parseFloat(order.total_amount || 0);
                    existingSale.cantidad = quantity;
                } else {
                    const sale = {
                        id: saleId,
                        product: productName,
                        productRawName: rawProductName,
                        productNeedsReview: productMatch.needsReview,
                        productCandidates: productMatch.candidates,
                        productResolved: !productMatch.needsReview,
                        talle,
                        color,
                        opNumber: orderId,
                        fechaVenta: orderDate,
                        cantidad: quantity,
                        source: 'mercadolibre',
                        mlItemId: itemId || null,
                        shippingId: order.shipping?.id ? String(order.shipping.id) : null,
                        unitPrice: unitPrice,
                        totalVenta: totalVenta,
                        comisionML: totalComision,
                        costoEnvio: totalEnvio,
                        orderTotalAmount: parseFloat(order.total_amount || 0)
                    };
                    allNewSales.push(sale);
                    console.log(`[ML Sync]   Nueva venta Full: ${productName} (${talle}/${color}) - Orden ${orderId}`);
                }
            }
            existingOpNumbers.add(orderId);
        }

        let updatedSales = 0;
        for (const order of allOrders) {
            const orderId = String(order.id);
            const orderItems = (order.order_items || []).filter(oi => oi.item?.id);
            const totalOrderQty = orderItems.reduce((sum, oi) => sum + (parseInt(oi.quantity || 1, 10)), 0);
            let shippingCost = parseFloat(order.shipping_cost || order.shipping?.shipping_cost || 0);
            if (order.shipping?.id) {
                const shipmentSellerCost = await getShipmentSellerCost(order.shipping.id, token, sellerId);
                if (shipmentSellerCost > 0) shippingCost = shipmentSellerCost;
            }
            const shippingCostPerUnit = totalOrderQty > 0 ? shippingCost / totalOrderQty : 0;
            
            for (const orderItem of (order.order_items || [])) {
                const itemId = orderItem.item?.id;
                const isFull = await isFullItem(itemId);
                if (!isFull) continue;
                
                const saleId = `ml-${orderId}-${orderItem.item?.variation_id || 'nv'}`;
                const existingSale = currentData.sales.find(s => s.id === saleId);
                if (existingSale) {
                    const unitPrice = parseFloat(orderItem.unit_price || 0);
                    const saleFee = parseFloat(orderItem.sale_fee || 0);
                    const quantity = parseInt(orderItem.quantity || 1, 10);
                    const totalEnvio = shippingCostPerUnit * quantity;
                    existingSale.unitPrice = unitPrice;
                    existingSale.totalVenta = unitPrice * quantity;
                    existingSale.comisionML = saleFee * quantity;
                    existingSale.costoEnvio = totalEnvio;
                    existingSale.orderTotalAmount = parseFloat(order.total_amount || 0);
                    updatedSales++;
                }
            }
        }

        // 3. Guardar las ventas nuevas en data.json
        if (allNewSales.length > 0) {
            currentData.sales = [...allNewSales, ...currentData.sales];
        }
        safeWriteJSON(DATA_FILE, currentData);

        // 4. Detectar devoluciones automáticamente
        // Para cada venta con shippingId registrada en los últimos 90 días,
        // consultar el estado del envío en ML. Si es "returned" y no hay
        // una devolución registrada para esa venta → crear el movimiento automáticamente.
        const autoReturns = [];
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const allSales = currentData.sales || [];
        const allMovements = currentData.manualMovements || [];

        const salesWithShipping = allSales.filter(s =>
            s.shippingId &&
            s.source === 'mercadolibre' &&
            new Date(s.fechaVenta) >= ninetyDaysAgo
        );

        for (const sale of salesWithShipping) {
            // Chequear si ya existe una devolución para esta venta
            const alreadyReturned = allMovements.some(m =>
                m.type === 'devolucion' && m.originSaleId === sale.id
            );
            if (alreadyReturned) continue;

            try {
                const shipment = await mlGet(`/shipments/${sale.shippingId}`, token);
                if (shipment.status === 'returned') {
                    const returnDate = shipment.last_updated
                        ? shipment.last_updated.split('T')[0]
                        : new Date().toISOString().split('T')[0];

                    const devolucion = {
                        id: `ml-return-auto-${sale.id}`,
                        opNumber: sale.opNumber || '',
                        product: sale.product,
                        talle: sale.talle,
                        color: sale.color,
                        type: 'devolucion',
                        quantity: Number(sale.cantidad || 1),
                        date: returnDate,
                        source: 'mercadolibre',
                        origin: 'ml-return-auto',
                        originSaleId: sale.id,
                        originSaleOpNumber: sale.opNumber || null
                    };
                    autoReturns.push(devolucion);
                    console.log(`[ML Sync] Devolucion detectada automaticamente: ${sale.product} (${sale.talle}/${sale.color}) - Orden ${sale.id}`);
                }
            } catch (e) {
                // Si no se puede consultar el envío, se ignora y sigue
                console.warn(`[ML Sync] No se pudo consultar envio ${sale.shippingId}: ${e.message}`);
            }
        }

        if (autoReturns.length > 0) {
            currentData.manualMovements = [...autoReturns, ...(currentData.manualMovements || [])];
            safeWriteJSON(DATA_FILE, currentData);
            console.log(`[ML Sync] ${autoReturns.length} devoluciones auto-detectadas y registradas.`);
        }

        // 5. Actualizar config: last_sync + cache de fulfillment
        cfg.last_sync = new Date().toISOString();
        cfg.fulfillment_cache = fulfillmentCache;
        saveMlConfig(cfg);

        console.log(`[ML Sync] Sync completo. Ventas Full nuevas: ${allNewSales.length}, actualizadas: ${updatedSales}, omitidas (no Full): ${skippedNonFull}, devoluciones auto: ${autoReturns.length}`);
        res.json({
            success: true,
            newSales: allNewSales.length,
            updatedSales,
            skippedNonFull,
            autoReturns: autoReturns.length,
            sales: allNewSales,
            unresolvedSales: allNewSales.filter(s => s.productNeedsReview),
            entries: [],
            message: `Sync completado. ${allNewSales.length} nueva(s), ${updatedSales} actualizadas con precios.${autoReturns.length > 0 ? ` ${autoReturns.length} devolución(es) detectada(s) automáticamente.` : ''}${skippedNonFull > 0 ? ` (${skippedNonFull} no-Full omitidas)` : ''}`
        });

    } catch (e) {
        console.error('[ML Sync] Error:', e);
        res.status(500).json({ error: e.message });
    }
});


// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ ML Debug Orders Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

app.get('/api/ml/debug-orders', async (req, res) => {
    try {
        let cfg = readMlConfig();
        if (!cfg.access_token) {
            return res.status(400).json({ error: 'No hay token.' });
        }
        cfg = await refreshTokenIfNeeded(cfg);
        const token = cfg.access_token;
        const me = await mlGet('/users/me', token);
        const sellerId = me.id;

        const FULL_ITEM_IDS = new Set(cfg.full_item_ids || []);
        const SNAPSHOT_DATE = FULL_MOVEMENTS_START_DATE;
        const dateFrom = `${SNAPSHOT_DATE}T00:00:00.000-03:00`;

        // Leer duplicados existentes
        const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const existingOpNumbers = new Set(currentData.sales.map(s => String(s.opNumber).trim()));

        // Buscar con TODOS los estados (no solo paid)
        const allOrdersRes = await mlGet(
            `/orders/search?seller=${sellerId}&sort=date_desc&limit=50&order.date_created.from=${encodeURIComponent(dateFrom)}`,
            token
        );
        const allOrders = allOrdersRes.results || [];

        // Buscar solo paid
        const paidOrdersRes = await mlGet(
            `/orders/search?seller=${sellerId}&order.status=paid&sort=date_desc&limit=50&order.date_created.from=${encodeURIComponent(dateFrom)}`,
            token
        );
        const paidOrders = paidOrdersRes.results || [];

        const debugInfo = allOrders.map(order => {
            const orderId = String(order.id);
            const items = (order.order_items || []).map(oi => ({
                itemId: oi.item?.id,
                title: oi.item?.title?.substring(0, 60),
                quantity: oi.quantity,
                isInFullList: FULL_ITEM_IDS.has(oi.item?.id),
                variation_attributes: oi.item?.variation_attributes
            }));

            const orderDate = order.date_closed
                ? order.date_closed.split('T')[0]
                : order.date_created?.split('T')[0];

            return {
                orderId,
                status: order.status,
                tags: order.tags,
                shipping: order.shipping,
                date_created: order.date_created,
                date_closed: order.date_closed,
                orderDate,
                isAlreadyImported: existingOpNumbers.has(orderId),
                isBeforeSnapshot: orderDate < SNAPSHOT_DATE,
                items
            };
        });

        res.json({
            sellerId,
            snapshotDate: SNAPSHOT_DATE,
            fullItemIds: [...FULL_ITEM_IDS],
            totalAllOrders: allOrders.length,
            totalPaidOrders: paidOrders.length,
            existingSalesCount: currentData.sales.length,
            orders: debugInfo
        });

    } catch (e) {
        console.error('[ML Debug] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ ML Stock (Live from API) Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬

app.get('/api/ml/stock', async (req, res) => {
    try {
        let cfg = readMlConfig();
        if (!cfg.access_token) {
            return res.status(400).json({ error: 'No hay token. AutorizÃƒÂ¡ la app primero.' });
        }

        // Refresh token if needed
        cfg = await refreshTokenIfNeeded(cfg);
        const token = cfg.access_token;
        const sellerId = cfg.user_id;

        if (!sellerId) {
            return res.status(400).json({ error: 'No hay user_id configurado.' });
        }

        console.log('[ML Stock] Obteniendo stock en vivo...');

        // Strategy: Extract unique item IDs from orders, then fetch each item directly.
        // The /orders endpoint works (we use it in sync), but /users/{id}/items/search is blocked.

        // 1. Get all active items to discover item IDs
        let allItemIds = new Set();
        // Fetch BOTH active and paused items: when ML stock hits 0 it auto-pauses the listing,
        // so paused items are the most important ones for Riesgo Full tracking.
        for (const status of ['active', 'paused']) {
            let itemOffset = 0;
            const itemLimit = 50;
            let fetchingItems = true;
            while (fetchingItems) {
                const searchRes = await mlGet(
                    `/users/${sellerId}/items/search?status=${status}&offset=${itemOffset}&limit=${itemLimit}`,
                    token
                );
                const results = searchRes.results || [];
                results.forEach(id => allItemIds.add(id));
                const total = searchRes.paging?.total || 0;
                itemOffset += itemLimit;
                fetchingItems = itemOffset < total && results.length > 0;
                if (itemOffset > 1000) break;
            }
            console.log(`[ML Stock] Items ${status}: ${[...allItemIds].length} acumulados`);
        }

        console.log(`[ML Stock] Items encontrados: ${allItemIds.size}`);

        if (allItemIds.size === 0) {
            return res.json({ items: [], message: 'No se encontraron items en las ÃƒÂ³rdenes.' });
        }

        // 2. Fetch details for each item individually
        const itemIdArray = [...allItemIds];
        const items = [];
        for (const id of itemIdArray) {
            try {
                const item = await mlGet(`/items/${id}`, token);
                const isFull = item.shipping?.logistic_type === 'fulfillment';
                if (isFull) {
                    items.push(item);
                    console.log(`[ML Stock]   Ã¢Å“â€œ ${id}: Full Ã¢Å“â€¦`);
                } else {
                    console.log(`[ML Stock]   Ã¢Â�?Â­Ã¯Â¸Â�? ${id}: No-Full Ã¢Â�?Å’`);
                }
            } catch (e) {
                console.warn(`[ML Stock]   Ã¢Å“â€�? ${id}: ${e.message}`);
            }
        }

        console.log(`[ML Stock] Detalles obtenidos: ${items.length} items`);

        // 3. Build stock data from items and their variations (only active items)
        const stockItems = [];

        for (const item of items) {
            const title = normalizeProductName(item.title) || 'Producto desconocido';
            const variations = item.variations || [];
            const isActive = item.status === 'active' || item.status === 'paused'; // paused = stock 0, must track

            if (variations.length === 0) {
                // Sin variaciones: leer talle/color desde item.attributes
                let talle = 'Unico';
                let color = 'Unico';
                for (const attr of (item.attributes || [])) {
                    const name = (attr.name || '').toLowerCase();
                    if (name.includes('talle') || name.includes('talla') || name.includes('size')) {
                        talle = attr.value_name || talle;
                    }
                    if (name.includes('color')) {
                        color = attr.value_name || color;
                    }
                }
                stockItems.push({
                    itemId: item.id,
                    title,
                    talle,
                    color,
                    available_quantity: item.available_quantity || 0,
                    active: isActive
                });
            } else {
                for (const variation of variations) {
                    let talle = 'Unico';
                    let color = 'Unico';

                    for (const attr of (variation.attribute_combinations || [])) {
                        const name = (attr.name || '').toLowerCase();
                        if (name.includes('talle') || name.includes('talla') || name.includes('size')) {
                            talle = attr.value_name || talle;
                        }
                        if (name.includes('color')) {
                            color = attr.value_name || color;
                        }
                    }

                    stockItems.push({
                        itemId: item.id,
                        variationId: variation.id,
                        title,
                        talle,
                        color,
                        available_quantity: variation.available_quantity || 0,
                        active: isActive
                    });
                }
            }
        }

        console.log(`[ML Stock] Ã¢Å“â€¦ Stock obtenido. ${stockItems.length} variantes totales, ${stockItems.filter(i => i.active).length} activas.`);

        // Persistir stock de ML en data.json
        const fetchedAt = new Date().toISOString();
        try {
            const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            currentData.mlStock = stockItems;
            currentData.mlStockFetchedAt = fetchedAt;
            safeWriteJSON(DATA_FILE, currentData);
            console.log('[ML Stock] Stock guardado en data.json.');
        } catch (saveErr) {
            console.warn('[ML Stock] No se pudo guardar stock en data.json:', saveErr.message);
        }

        res.json({
            success: true,
            items: stockItems,
            fetchedAt
        });

    } catch (e) {
        console.error('[ML Stock] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬ Server Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬Ã¢â€�?â‚¬


app.get('/api/product-costs', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json({ productCosts: data.productCosts || {} });
    } catch (error) {
        res.status(500).json({ error: 'Error reading product costs' });
    }
});

app.post('/api/product-costs', (req, res) => {
    try {
        const { productCosts } = req.body;
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        data.productCosts = productCosts || {};
        safeWriteJSON(DATA_FILE, data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error saving product costs' });
    }
});

app.listen(PORT, () => {
    console.log(`Ã¢Å“â€¦ API Server running at http://localhost:${PORT}`);
});

