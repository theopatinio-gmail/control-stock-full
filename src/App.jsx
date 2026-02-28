import { useState, useEffect, useRef } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'
import StockEntryForm from './components/StockEntryForm'
import SalesForm from './components/SalesForm'
import MovementsHistory from './components/MovementsHistory'
import MLConnectionPanel from './components/MLConnectionPanel'
import { INITIAL_STATE } from './constants/initialState'
import { calculateStock, isDuplicateOp } from './utils/stockLogic'

const SAVE_DEBOUNCE_MS = 600

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [data, setData] = useState(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'saved' | 'error'
  const saveTimeoutRef = useRef(null)

  // Load data from API on mount (also used after ML sync)
  const loadData = () => {
    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar datos');
        return res.json();
      })
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        console.error('App: Error loading data:', err)
        setSaveStatus('error')
        setLoading(false)
      })
  }

  useEffect(() => { loadData() }, [])

  // Save data to API with debounce (evita múltiples guardados seguidos)
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

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [data, loading])

  const addStockEntry = (entry) => {
    setData(prev => ({
      ...prev,
      stockEntries: [entry, ...prev.stockEntries],
      products: prev.products.includes(entry.product)
        ? prev.products
        : [...prev.products, entry.product]
    }))
  }

  const addSale = (sale) => {
    if (isDuplicateOp(data.sales, sale.opNumber)) {
      alert('Error: El Nro de Operación ya existe.')
      return false
    }
    setData(prev => ({
      ...prev,
      sales: [sale, ...prev.sales]
    }))
    return true
  }

  const currentStock = calculateStock(data.stockEntries, data.sales)

  return (
    <div className="container animate-fade-in">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ color: 'var(--primary-violet)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              FRIKA - Control Stock Full
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Gestión inteligente mercadería en depósitos de Mercado Libre.
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
        <div style={{ marginBottom: '2rem' }} />
      </header>

      <nav>
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Resumen de Stock
        </button>
        <button
          className={activeTab === 'entry' ? 'active' : ''}
          onClick={() => setActiveTab('entry')}
        >
          Ingresar Stock
        </button>
        <button
          className={activeTab === 'sales' ? 'active' : ''}
          onClick={() => setActiveTab('sales')}
        >
          Bajar Stock (Ventas)
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Historial
        </button>
        <button
          className={activeTab === 'ml' ? 'active' : ''}
          onClick={() => setActiveTab('ml')}
        >
          🔄 Sync ML
        </button>
      </nav>

      <main>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard stock={currentStock} />}
            {activeTab === 'entry' && (
              <StockEntryForm
                onSave={addStockEntry}
                existingProducts={data.products}
              />
            )}
            {activeTab === 'sales' && (
              <SalesForm
                onSave={addSale}
                stock={currentStock}
                existingProducts={data.products}
              />
            )}
            {activeTab === 'history' && (
              <MovementsHistory
                stockEntries={data.stockEntries}
                sales={data.sales}
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
