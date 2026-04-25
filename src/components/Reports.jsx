import React, { useMemo, useState } from 'react';
import { getProductCatalogEntry, normalizeProductName } from '../utils/productMapping';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 12;
const RECENT_DAYS = 28;

function toDateKey(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

function formatShortDate(dateKey) {
    const d = new Date(`${dateKey}T00:00:00`);
    return d.toLocaleDateString('es-AR', { month: 'short', day: '2-digit' });
}

function getISOWeekKey(date) {
    const d = new Date(`${date}T00:00:00`);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const weekNo = 1 + Math.round(((d - firstThursday) / DAY_MS - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function compactNumber(value) {
    return new Intl.NumberFormat('es-AR').format(value || 0);
}

function canonicalizeProductName(value) {
    return normalizeProductName(value || 'Sin producto') || 'Sin producto';
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function MiniStat({ label, value, hint, tone = 'neutral' }) {
    return (
        <div className={`report-stat report-stat-${tone}`}>
            <span className="report-stat-label">{label}</span>
            <strong className="report-stat-value">{value}</strong>
            {hint && <span className="report-stat-hint">{hint}</span>}
        </div>
    );
}

function HorizontalBars({ rows, valueKey, labelKey, tone = 'violet', maxValue, suffix = '' }) {
    const max = maxValue || Math.max(1, ...rows.map(row => Math.abs(row[valueKey] || 0)));

    return (
        <div className="report-bars">
            {rows.map(row => {
                const rawValue = row[valueKey] || 0;
                const width = clamp((Math.abs(rawValue) / max) * 100, 4, 100);
                return (
                    <div key={row[labelKey]} className="report-bar-row">
                        <div className="report-bar-meta">
                            <span className="report-bar-label">{row[labelKey]}</span>
                            <span className="report-bar-number">{compactNumber(rawValue)}{suffix}</span>
                        </div>
                        <div className="report-bar-track">
                            <div className={`report-bar-fill tone-${tone}`} style={{ width: `${width}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TrendChart({ days }) {
    const width = 920;
    const height = 260;
    const padding = 24;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;
    const baselineY = padding + plotH / 2;
    const maxAbs = Math.max(1, ...days.map(day => Math.max(Math.abs(day.inQty), Math.abs(day.outQty), Math.abs(day.net))));
    const stepX = plotW / Math.max(1, days.length - 1);

    const points = days.map((day, index) => {
        const x = padding + index * stepX;
        const netY = baselineY - (day.net / maxAbs) * (plotH / 2 - 20);
        return `${x},${netY}`;
    }).join(' ');

    return (
        <div className="trend-chart-wrap">
            <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="Tendencia de movimientos recientes">
                <defs>
                    <linearGradient id="barIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <linearGradient id="barOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                </defs>

                {[0.5, 0.25, 0, -0.25, -0.5].map((level, index) => {
                    const y = baselineY - level * (plotH / 2 - 24);
                    return (
                        <line
                            key={index}
                            x1={padding}
                            x2={width - padding}
                            y1={y}
                            y2={y}
                            stroke="rgba(148, 163, 184, 0.18)"
                            strokeDasharray={index === 2 ? '0' : '4 6'}
                        />
                    );
                })}

                <line x1={padding} x2={width - padding} y1={baselineY} y2={baselineY} stroke="rgba(148, 163, 184, 0.35)" />

                {days.map((day, index) => {
                    const x = padding + index * stepX;
                    const barW = Math.max(4, stepX * 0.58);
                    const inH = (day.inQty / maxAbs) * (plotH / 2 - 18);
                    const outH = (day.outQty / maxAbs) * (plotH / 2 - 18);
                    return (
                        <g key={day.date}>
                            <rect
                                x={x - barW / 2}
                                y={baselineY - inH}
                                width={barW}
                                height={inH}
                                rx="4"
                                fill="url(#barIn)"
                                opacity={day.inQty > 0 ? 1 : 0.15}
                            />
                            <rect
                                x={x - barW / 2}
                                y={baselineY}
                                width={barW}
                                height={outH}
                                rx="4"
                                fill="url(#barOut)"
                                opacity={day.outQty > 0 ? 1 : 0.15}
                            />
                        </g>
                    );
                })}

                <polyline
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                />
            </svg>

            <div className="trend-legend">
                <span><i className="legend-swatch swatch-in" />Ingresos</span>
                <span><i className="legend-swatch swatch-out" />Egresos</span>
                <span><i className="legend-swatch swatch-net" />Neto</span>
            </div>
            <div className="trend-labels">
                {days.map(day => (
                    <span key={day.date}>{formatShortDate(day.date)}</span>
                ))}
            </div>
        </div>
    );
}

const Reports = ({ manualMovements = [], sales = [], products = [], mlStock = [], mlStockFetchedAt = null, productCosts = {} }) => {
    const report = useMemo(() => {
        const productSet = [...new Set(products.filter(Boolean))];
        const manualByProduct = {};
        const salesByProduct = {};
        const productLabels = new Map();
        const returnedQtyBySaleId = manualMovements.reduce((acc, movement) => {
            if (movement?.type !== 'devolucion' || !movement.originSaleId) return acc;
            acc[movement.originSaleId] = (acc[movement.originSaleId] || 0) + Number(movement.quantity || 1);
            return acc;
        }, {});

        productSet.forEach(product => {
            manualByProduct[product] = { inQty: 0, outQty: 0, net: 0, movements: 0 };
            salesByProduct[product] = { units: 0, orders: 0 };
            const entry = getProductCatalogEntry(product);
            productLabels.set(product, entry?.colors?.join(', ') || '');
        });

        let totalIn = 0;
        let totalOut = 0;
        let manualCount = 0;

        manualMovements.forEach(m => {
            const product = m.product || 'Sin producto';
            if (!manualByProduct[product]) {
                manualByProduct[product] = { inQty: 0, outQty: 0, net: 0, movements: 0 };
                productLabels.set(product, '');
            }
            const qty = Number(m.quantity || 1);
            const isIncome = m.type === 'ingreso' || m.type === 'devolucion';
            manualByProduct[product].movements += 1;
            manualByProduct[product].net += isIncome ? qty : -qty;
            if (isIncome) {
                manualByProduct[product].inQty += qty;
                totalIn += qty;
            } else {
                manualByProduct[product].outQty += qty;
                totalOut += qty;
            }
            manualCount += 1;
        });

        let salesCount = 0;
        let salesUnits = 0;
        sales.forEach(s => {
            const product = canonicalizeProductName(s.product || 'Sin producto');
            if (!salesByProduct[product]) salesByProduct[product] = { units: 0, orders: 0 };
            const qty = Number(s.cantidad || 1);
            const effectiveQty = Math.max(0, qty - (returnedQtyBySaleId[s.id] || 0));
            salesByProduct[product].units += effectiveQty;
            salesByProduct[product].orders += 1;
            salesCount += 1;
            salesUnits += effectiveQty;
        });

        const stockRows = Object.entries(manualByProduct)
            .map(([product, stats]) => ({
                product,
                stock: stats.net,
                inQty: stats.inQty,
                outQty: stats.outQty,
                movements: stats.movements,
                colors: productLabels.get(product) || ''
            }))
            .sort((a, b) => b.stock - a.stock || a.product.localeCompare(b.product));

        const topSalesRows = Object.entries(salesByProduct)
            .map(([product, stats]) => ({ product, units: stats.units, orders: stats.orders }))
            .filter(row => row.units > 0)
            .sort((a, b) => b.units - a.units || a.product.localeCompare(b.product));

        const recentDays = Array.from({ length: RECENT_DAYS }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (RECENT_DAYS - 1 - i));
            const key = d.toISOString().slice(0, 10);
            return { date: key, inQty: 0, outQty: 0, net: 0 };
        });
        const recentMap = new Map(recentDays.map(day => [day.date, day]));

        manualMovements.forEach(m => {
            const key = toDateKey(m.date);
            if (!key || !recentMap.has(key)) return;
            const bucket = recentMap.get(key);
            const qty = Number(m.quantity || 1);
            const isIncome = m.type === 'ingreso' || m.type === 'devolucion';
            if (isIncome) bucket.inQty += qty;
            else bucket.outQty += qty;
            bucket.net += isIncome ? qty : -qty;
        });

        const recentTrend = [...recentMap.values()];

        const weeklyBuckets = Array.from({ length: WEEKS }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i * 7);
            const weekKey = getISOWeekKey(d.toISOString().slice(0, 10));
            return { weekKey, inQty: 0, outQty: 0, net: 0 };
        }).reverse();
        const weeklyMap = new Map(weeklyBuckets.map(w => [w.weekKey, w]));

        manualMovements.forEach(m => {
            const keyDate = toDateKey(m.date);
            if (!keyDate) return;
            const weekKey = getISOWeekKey(keyDate);
            if (!weeklyMap.has(weekKey)) return;
            const bucket = weeklyMap.get(weekKey);
            const qty = Number(m.quantity || 1);
            const isIncome = m.type === 'ingreso' || m.type === 'devolucion';
            if (isIncome) bucket.inQty += qty;
            else bucket.outQty += qty;
            bucket.net += isIncome ? qty : -qty;
        });

        const negativeStock = stockRows.filter(row => row.stock < 0).sort((a, b) => a.stock - b.stock);
        const lowStock = stockRows.filter(row => row.stock >= 0 && row.stock <= 3).sort((a, b) => a.stock - b.stock);
        const topMovements = stockRows.filter(row => row.movements > 0).sort((a, b) => b.movements - a.movements).slice(0, 5);
        const activeMl = mlStock.filter(item => item.active).length;

        // --- Riesgo de cierre de depósito (variantes con stock=0 y countdown de 30 días) ---
        // Usa exactamente el mismo cálculo que el Dashboard: itera manualMovements agrupando por product|talle|color
        const todayMs = new Date().setHours(0, 0, 0, 0);
        const allowedProductsSet = new Set(products.filter(Boolean));

        // Paso 1: construir stockMap de variantes (idéntico al Dashboard)
        const variantStockMap = {}; // "product|talle|color" -> qty
        const variantLastEgresoMap = {}; // "product|talle|color" -> última fecha de egreso

        manualMovements.forEach(m => {
            if (!allowedProductsSet.has(m.product)) return;
            const key = `${m.product}|${m.talle || ''}|${m.color || ''}`;
            const qty = Number(m.quantity || 1);
            if (m.type === 'ingreso' || m.type === 'devolucion') {
                variantStockMap[key] = (variantStockMap[key] || 0) + qty;
            } else if (m.type === 'egreso') {
                variantStockMap[key] = (variantStockMap[key] || 0) - qty;
                const d = toDateKey(m.date);
                if (d && (!variantLastEgresoMap[key] || d > variantLastEgresoMap[key])) {
                    variantLastEgresoMap[key] = d;
                }
            }
        });

        // Paso 2: última venta ML por variante (normalizada a canonical)
        const variantLastSaleMap = { ...variantLastEgresoMap };
        sales.forEach(s => {
            const canonical = canonicalizeProductName(s.product || '');
            if (!canonical) return;
            const d = toDateKey(s.fechaVenta);
            if (!d) return;
            // Intentar matchear con claves existentes en variantStockMap
            // La clave del movimiento usa el nombre tal como está guardado en manualMovements
            // Buscar todas las claves que empiecen con un producto cuyo canonical coincida
            for (const key of Object.keys(variantStockMap)) {
                const [kProduct, kTalle, kColor] = key.split('|');
                if (canonicalizeProductName(kProduct) !== canonical) continue;
                if (kTalle !== (s.talle || '')) continue;
                const sColor = s.color || '';
                if (kColor !== sColor && sColor !== 'Unico') continue;
                if (!variantLastSaleMap[key] || d > variantLastSaleMap[key]) {
                    variantLastSaleMap[key] = d;
                }
            }
        });

        // Paso 3: filtrar variantes con stock ≤ 0
        const zeroStockVariants = Object.entries(variantStockMap)
            .filter(([, stock]) => stock <= 0)
            .map(([key, stock]) => {
                const [product, size, color] = key.split('|');
                const lastSaleDateKey = variantLastSaleMap[key] || null;
                let daysSinceSale = null;
                let daysRemaining = null;
                if (lastSaleDateKey) {
                    const lastMs = new Date(`${lastSaleDateKey}T00:00:00`).getTime();
                    daysSinceSale = Math.floor((todayMs - lastMs) / DAY_MS);
                    daysRemaining = 30 - daysSinceSale;
                }
                return { product, size, color, stock, lastSaleDate: lastSaleDateKey, daysSinceSale, daysRemaining };
            });

        // Ordenar: más urgentes primero (menos días restantes), sin datos al final
        zeroStockVariants.sort((a, b) => {
            if (a.daysRemaining === null && b.daysRemaining === null) return a.product.localeCompare(b.product);
            if (a.daysRemaining === null) return 1;
            if (b.daysRemaining === null) return -1;
            return a.daysRemaining - b.daysRemaining;
        });

        return {
            totalIn,
            totalOut,
            netStock: totalIn - totalOut,
            manualCount,
            salesCount,
            salesUnits,
            stockRows,
            topSalesRows,
            recentTrend,
            weeklyBuckets,
            negativeStock,
            lowStock,
            topMovements,
            activeMl,
            mlStockCount: mlStock.length,
            mlStockFetchedAt,
            zeroStockVariants
        };
    }, [manualMovements, sales, products, mlStock, mlStockFetchedAt, productCosts]);

    const topStockRows = report.stockRows.slice(0, 6);
    const chartMax = Math.max(1, ...topStockRows.map(row => Math.abs(row.stock)));

    return (
        <div className="animate-fade-in reports-page">
            <div className="dashboard-header">
                <div className="header-titles">
                    <h2>📊 Informes</h2>
                    <p className="subtitle">Resumen ejecutivo para ver ventas, stock, rotación y alertas</p>
                </div>
                <div className="dashboard-controls">
                    <span className="grand-total-badge positive">Stock neto: {compactNumber(report.netStock)}</span>
                </div>
            </div>

            <div className="reports-kpis">
                <MiniStat label="Ingresos" value={compactNumber(report.totalIn)} hint="Cantidad total ingresada" tone="success" />
                <MiniStat label="Egresos" value={compactNumber(report.totalOut)} hint="Cantidad total salida" tone="danger" />
                <MiniStat label="Ventas ML" value={compactNumber(report.salesCount)} hint={`${compactNumber(report.salesUnits)} unidades`} tone="violet" />
                <MiniStat label="Movimientos" value={compactNumber(report.manualCount)} hint="Ingresos + egresos manuales" tone="neutral" />
                <MiniStat label="Stock ML" value={compactNumber(report.activeMl)} hint={`${compactNumber(report.mlStockCount)} variantes guardadas`} tone="blue" />
            </div>

            <div className="reports-grid">
                <section className="card glass report-card report-card-wide">
                    <div className="report-card-head">
                        <div>
                            <h3>Movimiento reciente</h3>
                            <p>Últimos 28 días. Verde = ingresos, rojo = egresos, línea azul = neto.</p>
                        </div>
                    </div>
                    <TrendChart days={report.recentTrend} />
                </section>

                <section className="card glass report-card">
                    <div className="report-card-head">
                        <div>
                            <h3>Stock actual por artículo</h3>
                            <p>Foto del stock neto actual, ordenado de mayor a menor.</p>
                        </div>
                    </div>
                    <HorizontalBars rows={topStockRows} labelKey="product" valueKey="stock" tone="violet" maxValue={chartMax} />
                </section>

                <section className="card glass report-card">
                    <div className="report-card-head">
                        <div>
                            <h3>Productos más vendidos</h3>
                            <p>Unidades vendidas desde ML, según las ventas importadas.</p>
                        </div>
                    </div>
                    <HorizontalBars rows={report.topSalesRows.slice(0, 6)} labelKey="product" valueKey="units" tone="blue" />
                </section>

                <section className="card glass report-card">
                    <div className="report-card-head">
                        <div>
                            <h3>Alertas de stock</h3>
                            <p>Artículos sin margen o con stock negativo.</p>
                        </div>
                    </div>
                    <div className="report-alerts">
                        <div className="report-alert-box danger">
                            <strong>Stock negativo</strong>
                            <span>{report.negativeStock.length}</span>
                        </div>
                        <div className="report-alert-box warning">
                            <strong>Stock bajo</strong>
                            <span>{report.lowStock.length}</span>
                        </div>
                        <div className="report-alert-list">
                            {(report.negativeStock.slice(0, 3).length > 0 ? report.negativeStock.slice(0, 3) : report.lowStock.slice(0, 3)).map(row => (
                                <div key={row.product} className="report-alert-item">
                                    <span>{row.product}</span>
                                    <strong>{compactNumber(row.stock)}</strong>
                                </div>
                            ))}
                            {report.negativeStock.length === 0 && report.lowStock.length === 0 && (
                                <div className="report-empty-note">No hay alertas de stock por ahora.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="card glass report-card">
                    <div className="report-card-head">
                        <div>
                            <h3>Rotación</h3>
                            <p>Artículos con más movimientos totales, útil para ver qué gira más.</p>
                        </div>
                    </div>
                    <div className="report-rotation-list">
                        {report.topMovements.length > 0 ? report.topMovements.map(row => (
                            <div key={row.product} className="report-rotation-item">
                                <div>
                                    <strong>{row.product}</strong>
                                    <span>{row.movements} movimientos</span>
                                </div>
                                <div className="report-rotation-metric">
                                    <span>Stock</span>
                                    <strong>{compactNumber(row.stock)}</strong>
                                </div>
                            </div>
                        )) : (
                            <div className="report-empty-note">Todavía no hay movimientos suficientes para medir rotación.</div>
                        )}
                    </div>
                </section>

                <section className="card glass report-card report-card-wide">
                    <div className="report-card-head">
                        <div>
                            <h3>Estado de Mercado Libre</h3>
                            <p>Último snapshot importado y cantidad de variantes activas.</p>
                        </div>
                    </div>
                    <div className="reports-metrics-row">
                        <div className="report-metric-pill">
                            <span>Variantes guardadas</span>
                            <strong>{compactNumber(report.mlStockCount)}</strong>
                        </div>
                        <div className="report-metric-pill">
                            <span>Variantes activas</span>
                            <strong>{compactNumber(report.activeMl)}</strong>
                        </div>
                        <div className="report-metric-pill">
                            <span>Último fetch</span>
                            <strong>{report.mlStockFetchedAt ? new Date(report.mlStockFetchedAt).toLocaleString('es-AR') : 'Sin datos'}</strong>
                        </div>
                    </div>
                </section>

                <ZeroStockCountdown variants={report.zeroStockVariants} />

                <FinancialReport
                    sales={sales} 
                    manualMovements={manualMovements}
                    products={products} 
                    productCosts={productCosts}
                    mlStock={mlStock}
                />
            </div>
        </div>
    );
};

export default Reports;

function ZeroStockCountdown({ variants = [] }) {
    const [showAll, setShowAll] = useState(false);

    function urgencyTone(daysRemaining) {
        if (daysRemaining === null) return { label: 'Sin datos', cls: 'urgency-unknown' };
        if (daysRemaining <= 0) return { label: 'BLOQUEADO', cls: 'urgency-blocked' };
        if (daysRemaining <= 7) return { label: `${daysRemaining}d`, cls: 'urgency-critical' };
        if (daysRemaining <= 15) return { label: `${daysRemaining}d`, cls: 'urgency-warning' };
        return { label: `${daysRemaining}d`, cls: 'urgency-safe' };
    }

    const displayed = showAll ? variants : variants.slice(0, 20);
    const blockedCount = variants.filter(v => v.daysRemaining !== null && v.daysRemaining <= 0).length;
    const criticalCount = variants.filter(v => v.daysRemaining !== null && v.daysRemaining > 0 && v.daysRemaining <= 7).length;

    return (
        <section className="card glass report-card report-card-wide">
            <div className="report-card-head">
                <div>
                    <h3>⏳ Riesgo de cierre de depósito</h3>
                    <p>
                        Variantes con stock 0 y días restantes para poder seguir enviando stock.
                        ML bloquea el envío si una variante no vende en <strong>30 días</strong>.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {blockedCount > 0 && (
                        <span className="grand-total-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            {blockedCount} bloqueada{blockedCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {criticalCount > 0 && (
                        <span className="grand-total-badge" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                            {criticalCount} crítica{criticalCount !== 1 ? 's' : ''} (&lt;7d)
                        </span>
                    )}
                    {variants.length === 0 && (
                        <span className="grand-total-badge positive">Sin riesgo</span>
                    )}
                </div>
            </div>

            {variants.length === 0 ? (
                <div className="report-empty-note">Todas las variantes tienen stock disponible. No hay riesgo de cierre.</div>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="zerostock-table">
                            <thead>
                                <tr>
                                    <th>Artículo</th>
                                    <th>Talle</th>
                                    <th>Color</th>
                                    <th>Stock</th>
                                    <th>Última venta</th>
                                    <th>Días sin venta</th>
                                    <th>Días restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.map(v => {
                                    const tone = urgencyTone(v.daysRemaining);
                                    return (
                                        <tr key={`${v.product}|${v.size}|${v.color}`} className={`zerostock-row ${tone.cls}`}>
                                            <td className="zerostock-product">{v.product}</td>
                                            <td className="zerostock-center">{v.size}</td>
                                            <td className="zerostock-center">{v.color}</td>
                                            <td className="zerostock-center zerostock-stock">{v.stock}</td>
                                            <td className="zerostock-center">
                                                {v.lastSaleDate
                                                    ? new Date(`${v.lastSaleDate}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                    : <span className="zerostock-nodata">Sin datos</span>}
                                            </td>
                                            <td className="zerostock-center">
                                                {v.daysSinceSale !== null ? `${v.daysSinceSale}d` : <span className="zerostock-nodata">-</span>}
                                            </td>
                                            <td className="zerostock-center">
                                                <span className={`urgency-badge ${tone.cls}`}>{tone.label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {variants.length > 20 && (
                        <button
                            className="btn-secondary"
                            style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
                            onClick={() => setShowAll(prev => !prev)}
                        >
                            {showAll ? 'Ver menos' : `Ver todas (${variants.length})`}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}

function FinancialReport({ sales = [], manualMovements = [], products = [], productCosts = {}, mlStock = [] }) {
    const [filterProduct, setFilterProduct] = useState('todos');
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().slice(0, 10);
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0);
    };

    const normalizedSales = sales.map(sale => ({
        ...sale,
        canonicalProduct: canonicalizeProductName(sale.product)
    }));
    const returnedQtyBySaleId = manualMovements.reduce((acc, movement) => {
        if (movement?.type !== 'devolucion' || !movement.originSaleId) return acc;
        acc[movement.originSaleId] = (acc[movement.originSaleId] || 0) + Number(movement.quantity || 1);
        return acc;
    }, {});
    const normalizedProducts = [...new Set([
        ...products.map(canonicalizeProductName).filter(Boolean),
        ...normalizedSales.map(s => s.canonicalProduct).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b));

    const filteredSales = normalizedSales
        .map(sale => {
            const returnedQty = returnedQtyBySaleId[sale.id] || 0;
            const quantity = Number(sale.cantidad || 1);
            const effectiveQuantity = Math.max(0, quantity - returnedQty);
            const effectiveRatio = quantity > 0 ? effectiveQuantity / quantity : 0;
            return { ...sale, returnedQty, effectiveQuantity, effectiveRatio };
        })
        .filter(sale => {
            if (filterProduct !== 'todos' && sale.canonicalProduct !== filterProduct) return false;
            const saleDate = sale.fechaVenta || '';
            if (saleDate < dateFrom || saleDate > dateTo) return false;
            return true;
        });

    const totalFacturacion = filteredSales.reduce((sum, s) => sum + (s.totalVenta || 0) * s.effectiveRatio, 0);
    const totalComisiones = filteredSales.reduce((sum, s) => sum + (s.comisionML || 0) * s.effectiveRatio, 0);
    const totalEnvio = filteredSales.reduce((sum, s) => sum + (s.costoEnvio || 0) * s.effectiveRatio, 0);
    const totalUnidades = filteredSales.reduce((sum, s) => sum + (s.effectiveQuantity || 0), 0);
    const totalCosto = filteredSales.reduce((sum, s) => {
        const costoUnit = productCosts[s.canonicalProduct] || productCosts[s.product] || 0;
        return sum + (costoUnit * (s.effectiveQuantity || 0));
    }, 0);
    const totalCostosML = totalComisiones + totalEnvio;
    const gananciaBruta = totalFacturacion - totalCostosML - totalCosto;
    const rentabilidad = totalFacturacion > 0 ? ((gananciaBruta / totalFacturacion) * 100) : 0;

    const stockValorizado = mlStock.reduce((sum, item) => {
        const producto = normalizedProducts.find(p => {
            const normalizedP = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const normalizedT = (item.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return normalizedP.includes(normalizedT) || normalizedT.includes(normalizedP);
        });
        const costo = producto ? (productCosts[producto] || 0) : 0;
        return sum + (costo * (item.available_quantity || 0));
    }, 0);

    const salesByProduct = filteredSales.reduce((acc, sale) => {
        const key = sale.canonicalProduct;
        if (!acc[key]) {
            acc[key] = { unidades: 0, facturacion: 0, costo: 0, comision: 0, envio: 0 };
        }
        acc[key].unidades += sale.effectiveQuantity || 0;
        acc[key].facturacion += (sale.totalVenta || 0) * sale.effectiveRatio;
        acc[key].comision += (sale.comisionML || 0) * sale.effectiveRatio;
        acc[key].envio += (sale.costoEnvio || 0) * sale.effectiveRatio;
        acc[key].costo += (productCosts[sale.canonicalProduct] || productCosts[sale.product] || 0) * (sale.effectiveQuantity || 0);
        return acc;
    }, {});

    const topProductsByGain = Object.entries(salesByProduct)
        .map(([product, data]) => ({
            product,
            ...data,
            ganancia: data.facturacion - data.comision - data.envio - data.costo,
            rentabilidad: data.facturacion > 0 ? ((data.facturacion - data.comision - data.envio - data.costo) / data.facturacion * 100) : 0
        }))
        .filter(p => p.unidades > 0)
        .sort((a, b) => b.ganancia - a.ganancia);

    const hasCosts = Object.values(productCosts).some(c => c > 0);
    const hasSalesData = normalizedSales.some(s => s.totalVenta > 0);

    return (
        <section className="card glass report-card report-card-wide" style={{ marginTop: '20px' }}>
            <div className="report-card-head">
                <div>
                    <h3>💰 Informe Financiero</h3>
                    <p>Facturación, comisiones y rentabilidad de ventas ML</p>
                </div>
            </div>

            <div className="financial-filters">
                    <div className="filter-group">
                        <label>Producto</label>
                        <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
                            <option value="todos">Todos los productos</option>
                            {normalizedProducts.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                <div className="filter-group">
                    <label>Desde</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                    <label>Hasta</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
            </div>

            {!hasCosts && (
                <div className="no-costs-warning">
                    <span>⚠️ No tenés costos cargados. </span>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = '/costos'; }}>
                        Configurá los costos por producto
                    </a>
                    para ver la rentabilidad.
                </div>
            )}

            {!hasSalesData && (
                <div className="no-data-warning">
                    Las ventas importadas no tienen datos de precio. 
                    Sincronizá con ML para capturar precios y comisiones.
                </div>
            )}

            <div className="financial-summary">
                <div className="financial-metric">
                    <span className="financial-metric-label">Facturación</span>
                    <span className="financial-metric-value positive">{formatCurrency(totalFacturacion)}</span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Comisiones ML</span>
                    <span className="financial-metric-value negative">-{formatCurrency(totalComisiones)}</span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Costo Envío</span>
                    <span className="financial-metric-value negative">-{formatCurrency(totalEnvio)}</span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Costo Mercadería</span>
                    <span className="financial-metric-value negative">-{formatCurrency(totalCosto)}</span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Ganancia Bruta</span>
                    <span className={`financial-metric-value ${gananciaBruta >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(gananciaBruta)}
                    </span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Rentabilidad</span>
                    <span className={`financial-metric-value ${rentabilidad >= 0 ? 'positive' : 'negative'}`}>
                        {rentabilidad.toFixed(1)}%
                    </span>
                </div>
                <div className="financial-metric">
                    <span className="financial-metric-label">Unidades</span>
                    <span className="financial-metric-value neutral">{totalUnidades}</span>
                </div>
            </div>

            {hasCosts && topProductsByGain.length > 0 && (
                <div className="financial-detail">
                    <h4>Rentabilidad por Producto</h4>
                    <table className="financial-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Unidades</th>
                                <th>Facturación</th>
                                <th>Comisión</th>
                                <th>Envío</th>
                                <th>Costo</th>
                                <th>Ganancia</th>
                                <th>Margen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProductsByGain.map(row => (
                                <tr key={row.product}>
                                    <td className="product-name-cell">{row.product}</td>
                                    <td>{row.unidades}</td>
                                    <td>{formatCurrency(row.facturacion)}</td>
                                    <td className="negative">-{formatCurrency(row.comision)}</td>
                                    <td className="negative">-{formatCurrency(row.envio)}</td>
                                    <td className="negative">-{formatCurrency(row.costo)}</td>
                                    <td className={row.ganancia >= 0 ? 'positive' : 'negative'}>
                                        {formatCurrency(row.ganancia)}
                                    </td>
                                    <td className={row.rentabilidad >= 0 ? 'positive' : 'negative'}>
                                        {row.rentabilidad.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {mlStock.length > 0 && hasCosts && (
                <div className="stock-valorization">
                    <h4>📦 Valorización de Stock ML</h4>
                    <div className="stock-valor-metric">
                        <span>Stock total en ML:</span>
                        <strong>{formatCurrency(stockValorizado)}</strong>
                    </div>
                <div className="stock-detail">
                        {normalizedProducts.filter(p => productCosts[p] > 0).map(producto => {
                            const productoStock = mlStock.filter(item => {
                                const normalizedP = producto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                const normalizedT = (item.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                return normalizedP.includes(normalizedT) || normalizedT.includes(normalizedP);
                            });
                            const totalStock = productoStock.reduce((sum, item) => sum + (item.available_quantity || 0), 0);
                            const valorizado = totalStock * (productCosts[producto] || 0);
                            if (totalStock === 0) return null;
                            return (
                                <div key={producto} className="stock-product-row">
                                    <span>{producto}</span>
                                    <span>{totalStock} unidades</span>
                                    <strong>{formatCurrency(valorizado)}</strong>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                .financial-filters {
                    display: flex;
                    gap: 15px;
                    margin: 15px 0;
                    flex-wrap: wrap;
                }
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .filter-group label {
                    font-size: 12px;
                    color: #94a3b8;
                    text-transform: uppercase;
                }
                .filter-group select,
                .filter-group input {
                    padding: 8px 12px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 6px;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    font-size: 14px;
                }
                .filter-group select:focus,
                .filter-group input:focus {
                    outline: none;
                    border-color: #60a5fa;
                }
                .no-costs-warning, .no-data-warning {
                    padding: 12px 16px;
                    background: rgba(251, 191, 36, 0.15);
                    border: 1px solid #fbbf24;
                    border-radius: 8px;
                    margin: 15px 0;
                    font-size: 14px;
                }
                .no-data-warning {
                    background: rgba(148, 163, 184, 0.15);
                    border-color: #94a3b8;
                }
                .no-costs-warning a {
                    color: #60a5fa;
                    text-decoration: underline;
                }
                .financial-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .financial-metric {
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                .financial-metric-label {
                    display: block;
                    font-size: 11px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .financial-metric-value {
                    font-size: 18px;
                    font-weight: bold;
                }
                .financial-metric-value.positive { color: #34d399; }
                .financial-metric-value.negative { color: #fb7185; }
                .financial-metric-value.neutral { color: #e2e8f0; }
                .financial-detail {
                    margin-top: 20px;
                }
                .financial-detail h4 {
                    margin-bottom: 10px;
                    color: #e2e8f0;
                }
                .financial-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .financial-table th {
                    text-align: left;
                    padding: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8;
                    font-size: 11px;
                    text-transform: uppercase;
                }
                .financial-table td {
                    padding: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .financial-table .product-name-cell {
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .financial-table .positive { color: #34d399; }
                .financial-table .negative { color: #fb7185; }
                .stock-valorization {
                    margin-top: 25px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .stock-valorization h4 {
                    margin-bottom: 15px;
                    color: #e2e8f0;
                }
                .stock-valor-metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    background: rgba(96, 165, 250, 0.1);
                    border-radius: 8px;
                    margin-bottom: 15px;
                }
                .stock-valor-metric strong {
                    font-size: 20px;
                    color: #60a5fa;
                }
                .stock-detail {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .stock-product-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    padding: 10px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 6px;
                    font-size: 13px;
                }
                .stock-product-row span:first-child {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            `}</style>
        </section>
    );
}
