import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeProductName } from './src/utils/productMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_CONFIG_FILE = path.join(__dirname, 'ml_config.json');

app.use(cors());
app.use(express.json());

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Data File Init Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const INITIAL_DATA = { 
    manualMovements: [], 
    sales: [], 
    products: [
        'PantalÃƒÂ³n Palazzo De Jean Mujer Tiro Alto Ancho',
        'PantalÃƒÂ³n Palazzo Jean Mujer Cintura Elastizada Frika',
        'Bermuda Mujer Gabardina Cintura Elastizada Mod. Lirio Frika',
        'Jean Oxford Mujer Tiro Alto Elastizado PantalÃƒÂ³n Frika',
        'Conjunto Morley Mujer Pantalon Recto Remera Oversize Frika'
    ], 
    mlStock: [], 
    mlStockFetchedAt: null 
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

const FULL_MOVEMENTS_START_DATE = '2025-07-01';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Data endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

app.get('/api/data', (req, res) => {
    console.log('[GET] Reading data.json...');
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('[ERROR] Reading:', error);
        res.status(500).json({ error: 'Error reading data file' });
    }
});

app.post('/api/data', (req, res) => {
    console.log('[POST] Saving data... Entries:', req.body.stockEntries?.length || 0);
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
        console.log('[SUCCESS] Data saved to disk.');
        res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] Writing:', error);
        res.status(500).json({ error: 'Error writing data file' });
    }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ ML Config endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ ML Sync Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function mlGet(path, token) {
    const url = `https://api.mercadolibre.com${path}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (!r.ok) throw new Error(`ML API error ${r.status}: ${JSON.stringify(data)}`);
    return data;
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

function extractVariantAttributes(attributes = []) {
    let talle = 'Unico';
    let color = 'Unico';

    for (const attr of attributes) {
        const name = attr?.name?.toLowerCase() || '';
        if (name.includes('talle') || name.includes('talla') || name.includes('size')) {
            talle = attr.value_name || talle;
        }
        if (name.includes('color')) {
            color = attr.value_name || color;
        }
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
        const existingInboundOperationIds = new Set(
            (currentData.stockEntries || [])
                .flatMap(entry => Array.isArray(entry.mlOperationIds) ? entry.mlOperationIds : [entry.mlOperationId])
                .filter(Boolean)
                .map(id => String(id).trim())
        );

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
                console.log(`[ML Sync]   Ã°Å¸â€œÂ¦ Item ${itemId}: logistic_type="${logisticType}" Ã¢â€ â€™ ${isFull ? 'FULL Ã¢Å“â€¦' : 'NO Full Ã¢ÂÅ’'}`);
                return isFull;
            } catch (e) {
                console.warn(`[ML Sync]   Ã¢Å¡Â Ã¯Â¸Â No se pudo verificar item ${itemId}: ${e.message}`);
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

            for (const orderItem of (order.order_items || [])) {
                const itemId = orderItem.item?.id;

                // Ã¢â€â‚¬Ã¢â€â‚¬ Filtro dinÃƒÂ¡mico: solo items con logistic_type=fulfillment Ã¢â€â‚¬Ã¢â€â‚¬
                const isFull = await isFullItem(itemId);
                if (!isFull) {
                    skippedNonFull++;
                    console.log(`[ML Sync]   Ã¢ÂÂ­Ã¯Â¸Â Omitida (no Full): ${orderItem.item?.title} - Item ${itemId}`);
                    continue;
                }

                const rawProductName = orderItem.item?.title || 'Producto desconocido';
                const productName = normalizeProductName(rawProductName);

                const { talle, color } = extractVariantAttributes(orderItem.item?.variation_attributes || []);

                const sale = {
                    id: `ml-${orderId}-${orderItem.item?.variation_id || 'nv'}`,
                    product: productName,
                    talle,
                    color,
                    opNumber: orderId,
                    fechaVenta: orderDate,
                    cantidad: orderItem.quantity || 1,
                    source: 'mercadolibre',
                    mlItemId: itemId || null
                };
                allNewSales.push(sale);
                console.log(`[ML Sync]   Ã¢Å“â€¦ Venta Full: ${productName} (${talle}/${color}) - Orden ${orderId}`);
            }
            existingOpNumbers.add(orderId);
        }

        // 3. Obtener todos los items activos del seller para descubrir ingresos a Full automÃƒÂ¡ticamente
        let allSellerItems = new Set();
        try {
            console.log(`[ML Sync] Buscando todos los items activos del vendedor ${sellerId}...`);
            let itemOffset = 0;
            const itemLimit = 50;
            let fetchingItems = true;
            while (fetchingItems) {
                const searchRes = await mlGet(`/users/${sellerId}/items/search?status=active&offset=${itemOffset}&limit=${itemLimit}`, token);
                const results = searchRes.results || [];
                for (const id of results) allSellerItems.add(id);

                const total = searchRes.paging?.total || 0;
                itemOffset += itemLimit;
                fetchingItems = itemOffset < total && results.length > 0;
            }
            console.log(`[ML Sync] Se encontraron ${allSellerItems.size} items activos en total.`);
        } catch (e) {
            console.warn(`[ML Sync]   Ã¢Å¡Â Ã¯Â¸Â No se pudieron obtener los items del vendedor: ${e.message}`);
        }

        // Agregar tambiÃƒÂ©n los configurados manualmente (por si hay inactivos con stock)
        const configuredIds = Array.isArray(cfg.full_item_ids) ? cfg.full_item_ids.filter(Boolean) : [];
        configuredIds.forEach(id => allSellerItems.add(id));

        // 4. Importar ingresos Full (inbound_reception) para los items descubiertos
        let allNewEntries = [];

        if (allSellerItems.size > 0) {
            console.log(`[ML Sync] Verificando cuÃƒÂ¡les de los ${allSellerItems.size} items son Full y buscando sus ingresos desde ${OPERATIONS_DATE_FROM} hasta ${TODAY_DATE}...`);

            const inventoryMap = new Map();

            for (const itemId of allSellerItems) {
                try {
                    const isFull = await isFullItem(itemId);
                    if (!isFull) continue;

                    const item = await getItem(itemId);
                    if (!item) continue;

                    const baseProduct = item.title || itemId;

                    if (Array.isArray(item.variations) && item.variations.length > 0) {
                        for (const variation of item.variations) {
                            if (!variation.inventory_id) continue;
                            const { talle, color } = extractVariantAttributes(variation.attribute_combinations || variation.attributes || []);
                            inventoryMap.set(variation.inventory_id, {
                                itemId,
                                product: baseProduct,
                                talle,
                                color
                            });
                        }
                    } else if (item.inventory_id) {
                        inventoryMap.set(item.inventory_id, {
                            itemId,
                            product: baseProduct,
                            talle: 'Unico',
                            color: 'Unico'
                        });
                    }
                } catch (e) {
                    console.warn(`[ML Sync]   Ã¢Å¡Â Ã¯Â¸Â No se pudo preparar inventory_id para ${itemId}: ${e.message}`);
                }
            }

            for (const [inventoryId, inventoryInfo] of inventoryMap.entries()) {
                try {
                    const windows = getDateWindows(OPERATIONS_DATE_FROM, TODAY_DATE);
                    const limit = 50;

                    for (const window of windows) {
                        let offset = 0;
                        let hasMore = true;

                        while (hasMore) {
                            const operationsRes = await mlGet(
                                `/stock/fulfillment/operations/search?seller_id=${sellerId}&inventory_id=${encodeURIComponent(inventoryId)}&date_from=${window.from}&date_to=${window.to}&limit=${limit}&offset=${offset}`,
                                token
                            );

                            const operations = operationsRes.results || [];
                            for (const operation of operations) {
                                if (operation.type !== 'INBOUND_RECEPTION') continue;

                                const operationId = String(operation.id);
                                if (existingInboundOperationIds.has(operationId)) continue;

                                const quantity = Number(
                                    operation.detail?.available_quantity
                                    ?? operation.result?.available_quantity
                                    ?? operation.result?.total
                                    ?? 0
                                );

                                if (quantity <= 0) continue;

                                const inboundReference = (operation.external_references || []).find(ref => ref.type === 'inbound_id')?.value || null;
                                const entryDate = (operation.date_created || '').split('T')[0] || TODAY_DATE;

                                allNewEntries.push({
                                    id: `ml-inbound-${operationId}`,
                                    product: normalizeProductName(inventoryInfo.product),
                                    fechaEnvio: entryDate,
                                    variants: [{
                                        talle: inventoryInfo.talle,
                                        color: inventoryInfo.color,
                                        cantidad: quantity
                                    }],
                                    source: 'mercadolibre',
                                    mlItemId: inventoryInfo.itemId,
                                    mlInventoryId: inventoryId,
                                    mlOperationId: operationId,
                                    mlOperationIds: [operationId],
                                    mlInboundId: inboundReference
                                });
                                existingInboundOperationIds.add(operationId);

                                console.log(`[ML Sync] Ingreso Full: ${inventoryInfo.product} (${inventoryInfo.talle}/${inventoryInfo.color}) +${quantity} - Op ${operationId}`);
                            }

                            const total = operationsRes.paging?.total || 0;
                            offset += limit;
                            hasMore = offset < total && operations.length > 0;
                            if (offset > 500) break;
                        }
                    }
                } catch (e) {
                    console.warn(`[ML Sync] No se pudieron consultar ingresos para inventory_id ${inventoryId}: ${e.message}`);
                }
            }
        }

        // 4. Guardar las ventas nuevas en data.json
        if (allNewSales.length > 0 || allNewEntries.length > 0) {
            if (allNewSales.length > 0) {
                currentData.sales = [...allNewSales, ...currentData.sales];
            }
            if (allNewEntries.length > 0) {
                currentData.stockEntries = [...allNewEntries, ...(currentData.stockEntries || [])];
            }
            const existingProducts = new Set(currentData.products || []);
            [...allNewSales, ...allNewEntries].forEach(record => {
                if (record.product && !existingProducts.has(record.product)) {
                    existingProducts.add(record.product);
                }
            });
            currentData.products = [...existingProducts];
            fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 2));
        }

        // Persistir stock ML actualizado despuÃƒÂ©s del sync
        try {
            const stockRes = await fetch(`http://localhost:${PORT}/api/ml/stock`, {
                headers: { 'Accept': 'application/json' }
            });
            if (stockRes.ok) {
                console.log('[ML Sync] Stock de ML actualizado en data.json despuÃƒÂ©s del sync.');
            }
        } catch (stockErr) {
            console.warn('[ML Sync] No se pudo actualizar stock ML post-sync:', stockErr.message);
        }

        // 5. Actualizar config: last_sync + cache de fulfillment
        cfg.last_sync = new Date().toISOString();
        cfg.fulfillment_cache = fulfillmentCache;
        saveMlConfig(cfg);

        console.log(`[ML Sync] Ã¢Å“â€¦ Sync completo. Ventas Full nuevas: ${allNewSales.length}, ingresos Full nuevos: ${allNewEntries.length}, omitidas (no Full): ${skippedNonFull}`);
        res.json({
            success: true,
            newSales: allNewSales.length,
            newEntries: allNewEntries.length,
            skippedNonFull,
            sales: allNewSales,
            entries: allNewEntries,
            message: `Sync completado. ${allNewSales.length} venta(s) Full y ${allNewEntries.length} ingreso(s) Full importado(s).${skippedNonFull > 0 ? ` (${skippedNonFull} no-Full omitidas)` : ''}`
        });

    } catch (e) {
        console.error('[ML Sync] Error:', e);
        res.status(500).json({ error: e.message });
    }
});


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ ML Debug Orders Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ ML Stock (Live from API) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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
        let itemOffset = 0;
        const itemLimit = 50;
        let fetchingItems = true;

        while (fetchingItems) {
            const searchRes = await mlGet(
                `/users/${sellerId}/items/search?status=active&offset=${itemOffset}&limit=${itemLimit}`,
                token
            );
            const results = searchRes.results || [];
            results.forEach(id => allItemIds.add(id));
            
            const total = searchRes.paging?.total || 0;
            itemOffset += itemLimit;
            fetchingItems = itemOffset < total && results.length > 0;
            if (itemOffset > 1000) break;
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
                    console.log(`[ML Stock]   Ã¢ÂÂ­Ã¯Â¸Â ${id}: No-Full Ã¢ÂÅ’`);
                }
            } catch (e) {
                console.warn(`[ML Stock]   Ã¢Å“â€” ${id}: ${e.message}`);
            }
        }

        console.log(`[ML Stock] Detalles obtenidos: ${items.length} items`);

        // 3. Build stock data from items and their variations (only active items)
        const stockItems = [];

        for (const item of items) {
            const title = normalizeProductName(item.title) || 'Producto desconocido';
            const variations = item.variations || [];
            const isActive = item.status === 'active';

            if (variations.length === 0) {
                stockItems.push({
                    itemId: item.id,
                    title,
                    talle: 'ÃƒÅ¡nico',
                    color: 'ÃƒÅ¡nico',
                    available_quantity: item.available_quantity || 0,
                    active: isActive
                });
            } else {
                for (const variation of variations) {
                    let talle = 'ÃƒÅ¡nico';
                    let color = 'ÃƒÅ¡nico';

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
            fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 2));
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Server Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

app.listen(PORT, () => {
    console.log(`Ã¢Å“â€¦ API Server running at http://localhost:${PORT}`);
});
