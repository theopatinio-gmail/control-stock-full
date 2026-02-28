import React from 'react';
import { PRODUCT_CATALOG } from '../utils/productMapping';
import { stockToMap } from '../utils/stockLogic';

const Dashboard = ({ stock }) => {
    // stock viene de calculateStock (fuente única de verdad)
    const stockMap = stockToMap(stock);

    // Build per-product cards using catalog
    const productCards = PRODUCT_CATALOG.map(catalogEntry => {
        const name = catalogEntry.canonical;
        const colors = catalogEntry.colors;
        const sizes = catalogEntry.sizes;

        const matrix = {};
        let totalGeneral = 0;
        const totalByColor = {};
        const totalBySize = {};

        colors.forEach(c => { totalByColor[c] = 0; });
        sizes.forEach(s => { totalBySize[s] = 0; });

        sizes.forEach(size => {
            matrix[size] = {};
            colors.forEach(color => {
                const key = `${name}|${size}|${color}`;
                const qty = stockMap[key] || 0;
                matrix[size][color] = qty;
                totalByColor[color] += qty;
                totalBySize[size] += qty;
                totalGeneral += qty;
            });
        });

        return { name, colors, sizes, matrix, totalByColor, totalBySize, totalGeneral };
    });

    // Find uncataloged items
    const catalogNames = new Set(PRODUCT_CATALOG.map(p => p.canonical));
    const uncatalogedMap = {};
    Object.entries(stockMap).forEach(([key, qty]) => {
        const [product, talle, color] = key.split('|');
        if (!catalogNames.has(product) && qty !== 0) {
            if (!uncatalogedMap[product]) uncatalogedMap[product] = [];
            uncatalogedMap[product].push({ talle, color, qty });
        }
    });

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header">
                <h2>📦 Stock Actual</h2>
            </div>

            {/* Summary bar */}
            <div className="stock-summary-bar">
                {productCards.map(pc => (
                    <div key={pc.name} className="stock-summary-chip">
                        <span className="chip-name">{pc.name}</span>
                        <span className={`chip-total ${pc.totalGeneral > 0 ? 'positive' : 'zero'}`}>
                            {pc.totalGeneral}
                        </span>
                    </div>
                ))}
            </div>

            {/* Product cards with matrix */}
            <div className="product-cards-list">
                {productCards.map(pc => (
                    <div key={pc.name} className="card glass product-stock-card">
                        <div className="product-card-header">
                            <h3>{pc.name}</h3>
                            <div className="header-right">
                                <span className={`total-badge ${pc.totalGeneral > 0 ? 'positive' : 'zero'}`}>
                                    Total: {pc.totalGeneral}
                                </span>
                            </div>
                        </div>

                        <div className="stock-matrix-wrapper">
                            <table className="stock-matrix">
                                <thead>
                                    <tr>
                                        <th className="matrix-corner">Talle</th>
                                        {pc.colors.map(color => (
                                            <th key={color} className="matrix-color-header">{color}</th>
                                        ))}
                                        <th className="matrix-total-header">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pc.sizes.map(size => (
                                        <tr key={size}>
                                            <td className="matrix-size-label">{size}</td>
                                            {pc.colors.map(color => {
                                                const qty = pc.matrix[size][color];
                                                return (
                                                    <td
                                                        key={color}
                                                        className={`matrix-cell ${qty > 0 ? 'has-stock' : qty < 0 ? 'negative-stock' : 'no-stock'}`}
                                                    >
                                                        {qty}
                                                    </td>
                                                );
                                            })}
                                            <td className={`matrix-cell matrix-row-total ${pc.totalBySize[size] > 0 ? 'has-stock' : 'no-stock'}`}>
                                                {pc.totalBySize[size]}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="matrix-totals-row">
                                        <td className="matrix-size-label">TOTAL</td>
                                        {pc.colors.map(color => (
                                            <td
                                                key={color}
                                                className={`matrix-cell matrix-col-total ${pc.totalByColor[color] > 0 ? 'has-stock' : 'no-stock'}`}
                                            >
                                                {pc.totalByColor[color]}
                                            </td>
                                        ))}
                                        <td className={`matrix-cell matrix-grand-total ${pc.totalGeneral > 0 ? 'has-stock' : 'no-stock'}`}>
                                            {pc.totalGeneral}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* Uncataloged products */}
            {Object.keys(uncatalogedMap).length > 0 && (
                <div className="uncataloged-section">
                    <h3 style={{ color: 'var(--text-muted)', marginTop: '2rem' }}>
                        Otros productos
                    </h3>
                    <div className="grid">
                        {Object.entries(uncatalogedMap).map(([name, items]) => (
                            <div key={name} className="card glass" style={{ opacity: 0.7 }}>
                                <h4 style={{ fontSize: '0.95rem' }}>{name}</h4>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                                    {items.map((item, idx) => (
                                        <li key={idx} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '0.2rem 0',
                                            fontSize: '0.85rem'
                                        }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {item.talle} - {item.color}
                                            </span>
                                            <span style={{
                                                fontWeight: 700,
                                                color: item.qty > 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                                            }}>
                                                {item.qty}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
