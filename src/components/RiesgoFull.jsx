import React, { useMemo, useState } from 'react';
import { normalizeProductName } from '../utils/productMapping';

const DAY_MS = 24 * 60 * 60 * 1000;
const FROZEN_THRESHOLD = 30;
const DANGER_THRESHOLD = 25;
const WARNING_THRESHOLD = 15;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from, to) {
    if (!from || !to) return null;
    return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function addDays(date, n) {
    if (!date) return null;
    return new Date(date.getTime() + n * DAY_MS);
}

function formatDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMoney(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    }).format(value);
}

function riskLevel(days) {
    if (days == null) return 'unknown';
    if (days >= FROZEN_THRESHOLD) return 'frozen';
    if (days >= DANGER_THRESHOLD) return 'danger';
    if (days >= WARNING_THRESHOLD) return 'warning';
    return 'ok';
}

function riskLabel(level) {
    switch (level) {
        case 'frozen':  return 'Congelada';
        case 'danger':  return 'Crítica';
        case 'warning': return 'Alerta';
        case 'ok':      return 'Reciente';
        default:        return 'Sin datos';
    }
}

function normalizeVariantKey(product, talle, color) {
    const p = normalizeProductName(product || '') || '';
    const t = String(talle || '').trim();
    const c = String(color || '').trim();
    return `${p}|||${t}|||${c}`;
}

// Nombres cortos para mostrar en la tabla (fácil lectura)
const SHORT_NAMES = {
    'Pantalón Palazzo De Jean Mujer Tiro Alto Ancho':           'Palazzo Tiro Alto',
    'Pantalón Palazzo Jean Mujer Cintura Elastizada Frika':     'Palazzo Elastizado',
    'Bermuda Mujer Gabardina Cintura Elastizada Mod. Lirio Frika': 'Bermuda Lirio',
    'Conjunto Morley Mujer Pantalon Recto Remera Oversize Frika':  'Conjunto Morley',
    'Jean Oxford Mujer Tiro Alto Elastizado Pantalón Frika':    'Jean Oxford',
};

function shortProductName(canonicalName) {
    return SHORT_NAMES[canonicalName] || canonicalName;
}

// ──────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────
const RiesgoFull = ({
    manualMovements = [],
    sales = [],
    mlStock = [],
    mlStockFetchedAt = null,
    productCosts = {},
    onStockRefreshed
}) => {
    const [refreshing, setRefreshing]       = useState(false);
    const [refreshError, setRefreshError]   = useState(null);
    const [filterZeroOnly, setFilterZeroOnly] = useState(true);
    const [sortKey, setSortKey]             = useState('risk');

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const mlStockAvailable = mlStock.length > 0;

    // ──────────────────────────────────────────────────────────
    // Construye el dataset por variante
    // Solo a partir de mlStock: son las únicas variantes que
    // realmente están en Full. Los movimientos se usan solo
    // para enriquecer con fechas y datos financieros.
    // ──────────────────────────────────────────────────────────
    const rows = useMemo(() => {
        // Sin datos de ML no podemos saber qué variantes son Full
        if (mlStock.length === 0) return [];

        // 1) Construir mapa de variantes desde mlStock (fuente de verdad)
        const variants = new Map();
        mlStock.forEach(s => {
            const key = normalizeVariantKey(s.title, s.talle, s.color);
            if (!variants.has(key)) {
                variants.set(key, {
                    key,
                    product:         normalizeProductName(s.title || '') || s.title || '',
                    talle:           String(s.talle || '—').trim(),
                    color:           String(s.color || '—').trim(),
                    mlLiveStock:     Number(s.available_quantity ?? 0),
                    stockManual:     0,
                    firstIngreso:    null,
                    lastSale:        null,
                    totalSalesUnits: 0,
                    revenue:         0,
                    active:          s.active !== false,
                });
            }
        });

        // 2) Movimientos manuales → enriquecer solo variantes Full conocidas
        manualMovements.forEach(m => {
            const key = normalizeVariantKey(m.product, m.talle, m.color);
            if (!variants.has(key)) return; // no es una variante Full, ignorar
            const r   = variants.get(key);
            const qty = Number(m.quantity || 1);
            const d   = parseDate(m.date);
            if (m.type === 'ingreso') {
                r.stockManual += qty;
                if (!r.firstIngreso || (d && d < r.firstIngreso)) r.firstIngreso = d;
            } else if (m.type === 'devolucion') {
                r.stockManual += qty;
            } else if (m.type === 'egreso') {
                r.stockManual -= qty;
                r.totalSalesUnits += qty;
                if (d && (!r.lastSale || d > r.lastSale)) r.lastSale = d;
            }
        });

        // 3) Ventas ML → ingresos + lastSale de respaldo (solo variantes Full)
        sales.forEach(s => {
            const key = normalizeVariantKey(s.product, s.talle, s.color);
            if (!variants.has(key)) return;
            const r = variants.get(key);
            r.revenue += Number(s.totalVenta || 0);
            const d = parseDate(s.fechaVenta);
            if (d && (!r.lastSale || d > r.lastSale)) r.lastSale = d;
        });

        // 4) Derivados
        const out = [];
        variants.forEach(r => {
            // Stock: siempre el dato en vivo de ML (ya que lo tenemos)
            const effectiveStock = r.mlLiveStock;

            // Fecha de referencia para el contador de ML:
            //   - Si se vendió alguna vez → última venta
            //   - Si nunca se vendió      → primer ingreso a Full
            // (ML empieza a contar desde que llega al depósito si nunca se vendió)
            const referenceDate  = r.lastSale || r.firstIngreso;
            const daysSince      = referenceDate ? daysBetween(referenceDate, today) : null;
            const daysLeft       = daysSince != null ? Math.max(0, FROZEN_THRESHOLD - daysSince) : null;
            const freezeDate     = referenceDate ? addDays(referenceDate, FROZEN_THRESHOLD) : null;

            const level          = riskLevel(daysSince);
            const usedReference  = r.lastSale ? 'última venta' : (r.firstIngreso ? 'ingreso a Full' : null);

            out.push({
                ...r,
                effectiveStock,
                referenceDate,
                usedReference,
                daysSince,
                daysLeft,
                freezeDate,
                level,
            });
        });

        return out;
    }, [manualMovements, sales, mlStock, today]);

    // ──────────────────────────────────────────────────────────
    // Filtrado + orden
    // ──────────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        let res = rows.filter(r => r.active);
        if (filterZeroOnly) res = res.filter(r => r.effectiveStock <= 0);

        const levelRank = { frozen: 0, danger: 1, warning: 2, ok: 3, unknown: 4 };
        res.sort((a, b) => {
            switch (sortKey) {
                case 'days':
                    return (b.daysSince ?? -1) - (a.daysSince ?? -1);
                case 'revenue':
                    return b.revenue - a.revenue;
                case 'risk':
                default: {
                    const diff = levelRank[a.level] - levelRank[b.level];
                    if (diff !== 0) return diff;
                    return (b.daysSince ?? -1) - (a.daysSince ?? -1);
                }
            }
        });
        return res;
    }, [rows, filterZeroOnly, sortKey]);

    // Resumen — solo variantes con stock = 0
    const summary = useMemo(() => {
        const atRisk = rows.filter(r => r.active && r.effectiveStock <= 0);
        const byLevel = { frozen: 0, danger: 0, warning: 0, ok: 0, unknown: 0 };
        atRisk.forEach(r => { byLevel[r.level] += 1; });
        return { totalAtRisk: atRisk.length, byLevel };
    }, [rows]);

    // ──────────────────────────────────────────────────────────
    // Acciones
    // ──────────────────────────────────────────────────────────
    async function handleRefreshStock() {
        setRefreshing(true);
        setRefreshError(null);
        try {
            const res = await fetch('/api/ml/stock');
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`HTTP ${res.status}: ${txt}`);
            }
            await res.json();
            if (typeof onStockRefreshed === 'function') onStockRefreshed();
        } catch (e) {
            console.error('Error refrescando stock ML:', e);
            setRefreshError(e.message || 'No se pudo refrescar el stock');
        } finally {
            setRefreshing(false);
        }
    }

    // ──────────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────────
    const fetchedLabel = mlStockFetchedAt
        ? new Date(mlStockFetchedAt).toLocaleString('es-AR')
        : 'Nunca';

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header">
                <div className="header-titles">
                    <h2>⏳ Riesgo Full — Variantes sin stock en peligro de congelarse</h2>
                    <p className="subtitle">
                        Cuando una variante llega a <strong>stock 0</strong>, no puede venderse.
                        Si pasan <strong>30 días sin una venta</strong>, ML bloquea el envío de
                        más stock → círculo vicioso. Esta vista te muestra cuánto tiempo te queda
                        para reaccionar antes de que se congele.
                    </p>
                </div>
                <div className="dashboard-controls">
                    <button
                        className="primary"
                        onClick={handleRefreshStock}
                        disabled={refreshing}
                        title="Consulta la API de ML y trae el stock actual por variante"
                    >
                        {refreshing ? 'Consultando ML…' : '🔄 Actualizar stock desde ML'}
                    </button>
                </div>
            </div>

            <div className="riesgo-meta">
                <span>
                    <strong>Stock ML actualizado al:</strong> {fetchedLabel}
                </span>
                <span>
                    <strong>Fuente de stock:</strong>{' '}
                    {mlStockAvailable ? '✅ API de ML (en vivo)' : '⚠ Movimientos manuales (estimado)'}
                </span>
                <span>
                    <strong>Variantes en riesgo (stock 0):</strong> {summary.totalAtRisk}
                </span>
                {refreshError && (
                    <span className="riesgo-error">⚠ {refreshError}</span>
                )}
            </div>

            <div className="riesgo-summary-chips">
                <SummaryChip level="frozen"  count={summary.byLevel.frozen}  label="Congeladas (≥ 30 días)" />
                <SummaryChip level="danger"  count={summary.byLevel.danger}  label="Críticas (25–29 días)"  />
                <SummaryChip level="warning" count={summary.byLevel.warning} label="Alerta (15–24 días)"    />
                <SummaryChip level="ok"      count={summary.byLevel.ok}      label="Recientes (< 15 días)"  />
                {summary.byLevel.unknown > 0 && (
                    <SummaryChip level="unknown" count={summary.byLevel.unknown} label="Sin referencia" />
                )}
            </div>

            <div className="riesgo-filters">
                <label>
                    <input
                        type="checkbox"
                        checked={filterZeroOnly}
                        onChange={e => setFilterZeroOnly(e.target.checked)}
                    />
                    Solo variantes con stock 0 (las que están en riesgo real)
                </label>
                <label className="riesgo-sort-label">
                    Ordenar por:
                    <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
                        <option value="risk">Urgencia</option>
                        <option value="days">Días sin vender</option>
                        <option value="revenue">Ingresos acumulados</option>
                    </select>
                </label>
            </div>

            {!mlStockAvailable && (
                <div className="riesgo-empty-state">
                    <p>
                        <strong>Necesitás traer el stock desde ML primero.</strong>
                    </p>
                    <p className="riesgo-empty-note">
                        Esta pestaña solo muestra variantes que están realmente en Full.
                        Apretá <strong>"Actualizar stock desde ML"</strong> arriba para traer
                        los datos y ver qué variantes están en riesgo.
                    </p>
                </div>
            )}

            {filteredRows.length === 0 ? (
                <div className="riesgo-empty-state">
                    <p>
                        {filterZeroOnly
                            ? '¡Bien! Todas las variantes activas tienen stock. No hay riesgo de congelamiento por ahora.'
                            : 'No hay variantes que coincidan con los filtros activos.'}
                    </p>
                </div>
            ) : (
                <div className="riesgo-table-wrap">
                    <table className="riesgo-table">
                        <thead>
                            <tr>
                                <th>Estado</th>
                                <th>Producto</th>
                                <th>Talle</th>
                                <th>Color</th>
                                <th className="num">Stock Full</th>
                                <th>Última venta</th>
                                <th className="num">Días sin vender</th>
                                <th className="num">Días restantes</th>
                                <th>Fecha límite</th>
                                <th className="num">Unid. vendidas</th>
                                <th className="num">Ingresos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(r => (
                                <tr key={r.key} className={`riesgo-row riesgo-level-${r.level}`}>
                                    <td>
                                        <span className={`riesgo-badge riesgo-badge-${r.level}`}>
                                            {riskLabel(r.level)}
                                        </span>
                                    </td>
                                    <td className="riesgo-product" title={r.product}>
                                        <span className="riesgo-short-name">{shortProductName(r.product)}</span>
                                        {shortProductName(r.product) !== r.product && (
                                            <div className="riesgo-sub riesgo-full-name">{r.product}</div>
                                        )}
                                    </td>
                                    <td>{r.talle}</td>
                                    <td>{r.color}</td>
                                    <td className="num">
                                        <strong className="riesgo-zero-stock">
                                            {r.effectiveStock}
                                        </strong>
                                        {!mlStockAvailable && (
                                            <div className="riesgo-sub">estimado</div>
                                        )}
                                    </td>
                                    <td>
                                        {r.lastSale
                                            ? formatDate(r.lastSale)
                                            : <em className="riesgo-never">nunca vendida</em>
                                        }
                                        {!r.lastSale && r.firstIngreso && (
                                            <div className="riesgo-sub">
                                                Ingresó: {formatDate(r.firstIngreso)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="num">
                                        {r.daysSince == null
                                            ? '—'
                                            : <strong>{r.daysSince}</strong>
                                        }
                                        {r.usedReference === 'ingreso a Full' && (
                                            <div className="riesgo-sub">desde ingreso</div>
                                        )}
                                    </td>
                                    <td className="num">
                                        {r.level === 'frozen'
                                            ? <span className="riesgo-badge riesgo-badge-frozen">Ya congelada</span>
                                            : r.daysLeft == null
                                                ? '—'
                                                : <strong className={r.daysLeft <= 5 ? 'riesgo-urgent' : ''}>
                                                    {r.daysLeft} días
                                                  </strong>
                                        }
                                    </td>
                                    <td>
                                        {r.level === 'frozen'
                                            ? <span className="riesgo-muted">vencida</span>
                                            : r.freezeDate
                                                ? <span className={r.daysLeft != null && r.daysLeft <= 5 ? 'riesgo-urgent' : ''}>
                                                    {formatDate(r.freezeDate)}
                                                  </span>
                                                : '—'
                                        }
                                    </td>
                                    <td className="num">
                                        {r.totalSalesUnits > 0
                                            ? r.totalSalesUnits
                                            : <span className="riesgo-muted">0</span>
                                        }
                                    </td>
                                    <td className="num">
                                        {r.revenue > 0 ? formatMoney(r.revenue) : <span className="riesgo-muted">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="riesgo-legend">
                <p><strong>Cómo leer esta tabla:</strong></p>
                <ul>
                    <li>
                        <strong>¿Por qué solo stock = 0?</strong> Si una variante tiene aunque sea 1
                        unidad, eventualmente se vende sola y resetea el contador de ML. El problema
                        real es cuando llegás a 0: sin stock no hay ventas, y sin ventas no podés
                        reponer.
                    </li>
                    <li>
                        <strong>Días sin vender</strong>: el contador que ML usa internamente.
                        Arranca desde la última venta, o desde que ingresó a Full si nunca se vendió.
                    </li>
                    <li>
                        <strong>Días restantes</strong>: cuánto tiempo tenés para enviar stock antes
                        de que ML bloquee esa variante.
                    </li>
                    <li>
                        <strong>Fecha límite</strong>: si no hay una venta antes de esa fecha, la
                        variante queda congelada.
                    </li>
                    <li>
                        <strong>Congelada</strong>: ya pasaron 30 días. Para desbloquear, necesitás
                        contactar soporte de ML — no hay solución automática.
                    </li>
                    <li>
                        <strong>¿No ves nada?</strong> Esta pestaña requiere datos en vivo de ML.
                        Apretá "Actualizar stock desde ML" para cargarlos. Sin ese paso no es
                        posible saber qué variantes son realmente Full.
                    </li>
                </ul>
            </div>
        </div>
    );
};

function SummaryChip({ level, count, label }) {
    return (
        <div className={`riesgo-chip riesgo-chip-${level}`}>
            <span className="riesgo-chip-count">{count}</span>
            <span className="riesgo-chip-label">{label}</span>
        </div>
    );
}

export default RiesgoFull;
