import React, { useState, useMemo } from 'react';
import { sortBySizeOrder } from '../utils/productMapping';

const createEmptyRow = () => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    product: '',
    talle: '',
    color: '',
    quantity: 1,
    isNewProduct: false,
    isNewTalle: false,
    isNewColor: false
});

const ManualMovementForm = ({ products = [], manualMovements = [], onAddMovements, onAddProduct }) => {
    const [opNumber, setOpNumber] = useState('');
    const [type, setType] = useState('ingreso');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [rows, setRows] = useState([createEmptyRow()]);

    // Extract unique values for dropdowns
    const { uniqueProducts, uniqueTalles, uniqueColors } = useMemo(() => {
        // Only use the official products list as requested by user
        const pSet = new Set(products);
        const tSet = new Set();
        const cSet = new Set();

        manualMovements.forEach(m => {
            // Normalize talles to uppercase to avoid duplicates like 'l' and 'L'
            if (m.talle) tSet.add(m.talle.trim().toUpperCase());
            if (m.color) cSet.add(m.color.trim());
        });

        const sortedTalles = Array.from(tSet).sort(sortBySizeOrder);
        const sortedColors = Array.from(cSet).sort();

        return {
            uniqueProducts: Array.from(pSet).sort(),
            uniqueTalles: sortedTalles,
            uniqueColors: sortedColors
        };
    }, [products, manualMovements]);

    const updateRow = (rowId, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            
            // Special handling for "[+] Nuevo..."
            if (value === '___NEW___') {
                if (field === 'product') return { ...row, [field]: '', isNewProduct: true };
                if (field === 'talle') return { ...row, [field]: '', isNewTalle: true };
                if (field === 'color') return { ...row, [field]: '', isNewColor: true };
            }

            return { ...row, [field]: value };
        }));
    };

    const cancelNew = (rowId, field) => {
        setRows(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            if (field === 'product') return { ...row, product: '', isNewProduct: false };
            if (field === 'talle') return { ...row, talle: '', isNewTalle: false };
            if (field === 'color') return { ...row, color: '', isNewColor: false };
            return row;
        }));
    };

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
    };

    const removeRow = (rowId) => {
        setRows(prev => (prev.length === 1 ? prev : prev.filter(row => row.id !== rowId)));
    };

    const resetForm = () => {
        setOpNumber('');
        setRows([createEmptyRow()]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const invalidRow = rows.find(row => 
            !row.product.trim() || 
            !row.talle.trim() || 
            !row.color.trim() || 
            Number(row.quantity) < 1
        );

        if (invalidRow) {
            alert('Por favor completa todos los campos (Artículo, Talle, Color y Cantidad) en todas las filas.');
            return;
        }

        // Add any brand new products to the global list if needed
        rows.forEach(row => {
            if (row.isNewProduct && row.product.trim()) {
                onAddProduct?.(row.product.trim());
            }
        });

        const movements = rows.map((row, index) => ({
            id: `${Date.now()}-${index}`,
            opNumber,
            product: row.product.trim(),
            talle: row.talle.trim(),
            color: row.color.trim(),
            type,
            quantity: Number(row.quantity),
            date
        }));

        onAddMovements(movements);
        resetForm();
    };

    const SmartSelect = ({ value, options, isNew, onUpdate, onCancel, placeholder, field, rowId }) => {
        if (isNew) {
            return (
                <div className="new-input-container">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onUpdate(rowId, field, e.target.value)}
                        placeholder={`Nuevo ${placeholder}...`}
                        autoFocus
                        required
                    />
                    <button type="button" className="cancel-new-btn" onClick={() => onCancel(rowId, field)} title="Volver al menú">
                        ✕
                    </button>
                </div>
            );
        }

        return (
            <select
                value={value}
                onChange={(e) => onUpdate(rowId, field, e.target.value)}
                required
            >
                <option value="">Seleccionar...</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                <option value="___NEW___" style={{ fontWeight: 'bold', color: 'var(--primary-violet)' }}>
                    [+] Nuevo...
                </option>
            </select>
        );
    };

    return (
        <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                Ingreso de Movimientos (Planilla)
            </h2>
            
            <form onSubmit={handleSubmit}>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
                        <label>Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="movement-type-box" style={{ margin: 0, height: 'fit-content' }}>
                        <label>Tipo de Movimiento</label>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" name="type" value="ingreso" checked={type === 'ingreso'} onChange={() => setType('ingreso')} />
                                Ingreso
                            </label>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" name="type" value="egreso" checked={type === 'egreso'} onChange={() => setType('egreso')} />
                                Egreso
                            </label>
                        </div>
                    </div>
                </div>

                <div className="excel-table-container" style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                    <div className="movement-line-grid-header">
                        <span>Artículo</span>
                        <span>Talle</span>
                        <span>Color</span>
                        <span>Cant.</span>
                        <span></span>
                    </div>
                    {rows.map((row) => (
                        <div key={row.id} className="excel-row-container">
                            <div className="movement-line-grid">
                                <SmartSelect
                                    rowId={row.id}
                                    field="product"
                                    value={row.product}
                                    options={uniqueProducts}
                                    isNew={row.isNewProduct}
                                    onUpdate={updateRow}
                                    onCancel={cancelNew}
                                    placeholder="artículo"
                                />
                                <SmartSelect
                                    rowId={row.id}
                                    field="talle"
                                    value={row.talle}
                                    options={uniqueTalles}
                                    isNew={row.isNewTalle}
                                    onUpdate={updateRow}
                                    onCancel={cancelNew}
                                    placeholder="talle"
                                />
                                <SmartSelect
                                    rowId={row.id}
                                    field="color"
                                    value={row.color}
                                    options={uniqueColors}
                                    isNew={row.isNewColor}
                                    onUpdate={updateRow}
                                    onCancel={cancelNew}
                                    placeholder="color"
                                />
                                <input
                                    type="number"
                                    min="1"
                                    value={row.quantity}
                                    onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                                    required
                                    style={{ textAlign: 'center' }}
                                />
                                <button
                                    type="button"
                                    className="movement-line-remove"
                                    onClick={() => removeRow(row.id)}
                                    disabled={rows.length === 1}
                                    style={{ height: '40px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Eliminar fila"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button type="button" className="batch-add-btn" onClick={addRow} style={{ padding: '0.75rem 1.5rem' }}>
                        + Nueva Fila
                    </button>
                    
                    <button
                        type="submit"
                        className="submit-btn"
                        style={{ flex: 1, background: 'var(--primary-violet)', fontWeight: 'bold' }}
                    >
                        Registrar {rows.length} {rows.length === 1 ? 'Movimiento' : 'Movimientos'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManualMovementForm;
