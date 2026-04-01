import { useState, useEffect, useRef } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'
import ManualMovementForm from './components/ManualMovementForm'
import MovementsHistory from './components/MovementsHistory'
import MLConnectionPanel from './components/MLConnectionPanel'
import { INITIAL_STATE } from './constants/initialState'
const SAVE_DEBOUNCE_MS = 600

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [data, setData] = useState(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const saveTimeoutRef = useRef(null)

  const loadData = () => {
    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar datos');
        return res.json();
      })
      .then(json => {
        setData({
          ...INITIAL_STATE,
          ...json,
          manualMovements: Array.isArray(json.manualMovements) ? json.manualMovements : [],
          sales: Array.isArray(json.sales) ? json.sales : [],
          products: Array.isArray(json.products) ? json.products : INITIAL_STATE.products,
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

  const addManualMovement = (movement) => {
    setData(prev => ({
      ...prev,
      manualMovements: [movement, ...(prev.manualMovements || [])]
    }))
    setActiveTab('dashboard') // Redirect to dashboard to see the updated stock
  }

  const convertSaleToManualMovement = (sale) => {
    if (!sale) return false

    const opNumber = String(sale.opNumber || '').trim()
    const saleOriginId = sale.id || `ml-${opNumber}`

    const movement = {
      id: `ml-manual-${saleOriginId}`,
      opNumber,
      product: sale.product,
      talle: sale.talle,
      color: sale.color,
      type: 'egreso',
      quantity: Number(sale.cantidad || 1),
      date: sale.fechaVenta || new Date().toISOString().split('T')[0],
      source: 'mercadolibre',
      originSaleId: sale.id || null,
      originSaleOpNumber: opNumber || null,
      origin: 'ml-sale'
    }

    let added = false
    setData(prev => {
      const alreadyConverted = (prev.manualMovements || []).some(m => m.originSaleId === sale.id)
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
        <button className={activeTab === 'ml' ? 'active' : ''} onClick={() => setActiveTab('ml')}>
          🔄 Sincronizar ML
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
                onAddMovement={addManualMovement}
                onAddProduct={addProduct}
              />
            )}
            {activeTab === 'history' && (
              <MovementsHistory 
                sales={data.sales || []} 
                manualMovements={data.manualMovements || []}
                onConvertSaleToManualMovement={convertSaleToManualMovement}
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
