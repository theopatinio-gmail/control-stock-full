import { useState, useEffect } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'
import StockEntryForm from './components/StockEntryForm'
import SalesForm from './components/SalesForm'
import MovementsHistory from './components/MovementsHistory'
import MLConnectionPanel from './components/MLConnectionPanel'
import { INITIAL_STATE } from './constants/initialState'
import { calculateStock, isDuplicateOp } from './utils/stockLogic'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [data, setData] = useState(INITIAL_STATE)
  const [loading, setLoading] = useState(true)

  // Load data from API on mount (also used after ML sync)
  const loadData = () => {
    console.log('App: Fetching data from API...');
    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(json => {
        console.log('App: Data loaded successfully:', json);
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        console.error('App: Error loading data:', err)
        setLoading(false)
      })
  }

  useEffect(() => { loadData() }, [])

  // Save data to API whenever it changes (auto-sync)
  useEffect(() => {
    if (!loading) {
      console.log('App: Data changed, syncing to server...', data);
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(res => {
          if (!res.ok) throw new Error('Save failed');
          console.log('App: Sync complete');
        })
        .catch(err => console.error('App: Sync error:', err))
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
        <h1 style={{ color: 'var(--primary-violet)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          FRIKA - Control Stock Full
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Gestión inteligente mercadería en depósitos de Mercado Libre.
        </p>
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
            {activeTab === 'dashboard' && <Dashboard stock={currentStock} stockEntries={data.stockEntries} sales={data.sales} />}
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
