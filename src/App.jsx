import { useState, useEffect, useRef } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'
import ManualMovementForm from './components/ManualMovementForm'
import MovementsHistory from './components/MovementsHistory'
import MLConnectionPanel from './components/MLConnectionPanel'
import Reports from './components/Reports'
import ProductCosts from './components/ProductCosts'
import RiesgoFull from './components/RiesgoFull'
import { INITIAL_STATE } from './constants/initialState'
import { getProductCatalogEntry } from './utils/productMapping'
const SAVE_DEBOUNCE_MS = 600

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [data, setData] = useState(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const [productCosts, setProductCosts] = useState({})
  const saveTimeoutRef = useRef(null)

  const loadData = () => {
    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar datos');
        return res.json();
      })
      .then(json => {
        const manualProducts = Array.isArray(json.manualMovements)
          ? [...new Set(
              json.manualMovements
                .filter(m => m?.product && m.source !== 'mercadolibre' && m.origin !== 'ml-sale')
                .map(m => m.product)
            )]
          : []
        const products = [...new Set([...INITIAL_STATE.products, ...manualProducts])]
        setData({
          ...INITIAL_STATE,
          ...json,
          manualMovements: Array.isArray(json.manualMovements) ? json.manualMovements : [],
          sales: Array.isArray(json.sales) ? json.sales : [],
          products,
          mlStock: Array.isArray(json.mlStock) ? json.mlStock : [],
          mlStockFetchedAt: json.mlStockFetchedAt ?? null
        })
        setLoading(false)
      })
      .catch(err => {
        console.error('App: Error loading:', err)
        setSaveStatus('error')
        setLoading(false)
      })
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    fetch('http://localhost:3001/api/product-costs')
      .then(res => res.json())
      .then(d => setProductCosts(d.productCosts || {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (loading) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saving')
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(res => {
          if (!res.ok) throw new Error('Error al guardar');
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(null), 2000)
        })
        .catch(err => {
          console.error('App: Sync error:', err)
          setSaveStatus('error')
        })
        .finally(() => { saveTimeoutRef.current = null })
    }, SAVE_DEBOUNCE_MS)

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [data, loading])

  const addManualMovements = (movements) => {
    const normalizedMovements = Array.isArray(movements) ? movements.filter(Boolean) : []
    if (normalizedMovements.length === 0) return

    setData(prev => ({
      ...prev,
      manualMovements: [...normalizedMovements, ...(prev.manualMovements || [])]
    }))
    setActiveTab('dashboard') // Redirect to dashboard to see the updated stock
  }

  const addManualMovement = (movement) => {
    addManualMovements([movement])
  }

  const convertSaleToManualMovement = (sale, resolvedProductName = '', resolvedColorName = '') => {
    if (!sale) return false

    const opNumber = String(sale.opNumber || '').trim()
    const saleOriginId = sale.id || `ml-${opNumber}`
    const finalProductName = String(resolvedProductName || sale.product || '').trim()
    const productEntry = getProductCatalogEntry(finalProductName)
    const catalogColors = productEntry?.colors || []
    const selectedColor = String(resolvedColorName || sale.color || '').trim()
    const finalColorName = selectedColor !== 'Unico'
      ? selectedColor
      : (catalogColors.length === 1 ? catalogColors[0] : selectedColor)

    if (!finalProductName) {
      alert('No se pudo determinar el artículo para esta venta.')
      return false
    }

    if (!data.products.includes(finalProductName)) {
      alert('El artículo elegido no existe en la lista de artículos habilitados.')
      return false
    }

    if ((sale.color === 'Unico' || finalColorName === 'Unico') && catalogColors.length > 1) {
      alert('Necesito que elijas el color correcto antes de pasar esta venta a egreso.')
      return false
    }

    const movement = {
      id: `ml-manual-${saleOriginId}`,
      opNumber,
      product: finalProductName,
      talle: sale.talle,
      color: finalColorName,
      type: 'egreso',
      quantity: Number(sale.cantidad || 1),
      date: sale.fechaVenta || new Date().toISOString().split('T')[0],
      source: 'mercadolibre',
      originSaleId: saleOriginId,
      originSaleOpNumber: opNumber || null,
      origin: 'ml-sale'
    }

    let added = false
    setData(prev => {
      const alreadyConverted = (prev.manualMovements || []).some(m => m.originSaleId === saleOriginId)
      if (alreadyConverted) {
        return prev
      }
      added = true
      return {
        ...prev,
        manualMovements: [movement, ...(prev.manualMovements || [])]
      }
    })

    if (!added) {
      alert('Ese movimiento ya fue cargado desde esa venta de ML.')
      return false
    }

    setActiveTab('dashboard')
    return true
  }

  const registerSaleReturn = (sale, requestedQuantity) => {
    if (!sale) return false

    const saleOriginId = sale.id || `ml-${String(sale.opNumber || '').trim()}`
    const saleQuantity = Number(sale.cantidad || 1)
    const returnedQuantity = (data.manualMovements || []).reduce((sum, movement) => {
      if (movement?.type !== 'devolucion') return sum
      if (movement.originSaleId !== saleOriginId) return sum
      return sum + Number(movement.quantity || 1)
    }, 0)
    const availableQuantity = Math.max(0, saleQuantity - returnedQuantity)

    if (availableQuantity <= 0) {
      alert('Esa venta ya tiene registrada la devolución completa.')
      return false
    }

    let quantity = requestedQuantity
    if (quantity == null) {
      const rawValue = window.prompt(
        `Cantidad a devolver para ${sale.product || 'la venta seleccionada'} (1 a ${availableQuantity})`,
        String(availableQuantity)
      )
      if (rawValue === null) return false
      quantity = Number.parseInt(rawValue, 10)
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > availableQuantity) {
      alert(`Ingresá una cantidad válida entre 1 y ${availableQuantity}.`)
      return false
    }

    const movement = {
      id: `ml-return-${saleOriginId}-${Date.now()}`,
      opNumber: sale.opNumber || '',
      product: sale.product,
      talle: sale.talle,
      color: sale.color,
      type: 'devolucion',
      quantity,
      date: new Date().toISOString().split('T')[0],
      source: 'mercadolibre',
      originSaleId: saleOriginId,
      originSaleOpNumber: sale.opNumber || null,
      origin: 'ml-return'
    }

    setData(prev => ({
      ...prev,
      manualMovements: [movement, ...(prev.manualMovements || [])]
    }))

    setActiveTab('dashboard')
    return true
  }

  const addProduct = (productName) => {
    if (!data.products.includes(productName)) {
      setData(prev => ({
        ...prev,
        products: [...(prev.products || []), productName]
      }))
    }
  }

  return (
    <div className="container animate-fade-in">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ color: 'var(--primary-violet)', fontSize: '2.5rem', marginBottom: '0.2rem' }}>
              FRIKA FULL
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Gestión de Stock Manual + Sync Ventas ML
            </p>
          </div>
          {saveStatus && (
            <span style={{
              fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: 6,
              background: saveStatus === 'saved' ? 'rgba(34,197,94,0.2)' : saveStatus === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.2)',
              color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : 'var(--primary-violet)'
            }}>
              {saveStatus === 'saving' && 'Guardando...'}
              {saveStatus === 'saved' && '✓ Guardado'}
              {saveStatus === 'error' && 'Error al guardar'}
            </span>
          )}
        </div>
        <div style={{ marginBottom: '1.5rem' }} />
      </header>

      <nav>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          📊 Stock Manual
        </button>
        <button className={activeTab === 'form' ? 'active' : ''} onClick={() => setActiveTab('form')}>
          ➕ Cargar Movimiento
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          📋 Historial Ventas/Movimientos
        </button>
        <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>
          📊 Informes
        </button>
        <button className={activeTab === 'ml' ? 'active' : ''} onClick={() => setActiveTab('ml')}>
          🔄 Sincronizar ML
        </button>
        <button className={activeTab === 'costos' ? 'active' : ''} onClick={() => setActiveTab('costos')}>
          💵 Costos
        </button>
        <button className={activeTab === 'riesgo' ? 'active' : ''} onClick={() => setActiveTab('riesgo')}>
          ⏳ Riesgo Full
        </button>
      </nav>

      <main>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                manualMovements={data.manualMovements || []} 
                products={data.products || []} 
              />
            )}
            {activeTab === 'form' && (
              <ManualMovementForm 
                products={data.products || []} 
                manualMovements={data.manualMovements || []}
                onAddMovement={addManualMovement}
                onAddMovements={addManualMovements}
                onAddProduct={addProduct}
              />
            )}
            {activeTab === 'history' && (
            <MovementsHistory 
              sales={data.sales || []} 
              manualMovements={data.manualMovements || []}
              products={data.products || []}
              onConvertSaleToManualMovement={convertSaleToManualMovement}
              onRegisterSaleReturn={registerSaleReturn}
            />
          )}
            {activeTab === 'reports' && (
              <Reports
                manualMovements={data.manualMovements || []}
                sales={data.sales || []}
                products={data.products || []}
                mlStock={data.mlStock || []}
                mlStockFetchedAt={data.mlStockFetchedAt || null}
                productCosts={productCosts}
              />
            )}
            {activeTab === 'costos' && (
              <ProductCosts products={data.products || []} />
            )}
            {activeTab === 'riesgo' && (
              <RiesgoFull
                manualMovements={data.manualMovements || []}
                sales={data.sales || []}
                mlStock={data.mlStock || []}
                mlStockFetchedAt={data.mlStockFetchedAt || null}
                productCosts={productCosts}
                onStockRefreshed={loadData}
              />
            )}
            {activeTab === 'ml' && (
              <MLConnectionPanel 
                onSyncComplete={() => {
                  setLoading(true)
                  loadData()
                }} 
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
