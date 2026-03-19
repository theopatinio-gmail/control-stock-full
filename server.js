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

function clampDateToLast60Days(dateStr) {
    const now = new Date();
    const minAllowed = new Date(now);
    minAllowed.setDate(minAllowed.getDate() - 59);

    const minStr = minAllowed.toISOString().split('T')[0];
    if (!dateStr || dateStr < minStr) {
        return minStr;
    }
    return dateStr;
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

        const SNAPSHOT_DATE = cfg.snapshot_date || '2026-02-19';
        const OPERATIONS_DATE_FROM = clampDateToLast60Days(SNAPSHOT_DATE);
        const TODAY_DATE = new Date().toISOString().split('T')[0];

        // 1. Obtener todas las órdenes pagadas desde el snapshot
        console.log(`[ML Sync] Buscando órdenes pagadas desde ${SNAPSHOT_DATE}...`);
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
            if (offset > 500) break;
        }

        console.log(`[ML Sync] Órdenes pagadas encontradas: ${allOrders.length}`);

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

        // Función para verificar si un item es Full (fulfillment)
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
                console.log(`[ML Sync]   📦 Item ${itemId}: logistic_type="${logisticType}" → ${isFull ? 'FULL ✅' : 'NO Full ❌'}`);
                return isFull;
            } catch (e) {
                console.warn(`[ML Sync]   ⚠️ No se pudo verificar item ${itemId}: ${e.message}`);
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

                // ── Filtro dinámico: solo items con logistic_type=fulfillment ──
                const isFull = await isFullItem(itemId);
                if (!isFull) {
                    skippedNonFull++;
                    console.log(`[ML Sync]   ⏭️ Omitida (no Full): ${orderItem.item?.title} - Item ${itemId}`);
                    continue;
                }

                const productName = orderItem.item?.title || 'Producto desconocido';

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
                console.log(`[ML Sync]   ✅ Venta Full: ${productName} (${talle}/${color}) - Orden ${orderId}`);
            }
            existingOpNumbers.add(orderId);
        }

        // 3. Importar ingresos Full (inbound_reception) para los items configurados
        let allNewEntries = [];
        const fullItemIds = Array.isArray(cfg.full_item_ids) ? cfg.full_item_ids.filter(Boolean) : [];

        if (fullItemIds.length > 0) {
            console.log(`[ML Sync] Buscando ingresos Full desde ${OPERATIONS_DATE_FROM} hasta ${TODAY_DATE}...`);

            const inventoryMap = new Map();

            for (const itemId of fullItemIds) {
                try {
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
                    console.warn(`[ML Sync]   ⚠️ No se pudo preparar inventory_id para ${itemId}: ${e.message}`);
                }
            }

            for (const [inventoryId, inventoryInfo] of inventoryMap.entries()) {
                try {
                    let offset = 0;
                    const limit = 50;
                    let hasMore = true;

                    while (hasMore) {
                        const operationsRes = await mlGet(
                            `/stock/fulfillment/operations/search?seller_id=${sellerId}&inventory_id=${encodeURIComponent(inventoryId)}&type=inbound_reception&date_from=${OPERATIONS_DATE_FROM}&date_to=${TODAY_DATE}&limit=${limit}&offset=${offset}&sort=date_desc`,
                            token
                        );

                        const operations = operationsRes.results || [];
                        for (const operation of operations) {
                            const operationId = String(operation.id);
                            if (existingInboundOperationIds.has(operationId)) continue;

                            const quantity = Number(
                                operation.result?.available_quantity
                                ?? operation.detail?.available_quantity
                                ?? operation.result?.total
                                ?? 0
                            );

                            if (quantity <= 0) continue;

                            const inboundReference = (operation.external_references || []).find(ref => ref.type === 'inbound_id')?.value || null;
                            const entryDate = (operation.date_created || '').split('T')[0] || TODAY_DATE;

                            allNewEntries.push({
                                id: `ml-inbound-${operationId}`,
                                product: inventoryInfo.product,
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

                            console.log(`[ML Sync]   ✅ Ingreso Full: ${inventoryInfo.product} (${inventoryInfo.talle}/${inventoryInfo.color}) +${quantity} - Op ${operationId}`);
                        }

                        const total = operationsRes.paging?.total || 0;
                        offset += limit;
                        hasMore = offset < total && operations.length > 0;
                        if (offset > 500) break;
                    }
                } catch (e) {
                    console.warn(`[ML Sync]   ⚠️ No se pudieron consultar ingresos para inventory_id ${inventoryId}: ${e.message}`);
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

        // 5. Actualizar config: last_sync + cache de fulfillment
        cfg.last_sync = new Date().toISOString();
        cfg.fulfillment_cache = fulfillmentCache;
        saveMlConfig(cfg);

        console.log(`[ML Sync] ✅ Sync completo. Ventas Full nuevas: ${allNewSales.length}, ingresos Full nuevos: ${allNewEntries.length}, omitidas (no Full): ${skippedNonFull}`);
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


// ─── ML Debug Orders ─────────────────────────────────────────────────────────

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
        const SNAPSHOT_DATE = cfg.snapshot_date || '2026-02-19';
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
