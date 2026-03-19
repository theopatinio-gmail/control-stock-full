import React, { useState } from 'react';
import { SIZE_ORDER, sortBySizeOrder } from '../utils/productMapping';
import { stockToMap } from '../utils/stockLogic';

const Dashboard = ({ stock }) => {
    const stockMap = stockToMap(stock);
    const [expandedProduct, setExpandedProduct] = useState(null);

    // ── Dynamically build product cards from actual stock data ──
    // No hardcoded catalog needed — products, colors, and sizes
    // are detected automatically from whatever data exists.

    const productData = {};

    Object.entries(stockMap).forEach(([key, qty]) => {
        const [product, talle, color] = key.split('|');
        if (!product) return;

        if (!productData[product]) {
            productData[product] = {
                name: product,
                colorsSet: new Set(),
                sizesSet: new Set(),
                variants: {}
            };
        }

        const pd = productData[product];
        if (color) pd.colorsSet.add(color);
        if (talle) pd.sizesSet.add(talle);
        pd.variants[`${talle}|${color}`] = qty;
    });

    // Convert to sorted arrays and compute totals
    const productCards = Object.values(productData).map(pd => {
        const colors = [...pd.colorsSet].sort();
        const sizes = [...pd.sizesSet].sort(sortBySizeOrder);

        const matrix = {};
        let totalGeneral = 0;
        const totalByColor = {};
        const totalBySize = {};

        colors.forEach(c => { totalByColor[c] = 0; });
        sizes.forEach(s => { totalBySize[s] = 0; });

        sizes.forEach(size => {
            matrix[size] = {};
            colors.forEach(color => {
                const qty = pd.variants[`${size}|${color}`] || 0;
                matrix[size][color] = qty;
                totalByColor[color] += qty;
                totalBySize[size] += qty;
                totalGeneral += qty;
            });
        });

        return { name: pd.name, colors, sizes, matrix, totalByColor, totalBySize, totalGeneral };
    });

    // Sort products alphabetically
    productCards.sort((a, b) => a.name.localeCompare(b.name));

    const toggleExpand = (name) => {
        setExpandedProduct(prev => prev === name ? null : name);
    };

    // Grand total across all products
    const grandTotal = productCards.reduce((sum, pc) => sum + pc.totalGeneral, 0);

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header">
                <h2>📦 Stock Actual</h2>
                <span className={`grand-total-badge ${grandTotal > 0 ? 'positive' : 'zero'}`}>
                    Stock Total: {grandTotal}
                </span>
            </div>

            {/* Summary chips grid */}
            <div className="stock-summary-grid">
                {productCards.map(pc => (
                    <div
                        key={pc.name}
                        className={`stock-summary-chip ${expandedProduct === pc.name ? 'chip-active' : ''}`}
                        onClick={() => toggleExpand(pc.name)}
                    >
                        <span className="chip-name">{pc.name}</span>
                        <span className={`chip-total ${pc.totalGeneral > 0 ? 'positive' : 'zero'}`}>
                            {pc.totalGeneral}
                        </span>
                    </div>
                ))}
            </div>

            {/* Accordion product cards */}
            <div className="product-cards-list">
                {productCards.map(pc => {
                    const isExpanded = expandedProduct === pc.name;
                    return (
                        <div key={pc.name} className={`card glass product-stock-card ${isExpanded ? 'expanded' : ''}`}>
                            <div
                                className="product-card-header"
                                onClick={() => toggleExpand(pc.name)}
                            >
                                <div className="header-left">
                                    <h3>{pc.name}</h3>
                                    {/* Mini color summary when collapsed */}
                                    {!isExpanded && (
                                        <div className="mini-color-summary">
                                            {pc.colors.map(color => (
                                                <span key={color} className="mini-color-pill">
                                                    <span className="pill-label">{color}</span>
                                                    <span className={`pill-value ${pc.totalByColor[color] > 0 ? 'positive' : 'zero'}`}>
                                                        {pc.totalByColor[color]}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="header-right">
                                    <span className={`total-badge ${pc.totalGeneral > 0 ? 'positive' : 'zero'}`}>
                                        Total: {pc.totalGeneral}
                                    </span>
                                    <span className={`expand-arrow ${isExpanded ? 'rotated' : ''}`}>▼</span>
                                </div>
                            </div>

                            <div className={`accordion-body ${isExpanded ? 'open' : ''}`}>
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Dashboard;
