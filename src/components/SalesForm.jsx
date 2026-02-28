import React, { useState } from 'react';

const SalesForm = ({ onSave, stock, existingProducts }) => {
    const [product, setProduct] = useState('');
    const [talle, setTalle] = useState('');
    const [color, setColor] = useState('');
    const [opNumber, setOpNumber] = useState('');
    const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().split('T')[0]);

    // Get colors and sizes available for the selected product
    const availableVariants = stock.filter(s => s.product === product && s.quantity > 0);
    const availableColors = [...new Set(availableVariants.map(v => v.color))];
    const availableSizes = [...new Set(availableVariants.filter(v => v.color === color).map(v => v.talle))];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!product || !talle || !color || !opNumber) {
            alert('Por favor complete todos los campos.');
            return;
        }

        const success = onSave({
            id: crypto.randomUUID(),
            product,
            talle,
            color,
            opNumber,
            fechaVenta,
            cantidad: 1 // Standard sale is 1 unit
        });

        if (success) {
            setOpNumber('');
            alert('Venta registrada con éxito.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="glass card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>Bajar Stock (Venta)</h2>

            <label>Operación Nro</label>
            <input
                type="text"
                placeholder="Ej: 2000000123"
                value={opNumber}
                onChange={(e) => setOpNumber(e.target.value)}
            />

            <label>Producto</label>
            <select value={product} onChange={(e) => { setProduct(e.target.value); setColor(''); setTalle(''); }}>
                <option value="">Seleccione producto vendido...</option>
                {existingProducts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <label>Color</label>
                    <select value={color} onChange={(e) => { setColor(e.target.value); setTalle(''); }} disabled={!product}>
                        <option value="">Color...</option>
                        {availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label>Talle</label>
                    <select value={talle} onChange={(e) => setTalle(e.target.value)} disabled={!color}>
                        <option value="">Talle...</option>
                        {availableSizes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <label>Fecha de Venta</label>
            <input type="date" value={fechaVenta} onChange={(e) => setFechaVenta(e.target.value)} />

            <button type="submit" className="primary" style={{ width: '100%', marginTop: '1rem' }}>Registrar Venta</button>

            {product && availableVariants.length === 0 && (
                <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Aviso: No hay stock disponible para este producto.
                </p>
            )}
        </form>
    );
};

export default SalesForm;
