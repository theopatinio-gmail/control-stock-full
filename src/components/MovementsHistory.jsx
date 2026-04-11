import React, { useMemo, useState } from 'react';
import { getProductCatalogEntry } from '../utils/productMapping';

const MovementsHistory = ({
    sales = [],
    manualMovements = [],
    products = [],
    onConvertSaleToManualMovement,
    onRegisterSaleReturn
}) => {
    const [view, setView] = useState('ml');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductBySale, setSelectedProductBySale] = useState({});
    const [selectedColorBySale, setSelectedColorBySale] = useState({});
    const convertedSaleIds = new Set(manualMovements.map(m => m.originSaleId).filter(Boolean));
    const returnedQtyBySaleId = useMemo(() => {
        return manualMovements.reduce((acc, movement) => {
            if (movement?.type !== 'devolucion' || !movement.originSaleId) return acc;
            acc[movement.originSaleId] = (acc[movement.originSaleId] || 0) + Number(movement.quantity || 1);
            return acc;
        }, {});
    }, [manualMovements]);

    const filteredMLSales = sales
        .filter(s => s.product.toLowerCase().includes(searchTerm.toLowerCase()) || (s.opNumber && s.opNumber.toString().includes(searchTerm)))
        .sort((a, b) => new Date(b.fechaVenta) - new Date(a.fechaVenta));

    const filteredManual = manualMovements
        .filter(m => m.product.toLowerCase().includes(searchTerm.toLowerCase()) || (m.opNumber && m.opNumber.toString().includes(searchTerm)))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const productOptions = useMemo(() => [...new Set(products.filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);

    const getColorOptions = (productName) => {
        const entry = getProductCatalogEntry(productName);
        return entry?.colors || [];
    };

    const needsColorReview = (sale, productName) => {
        if (sale.color !== 'Unico') return false;
        return getColorOptions(productName).length > 1;
    };

    const isSalePendingReview = (sale) => {
        if (sale.productNeedsReview) return true;
        if (!productOptions.includes(sale.product)) return true;
        return needsColorReview(sale, sale.product);
    };

    const handleResolveSale = (sale) => {
        const resolvedProduct = selectedProductBySale[sale.id];
        const selectedColor = selectedColorBySale[sale.id];
        if (!resolvedProduct) {
            alert('Elegí a qué artículo corresponde esta venta antes de pasarla a egreso.');
            return;
        }
        if (needsColorReview(sale, resolvedProduct) && !selectedColor) {
            alert('Elegí el color correcto antes de pasar esta venta a egreso.');
            return;
        }
        onConvertSaleToManualMovement?.(sale, resolvedProduct, selectedColor || sale.color);
    };

    const handleReturnSale = (sale, availableQuantity) => {
        if (!sale) return;
        onRegisterSaleReturn?.(sale, availableQuantity);
    };

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header">
                <div className="header-titles">
                    <h2>📋 Historial de Movimientos</h2>
                    <p className="subtitle">Detalle individual de ventas ML y movimientos manuales</p>
                </div>
                <div className="dashboard-controls" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <div className="mode-toggle">
                        <button
                            className={`toggle-btn ${view === 'ml' ? 'active' : ''}`}
                            onClick={() => setView('ml')}
                        >
                            🛍️ Ventas ML
                        </button>
                        <button
                            className={`toggle-btn ${view === 'manual' ? 'active' : ''}`}
                            onClick={() => setView('manual')}
                        >
                            ✍️ Manual
                        </button>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                <input
                    type="text"
                    placeholder="Buscar por artículo o nro de operación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', marginBottom: 0 }}
                />
            </div>

            <div className="card glass table-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="stock-matrix">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '1rem' }}>Fecha</th>
                            <th style={{ textAlign: 'left' }}>Artículo</th>
                            <th style={{ textAlign: 'center' }}>Talle</th>
                            <th style={{ textAlign: 'center' }}>Color</th>
                            <th style={{ textAlign: 'center' }}>Cant.</th>
                            {view === 'ml' ? (
                                <th style={{ textAlign: 'left' }}>Operación / ID</th>
                            ) : (
                                <th style={{ textAlign: 'left' }}>Tipo</th>
                            )}
                            {view === 'ml' && <th style={{ textAlign: 'center' }}>Acción</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {view === 'ml' ? (
                            filteredMLSales.length > 0 ? (
                                filteredMLSales.map(sale => {
                                    const needsReview = isSalePendingReview(sale);
                                    const selectedProduct = selectedProductBySale[sale.id] || '';
                                    const selectedColor = selectedColorBySale[sale.id] || '';
                                    const colorOptions = needsReview ? getColorOptions(selectedProduct || sale.product) : [];
                                    const showColorSelector = needsReview && colorOptions.length > 1 && sale.color === 'Unico';
                                    const returnedQty = returnedQtyBySaleId[sale.id] || 0;
                                    const saleQty = Number(sale.cantidad || 1);
                                    const availableReturnQty = Math.max(0, saleQty - returnedQty);
                                    const hasReturn = returnedQty > 0;

                                    return (
                                        <tr key={sale.id}>
                                            <td style={{ padding: '0.8rem 1rem' }}>{sale.fechaVenta}</td>
                                            <td style={{ fontWeight: '500' }}>
                                                {sale.product}
                                                {needsReview && (
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            marginLeft: '0.5rem',
                                                            fontSize: '0.72rem',
                                                            padding: '0.18rem 0.5rem',
                                                            borderRadius: 999,
                                                            background: 'rgba(239,68,68,0.12)',
                                                            color: '#f87171',
                                                            border: '1px solid rgba(239,68,68,0.25)',
                                                            verticalAlign: 'middle'
                                                        }}
                                                    >
                                                        Revisar
                                                    </span>
                                                )}
                                                {sale.productRawName && sale.productRawName !== sale.product && (
                                                    <div style={{ fontSize: '0.72rem', opacity: 0.65, marginTop: '0.2rem' }}>
                                                        {sale.productRawName}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{sale.talle}</td>
                                            <td style={{ textAlign: 'center' }}>{sale.color}</td>
                                            <td style={{ textAlign: 'center' }}>{sale.cantidad || 1}</td>
                                            <td style={{ fontSize: '0.8rem', opacity: 0.8 }}>#{sale.opNumber}</td>
                                            <td style={{ textAlign: 'center', padding: '0.8rem 1rem' }}>
                                                {needsReview ? (
                                                    <div style={{ display: 'grid', gap: '0.45rem', minWidth: 220 }}>
                                                        <select
                                                            value={selectedProduct}
                                                            onChange={(e) => {
                                                                setSelectedProductBySale(prev => ({
                                                                    ...prev,
                                                                    [sale.id]: e.target.value
                                                                }));
                                                                setSelectedColorBySale(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[sale.id];
                                                                    return next;
                                                                });
                                                            }}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <option value="">Elegir artículo...</option>
                                                            {productOptions.map(product => (
                                                                <option key={product} value={product}>{product}</option>
                                                            ))}
                                                        </select>

                                                        {showColorSelector && (
                                                            <select
                                                                value={selectedColor}
                                                                onChange={(e) => setSelectedColorBySale(prev => ({
                                                                    ...prev,
                                                                    [sale.id]: e.target.value
                                                                }))}
                                                                style={{ marginBottom: 0 }}
                                                            >
                                                                <option value="">Elegir color...</option>
                                                                {colorOptions.map(color => (
                                                                    <option key={color} value={color}>{color}</option>
                                                                ))}
                                                            </select>
                                                        )}

                                                        <button
                                                            type="button"
                                                            disabled={convertedSaleIds.has(sale.id) || !selectedProduct || (showColorSelector && !selectedColor)}
                                                            onClick={() => handleResolveSale(sale)}
                                                            style={{
                                                                padding: '0.45rem 0.75rem',
                                                                borderRadius: 8,
                                                                border: '1px solid rgba(139,92,246,0.35)',
                                                                background: convertedSaleIds.has(sale.id) ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.12)',
                                                                color: 'var(--text)',
                                                                cursor: convertedSaleIds.has(sale.id) || !selectedProduct || (showColorSelector && !selectedColor) ? 'not-allowed' : 'pointer',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 700,
                                                                opacity: convertedSaleIds.has(sale.id) || !selectedProduct || (showColorSelector && !selectedColor) ? 0.55 : 1
                                                            }}
                                                        >
                                                            {convertedSaleIds.has(sale.id) ? 'Ya cargado' : 'Resolver y pasar'}
                                                        </button>

                                                        {convertedSaleIds.has(sale.id) && (
                                                            <button
                                                                type="button"
                                                                disabled={availableReturnQty <= 0}
                                                                onClick={() => handleReturnSale(sale, availableReturnQty)}
                                                                style={{
                                                                    padding: '0.45rem 0.75rem',
                                                                    borderRadius: 8,
                                                                    border: '1px solid rgba(245,158,11,0.35)',
                                                                    background: availableReturnQty <= 0 ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.12)',
                                                                    color: 'var(--text)',
                                                                    cursor: availableReturnQty <= 0 ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    opacity: availableReturnQty <= 0 ? 0.6 : 1
                                                                }}
                                                            >
                                                                {availableReturnQty <= 0 ? 'Devuelta' : 'Devolución'}
                                                            </button>
                                                        )}

                                                        {hasReturn && (
                                                            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                                                                Devueltas {returnedQty}/{saleQty}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gap: '0.4rem', minWidth: 170 }}>
                                                        <button
                                                            type="button"
                                                            disabled={convertedSaleIds.has(sale.id)}
                                                            onClick={() => onConvertSaleToManualMovement?.(sale, sale.product, sale.color)}
                                                            style={{
                                                                padding: '0.45rem 0.75rem',
                                                                borderRadius: 8,
                                                                border: '1px solid rgba(139,92,246,0.35)',
                                                                background: convertedSaleIds.has(sale.id) ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.12)',
                                                                color: 'var(--text)',
                                                                cursor: convertedSaleIds.has(sale.id) ? 'not-allowed' : 'pointer',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 700,
                                                                opacity: convertedSaleIds.has(sale.id) ? 0.6 : 1
                                                            }}
                                                        >
                                                            {convertedSaleIds.has(sale.id) ? 'Ya cargado' : 'Pasar a egreso'}
                                                        </button>

                                                        {convertedSaleIds.has(sale.id) && (
                                                            <button
                                                                type="button"
                                                                disabled={availableReturnQty <= 0}
                                                                onClick={() => handleReturnSale(sale, availableReturnQty)}
                                                                style={{
                                                                    padding: '0.45rem 0.75rem',
                                                                    borderRadius: 8,
                                                                    border: '1px solid rgba(245,158,11,0.35)',
                                                                    background: availableReturnQty <= 0 ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.12)',
                                                                    color: 'var(--text)',
                                                                    cursor: availableReturnQty <= 0 ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    opacity: availableReturnQty <= 0 ? 0.6 : 1
                                                                }}
                                                            >
                                                                {availableReturnQty <= 0 ? 'Devuelta' : 'Devolución'}
                                                            </button>
                                                        )}

                                                        {hasReturn && (
                                                            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                                                                Devueltas {returnedQty}/{saleQty}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay ventas ML registradas.</td></tr>
                            )
                        ) : (
                            filteredManual.length > 0 ? (
                                filteredManual.map(mov => (
                                    <tr key={mov.id}>
                                        <td style={{ padding: '0.8rem 1rem' }}>{mov.date}</td>
                                        <td style={{ fontWeight: '500' }}>{mov.product}</td>
                                        <td style={{ textAlign: 'center' }}>{mov.talle}</td>
                                        <td style={{ textAlign: 'center' }}>{mov.color}</td>
                                        <td style={{ textAlign: 'center' }}>{mov.quantity || 1}</td>
                                            <td style={{ textAlign: 'left' }}>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: 4,
                                                        background: mov.type === 'ingreso'
                                                            ? 'rgba(34,197,94,0.1)'
                                                            : mov.type === 'devolucion'
                                                                ? 'rgba(245,158,11,0.12)'
                                                                : 'rgba(239,68,68,0.1)',
                                                        color: mov.type === 'ingreso'
                                                            ? '#4ade80'
                                                            : mov.type === 'devolucion'
                                                                ? '#fbbf24'
                                                                : '#f87171',
                                                        border: `1px solid ${mov.type === 'ingreso'
                                                            ? 'rgba(34,197,94,0.3)'
                                                            : mov.type === 'devolucion'
                                                                ? 'rgba(245,158,11,0.35)'
                                                                : 'rgba(239,68,68,0.3)'}`,
                                                        textTransform: 'uppercase',
                                                        fontWeight: '800'
                                                    }}
                                                >
                                                    {mov.type === 'devolucion' ? 'devolución' : mov.type}
                                                </span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>#{mov.opNumber}</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay movimientos manuales registrados.</td></tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MovementsHistory;
