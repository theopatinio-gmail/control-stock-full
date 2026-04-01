import React, { useState } from 'react';

const ManualMovementForm = ({ products = [], onAddMovement, onAddProduct }) => {
    const [opNumber, setOpNumber] = useState('');
    const [product, setProduct] = useState('');
    const [isNewProduct, setIsNewProduct] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [talle, setTalle] = useState('');
    const [color, setColor] = useState('');
    const [type, setType] = useState('ingreso'); // 'ingreso' | 'egreso'
    const [quantity, setQuantity] = useState(1);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const finalProductName = isNewProduct ? newProductName.trim() : product;
        
        if (!finalProductName) {
            alert('Por favor, selecciona o ingresa un producto');
            return;
        }

        if (isNewProduct && newProductName.trim()) {
            onAddProduct(newProductName.trim());
        }

        const movement = {
            id: Date.now().toString(),
            opNumber,
            product: finalProductName,
            talle,
            color,
            type,
            quantity: Number(quantity),
            date
        };

        onAddMovement(movement);

        // Reset form
        setOpNumber('');
        if (!isNewProduct) setProduct('');
        setNewProductName('');
        setTalle('');
        setColor('');
        setQuantity(1);
    };

    return (
        <div className="card glass animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                📝 Ingresar Movimiento Manual
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                    <label>Nro. de Operación / Referencia</label>
                    <input 
                        type="text" 
                        value={opNumber} 
                        onChange={(e) => setOpNumber(e.target.value)} 
                        placeholder="Ej: OP123456"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Artículo</label>
                    {!isNewProduct ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select 
                                value={product} 
                                onChange={(e) => setProduct(e.target.value)}
                                required={!isNewProduct}
                                style={{ flex: 1 }}
                            >
                                <option value="">Seleccionar...</option>
                                {products.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <button 
                                type="button" 
                                onClick={() => setIsNewProduct(true)}
                                style={{ padding: '0.5rem', background: 'var(--primary-violet)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                                + Nuevo
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="text" 
                                value={newProductName} 
                                onChange={(e) => setNewProductName(e.target.value)} 
                                placeholder="Nombre del nuevo artículo..."
                                required={isNewProduct}
                                autoFocus
                                style={{ flex: 1 }}
                            />
                            <button 
                                type="button" 
                                onClick={() => setIsNewProduct(false)}
                                style={{ padding: '0.5rem', background: '#444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Talle</label>
                        <input 
                            type="text" 
                            value={talle} 
                            onChange={(e) => setTalle(e.target.value)} 
                            placeholder="Ej: M, 40, XL"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Color</label>
                        <input 
                            type="text" 
                            value={color} 
                            onChange={(e) => setColor(e.target.value)} 
                            placeholder="Ej: Negro, Azul"
                            required
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Tipo de Movimiento</label>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" name="type" value="ingreso" checked={type === 'ingreso'} onChange={() => setType('ingreso')} />
                                Ingreso
                            </label>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" name="type" value="egreso" checked={type === 'egreso'} onChange={() => setType('egreso')} />
                                Egreso / Venta
                            </label>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Cantidad</label>
                        <input 
                            type="number" 
                            min="1"
                            value={quantity} 
                            onChange={(e) => setQuantity(e.target.value)} 
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Fecha</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        required
                    />
                </div>

                <button 
                    type="submit" 
                    className="submit-btn" 
                    style={{ marginTop: '1rem', background: 'var(--primary-violet)', fontWeight: 'bold' }}
                >
                    Registrar Movimiento
                </button>
            </form>
        </div>
    );
};

export default ManualMovementForm;
