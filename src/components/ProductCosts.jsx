import React, { useState, useEffect } from 'react';

const ProductCosts = ({ products = [] }) => {
    const [costs, setCosts] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('http://localhost:3001/api/product-costs')
            .then(r => r.json())
            .then(d => {
                setCosts(d.productCosts || {});
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleCostChange = (product, value) => {
        const numValue = parseFloat(value) || 0;
        setCosts(prev => ({ ...prev, [product]: numValue }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('http://localhost:3001/api/product-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productCosts: costs })
            });
            if (res.ok) {
                setMessage('Costos guardados correctamente');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (e) {
            setMessage('Error al guardar');
        }
        setSaving(false);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0);
    };

    if (loading) return <div className="loading">Cargando...</div>;

    return (
        <div className="animate-fade-in">
            <div className="dashboard-header">
                <div className="header-titles">
                    <h2>Costo por Producto</h2>
                    <p className="subtitle">Ingresá el costo de cada producto para calcular rentabilidad</p>
                </div>
                <div className="dashboard-controls">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar Costos'}
                    </button>
                </div>
            </div>

            {message && <div className="success-message">{message}</div>}

            <div className="card glass" style={{ marginTop: '20px' }}>
                <table className="movements-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Costo Unitario</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product}>
                                <td>{product}</td>
                                <td>
                                    <input
                                        type="number"
                                        className="cost-input"
                                        value={costs[product] || ''}
                                        onChange={(e) => handleCostChange(product, e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                    />
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan="2" style={{ textAlign: 'center', padding: '20px' }}>
                                    No hay productos definidos
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
                .cost-input {
                    padding: 8px 12px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 6px;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    width: 150px;
                    font-size: 14px;
                }
                .cost-input:focus {
                    outline: none;
                    border-color: #60a5fa;
                }
                .success-message {
                    padding: 10px 20px;
                    background: rgba(52, 211, 153, 0.2);
                    border: 1px solid #34d399;
                    border-radius: 8px;
                    color: #34d399;
                    margin: 15px 0;
                }
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default ProductCosts;
