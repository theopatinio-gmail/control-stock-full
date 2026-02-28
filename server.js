import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const ML_CONFIG_FILE = path.join(__dirname, 'ml_config.json');

app.use(cors());
app.use(express.json());

// ─── Data File Init ───────────────────────────────────────────────────────────

const INITIAL_DATA = { stockEntries: [], sales: [], products: [] };
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
    // Solo importar ventas posteriores a esta fecha (formato YYYY-MM-DD)
    snapshot_date: '2026-02-19'
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

// ─── Data endpoints ───────────────────────────────────────────────────────────

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

// ─── ML Config endpoints ──────────────────────────────────────────────────────

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
            snapshot_date: cfg.snapshot_date || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST guardar credenciales y configuración de sync
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
        console.log('[ML] Configuración actualizada:', { client_id: cfg.client_id, redirect_uri: cfg.redirect_uri });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET url de autorización
app.get('/api/ml/authorize-url', (req, res) => {
    try {
        const cfg = readMlConfig();
        if (!cfg.client_id) {
            return res.status(400).json({ error: 'No hay client_id configurado' });
        }
        const redirectUri = cfg.redirect_uri || 'https://127.0.0.1';
        // Agregamos scopes explícitos para tener permisos de lectura, escritura y renovación de token
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
            return res.status(400).json({ error: 'Configurá las credenciales primero' });
        }

        const params = {
            grant_type: 'authorization_code',
            client_id: cfg.client_id,
            client_secret: cfg.client_secret,
            code: code,
            redirect_uri: cfg.redirect_uri || 'https://127.0.0.1'
        };
        console.log('[ML Exchange] Enviando parámetros:', { ...params, client_secret: '***' });

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

// ─── ML Sync ──────────────────────────────────────────────────────────────────

async function mlGet(path, token) {
    const url = `https://api.mercadolibre.com${path}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (!r.ok) throw new Error(`ML API error ${r.status}: ${JSON.stringify(data)}`);
    return data;
}

// Refresca el token si venció
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
            console.log('[ML] Token refrescado automáticamente.');
        }
    } catch (e) {
        console.warn('[ML] No se pudo refrescar token:', e.message);
    }
    return cfg;
}

app.post('/api/ml/sync', async (req, res) => {
    try {
        let cfg = readMlConfig();
        if (!cfg.access_token) {
            return res.status(400).json({ error: 'No hay token. Autorizá la app primero.' });
        }

        // Intentar refrescar token
        cfg = await refreshTokenIfNeeded(cfg);
        const token = cfg.access_token;

        // 0. Validar token y obtener info del seller
        console.log('[ML Sync] Validando token con /users/me...');
        const me = await mlGet('/users/me', token);
        const sellerId = me.id;
        console.log('[ML Sync] Token válido. User:', me.nickname, 'ID:', sellerId);

        // ── Configuración desde ml_config.json ──
        const FULL_ITEM_IDS = new Set(cfg.full_item_ids || ['MLA864272312', 'MLA2686396878']);
        const SNAPSHOT_DATE = cfg.snapshot_date || '2026-02-19';

        // 1. Obtener órdenes de venta (solo posteriores al snapshot)
        console.log(`[ML Sync] Buscando órdenes Full desde ${SNAPSHOT_DATE}...`);
        const dateFrom = `${SNAPSHOT_DATE}T00:00:00.000-03:00`;
        const ordersRes = await mlGet(
            `/orders/search?seller=${sellerId}&order.status=paid&sort=date_desc&limit=50&order.date_created.from=${encodeURIComponent(dateFrom)}`,
            token
        );
        const orders = ordersRes.results || [];
        console.log(`[ML Sync] Órdenes encontradas: ${orders.length}`);

        if (orders.length === 0) {
            cfg.last_sync = new Date().toISOString();
            saveMlConfig(cfg);
            return res.json({ success: true, newSales: 0, sales: [], message: 'No hay ventas nuevas desde el último snapshot.' });
        }

        // Leer datos actuales para desduplicar
        const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const existingOpNumbers = new Set(currentData.sales.map(s => String(s.opNumber).trim()));

        let allNewSales = [];
        let skippedNonFull = 0;

        for (const order of orders) {
            const orderId = String(order.id);
            if (existingOpNumbers.has(orderId)) continue;

            const orderDate = order.date_closed
                ? order.date_closed.split('T')[0]
                : order.date_created?.split('T')[0];

            // Solo importar ventas después del snapshot
            if (orderDate < SNAPSHOT_DATE) continue;

            for (const orderItem of (order.order_items || [])) {
                const itemId = orderItem.item?.id;

                // ── Filtro: solo items Full ──
                if (!FULL_ITEM_IDS.has(itemId)) {
                    skippedNonFull++;
                    continue;
                }

                const productName = orderItem.item?.title || 'Producto desconocido';

                // Extraer talle y color
                let talle = 'Único';
                let color = 'Único';
                const variation = orderItem.item?.variation_attributes || [];
                for (const attr of variation) {
                    const name = attr.name?.toLowerCase() || '';
                    if (name.includes('talle') || name.includes('talla') || name.includes('size')) {
                        talle = attr.value_name || talle;
                    }
                    if (name.includes('color')) {
                        color = attr.value_name || color;
                    }
                }

                const sale = {
                    id: `ml-${orderId}-${orderItem.item?.variation_id || 'nv'}`,
                    product: productName,
                    talle,
                    color,
                    opNumber: orderId,
                    fechaVenta: orderDate,
                    cantidad: orderItem.quantity || 1,
                    source: 'mercadolibre'
                };
                allNewSales.push(sale);
            }
            existingOpNumbers.add(orderId);
        }

        // 4. Guardar las ventas nuevas en data.json y actualizar lista de productos
        if (allNewSales.length > 0) {
            currentData.sales = [...allNewSales, ...currentData.sales];
            const existingProducts = new Set(currentData.products || []);
            allNewSales.forEach(s => {
                if (s.product && !existingProducts.has(s.product)) {
                    existingProducts.add(s.product);
                }
            });
            currentData.products = [...existingProducts];
            fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 2));
        }

        // 5. Actualizar last_sync
        cfg.last_sync = new Date().toISOString();
        saveMlConfig(cfg);

        console.log(`[ML Sync] ✅ Sync completo. Ventas Full nuevas: ${allNewSales.length}, omitidas (no Full): ${skippedNonFull}`);
        res.json({
            success: true,
            newSales: allNewSales.length,
            skippedNonFull,
            sales: allNewSales,
            message: `Sync completado. ${allNewSales.length} venta(s) Full importada(s).${skippedNonFull > 0 ? ` (${skippedNonFull} no-Full omitidas)` : ''}`
        });

    } catch (e) {
        console.error('[ML Sync] Error:', e);
        res.status(500).json({ error: e.message });
    }
});


// ─── ML Stock (Live from API) ─────────────────────────────────────────────────

app.get('/api/ml/stock', async (req, res) => {
    try {
        let cfg = readMlConfig();
        if (!cfg.access_token) {
            return res.status(400).json({ error: 'No hay token. Autorizá la app primero.' });
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

        // 1. Get all orders to discover item IDs
        let allItemIds = new Set();
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            const ordersRes = await mlGet(
                `/orders/search?seller=${sellerId}&sort=date_desc&offset=${offset}&limit=${limit}`,
                token
            );
            const orders = ordersRes.results || [];
            for (const order of orders) {
                for (const orderItem of (order.order_items || [])) {
                    if (orderItem.item?.id) {
                        allItemIds.add(orderItem.item.id);
                    }
                }
            }
            const total = ordersRes.paging?.total || 0;
            offset += limit;
            hasMore = offset < total && orders.length > 0;
            // Safety limit - after finding enough items, stop
            if (offset > 500) break;
        }

        console.log(`[ML Stock] Items descubiertos desde órdenes: ${allItemIds.size}`);

        if (allItemIds.size === 0) {
            return res.json({ items: [], message: 'No se encontraron items en las órdenes.' });
        }

        // 2. Fetch details for each item individually
        const itemIdArray = [...allItemIds];
        const items = [];
        for (const id of itemIdArray) {
            try {
                const item = await mlGet(`/items/${id}`, token);
                items.push(item);
                console.log(`[ML Stock]   ✓ ${id}: ${item.title?.substring(0, 40)} (${item.status})`);
            } catch (e) {
                console.warn(`[ML Stock]   ✗ ${id}: ${e.message}`);
            }
        }

        console.log(`[ML Stock] Detalles obtenidos: ${items.length} items`);

        // 3. Build stock data from items and their variations (only active items)
        const stockItems = [];

        for (const item of items) {
            const title = item.title || 'Producto desconocido';
            const variations = item.variations || [];
            const isActive = item.status === 'active';

            if (variations.length === 0) {
                stockItems.push({
                    itemId: item.id,
                    title,
                    talle: 'Único',
                    color: 'Único',
                    available_quantity: item.available_quantity || 0,
                    active: isActive
                });
            } else {
                for (const variation of variations) {
                    let talle = 'Único';
                    let color = 'Único';

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

        console.log(`[ML Stock] ✅ Stock obtenido. ${stockItems.length} variantes totales, ${stockItems.filter(i => i.active).length} activas.`);
        res.json({
            success: true,
            items: stockItems,
            fetchedAt: new Date().toISOString()
        });

    } catch (e) {
        console.error('[ML Stock] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── Server ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`✅ API Server running at http://localhost:${PORT}`);
});
