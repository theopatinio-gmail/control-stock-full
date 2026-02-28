import React, { useState } from 'react';

const StockEntryForm = ({ onSave, existingProducts }) => {
    const [product, setProduct] = useState('');
    const [isNewProduct, setIsNewProduct] = useState(false);
    const [fechaEnvio, setFechaEnvio] = useState(new Date().toISOString().split('T')[0]);
    const [variants, setVariants] = useState([{ talle: '', color: '', cantidad: '' }]);

    const handleAddVariant = () => {
        setVariants([...variants, { talle: '', color: '', cantidad: '' }]);
    };

    const updateVariant = (index, field, value) => {
        const newVariants = [...variants];
        newVariants[index][field] = value;
        setVariants(newVariants);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!product || variants.some(v => !v.talle || !v.color || !v.cantidad)) {
            alert('Por favor complete todos los campos.');
            return;
        }

        onSave({
            id: crypto.randomUUID(),
            product,
            fechaEnvio,
            variants: variants.map(v => ({ ...v, cantidad: Number(v.cantidad) }))
        });

        // Reset form
        setProduct('');
        setVariants([{ talle: '', color: '', cantidad: '' }]);
        alert('Ingreso registrado con éxito.');
    };

    return (
        <form onSubmit={handleSubmit} className="glass card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>Nuevo Ingreso a Full</h2>

            <label>Producto</label>
            {!isNewProduct && existingProducts.length > 0 ? (
                <div style={{ position: 'relative' }}>
                    <select value={product} onChange={(e) => {
                        if (e.target.value === 'NEW') {
                            setIsNewProduct(true);
                            setProduct('');
                        } else {
                            setProduct(e.target.value);
                        }
                    }}>
                        <option value="">Seleccione un producto...</option>
                        {existingProducts.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="NEW">+ Agregar nuevo producto...</option>
                    </select>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="Nombre del nuevo producto"
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                    />
                    {existingProducts.length > 0 && (
                        <button type="button" onClick={() => setIsNewProduct(false)} style={{ marginBottom: '1rem' }}>
                            Volver
                        </button>
                    )}
                </div>
            )}

            <label>Fecha de Envío</label>
            <input type="date" value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} />

            <h3 style={{ marginTop: '1rem', fontSize: '1rem' }}>Variantes (Talle, Color, Cantidad)</h3>
            {variants.map((v, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                        placeholder="Talle"
                        value={v.talle}
                        onChange={(e) => updateVariant(index, 'talle', e.target.value)}
                    />
                    <input
                        placeholder="Color"
                        value={v.color}
                        onChange={(e) => updateVariant(index, 'color', e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Cant"
                        value={v.cantidad}
                        onChange={(e) => updateVariant(index, 'cantidad', e.target.value)}
                        style={{ width: '80px' }}
                    />
                </div>
            ))}
            <button type="button" onClick={handleAddVariant} style={{ width: '100%', marginBottom: '1rem', background: 'transparent', border: '1px dashed var(--border-color)' }}>
                + Agregar otra variante
            </button>

            <button type="submit" className="primary" style={{ width: '100%' }}>Registrar Envío</button>
        </form>
    );
};

export default StockEntryForm;
