import React, { useState } from 'react';

const MovementsHistory = ({ sales = [], manualMovements = [], onConvertSaleToManualMovement }) => {
    const [view, setView] = useState('ml'); // 'ml' | 'manual'
    const [searchTerm, setSearchTerm] = useState('');
    const convertedSaleIds = new Set(manualMovements.map(m => m.originSaleId).filter(Boolean));

    const filteredMLSales = sales
        .filter(s => s.product.toLowerCase().includes(searchTerm.toLowerCase()) || (s.opNumber && s.opNumber.toString().includes(searchTerm)))
        .sort((a, b) => new Date(b.fechaVenta) - new Date(a.fechaVenta));

    const filteredManual = manualMovements
        .filter(m => m.product.toLowerCase().includes(searchTerm.toLowerCase()) || (m.opNumber && m.opNumber.toString().includes(searchTerm)))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

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
                                filteredMLSales.map(sale => (
                                    <tr key={sale.id}>
                                        <td style={{ padding: '0.8rem 1rem' }}>{sale.fechaVenta}</td>
                                        <td style={{ fontWeight: '500' }}>{sale.product}</td>
                                        <td style={{ textAlign: 'center' }}>{sale.talle}</td>
                                        <td style={{ textAlign: 'center' }}>{sale.color}</td>
                                        <td style={{ textAlign: 'center' }}>{sale.cantidad || 1}</td>
                                        <td style={{ fontSize: '0.8rem', opacity: 0.8 }}>#{sale.opNumber}</td>
                                        <td style={{ textAlign: 'center', padding: '0.8rem 1rem' }}>
                                            <button
                                                type="button"
                                                disabled={convertedSaleIds.has(sale.id)}
                                                onClick={() => onConvertSaleToManualMovement?.(sale)}
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
                                        </td>
                                    </tr>
                                ))
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
                                            <span style={{ 
                                                fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 4,
                                                background: mov.type === 'ingreso' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: mov.type === 'ingreso' ? '#4ade80' : '#f87171',
                                                border: `1px solid ${mov.type === 'ingreso' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                textTransform: 'uppercase', fontWeight: '800'
                                            }}>
                                                {mov.type}
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
