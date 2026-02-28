import React, { useState } from 'react';
import { normalizeProductName, PRODUCT_CATALOG } from '../utils/productMapping';

const MovementsHistory = ({ stockEntries, sales }) => {
    const [filterProduct, setFilterProduct] = useState('all');
    const [filterType, setFilterType] = useState('all'); // 'all', 'entrada', 'salida'

    // Build product list for filter dropdown (canonical names only)
    const allProductNames = new Set();
    PRODUCT_CATALOG.forEach(p => allProductNames.add(p.canonical));
    stockEntries.forEach(e => allProductNames.add(normalizeProductName(e.product)));
    sales.forEach(s => allProductNames.add(normalizeProductName(s.product)));
    const productList = [...allProductNames].sort();

    // Build all movements, normalize names and fix date field
    const allMovements = [
        ...stockEntries.map((entry, idx) => ({
            type: 'entrada',
            date: entry.fechaEnvio || entry.date,
            product: normalizeProductName(entry.product),
            rawProduct: entry.product,
            variants: entry.variants,
            id: entry.id,
            orderIndex: idx
        })),
        ...sales.map((sale, idx) => ({
            type: 'salida',
            date: sale.fechaVenta, // Fixed: was sale.fecha
            product: normalizeProductName(sale.product),
            rawProduct: sale.product,
            talle: sale.talle,
            color: sale.color,
            cantidad: sale.cantidad || 1,
            opNumber: sale.opNumber,
            source: sale.source || 'manual',
            id: sale.id || sale.opNumber,
            orderIndex: idx
        }))
    ];

    // Sort by date (newest first), then by orderIndex
    allMovements.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return a.orderIndex - b.orderIndex;
    });

    // Apply filters
    const filteredMovements = allMovements.filter(mov => {
        if (filterProduct !== 'all' && mov.product !== filterProduct) return false;
        if (filterType !== 'all' && mov.type !== filterType) return false;
        return true;
    });

    // Calculate summary stats for filtered view
    const totalEntradas = filteredMovements
        .filter(m => m.type === 'entrada')
        .reduce((sum, m) => sum + (m.variants ? m.variants.reduce((s, v) => s + Number(v.cantidad), 0) : 0), 0);

    const totalSalidas = filteredMovements
        .filter(m => m.type === 'salida')
        .reduce((sum, m) => sum + Number(m.cantidad || 1), 0);

    return (
        <div className="animate-fade-in">
            <h2>📋 Historial de Movimientos</h2>

            {/* Filters */}
            <div className="history-filters glass card">
                <div className="filters-row">
                    <div className="filter-group">
                        <label>Producto</label>
                        <select
                            value={filterProduct}
                            onChange={(e) => setFilterProduct(e.target.value)}
                        >
                            <option value="all">Todos los productos</option>
                            {productList.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Tipo</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="entrada">📥 Entradas</option>
                            <option value="salida">📤 Salidas</option>
                        </select>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="history-stats">
                    <span className="stat-chip entrada">📥 Entradas: {totalEntradas}</span>
                    <span className="stat-chip salida">📤 Salidas: {totalSalidas}</span>
                    <span className="stat-chip total">Movimientos: {filteredMovements.length}</span>
                </div>
            </div>

            {/* Movements list */}
            {filteredMovements.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                    No hay movimientos que coincidan con los filtros.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredMovements.map((mov, index) => (
                        <div
                            key={mov.id || index}
                            className="card glass movement-card"
                            style={{
                                borderLeft: `4px solid ${mov.type === 'entrada' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                            }}
                        >
                            <div className="movement-header">
                                <div className="movement-header-left">
                                    <span
                                        className="badge"
                                        style={{
                                            backgroundColor: mov.type === 'entrada' ? 'var(--accent-green)' : 'var(--accent-red)',
                                            color: 'white'
                                        }}
                                    >
                                        {mov.type === 'entrada' ? '📥 ENTRADA' : '📤 SALIDA'}
                                    </span>
                                    {mov.source === 'mercadolibre' && (
                                        <span className="badge" style={{ backgroundColor: '#FFE600', color: '#333' }}>
                                            ML
                                        </span>
                                    )}
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    {mov.date || 'Sin fecha'}
                                </span>
                            </div>

                            <h3 style={{ margin: '0.5rem 0', fontSize: '1rem' }}>{mov.product}</h3>

                            {mov.type === 'entrada' ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {mov.variants.map((v, idx) => (
                                        <li key={idx} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '0.25rem 0',
                                            borderBottom: idx < mov.variants.length - 1 ? '1px solid var(--border-color)' : 'none'
                                        }}>
                                            <span>{v.talle} - {v.color}</span>
                                            <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>+{v.cantidad}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div>
                                    <p style={{ margin: '0.25rem 0' }}>
                                        <strong>{mov.talle}</strong> - {mov.color}
                                        <span style={{ fontWeight: '700', color: 'var(--accent-red)', marginLeft: '1rem' }}>
                                            -{mov.cantidad}
                                        </span>
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0' }}>
                                        Op: {mov.opNumber}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MovementsHistory;
