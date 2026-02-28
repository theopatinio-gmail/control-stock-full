import { useState, useEffect } from 'react'

const STATUS_IDLE = 'idle'
const STATUS_LOADING = 'loading'
const STATUS_SUCCESS = 'success'
const STATUS_ERROR = 'error'

export default function MLConnectionPanel({ onSyncComplete }) {
    // Credenciales
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [savingCreds, setSavingCreds] = useState(false)

    // Estado conexión
    const [mlStatus, setMlStatus] = useState({
        hasClientId: false,
        hasToken: false,
        last_sync: null,
        redirect_uri: 'https://127.0.0.1'
    })
    const [customRedirect, setCustomRedirect] = useState('')

    // Config avanzada (IDs Full, fecha snapshot)
    const [fullItemIds, setFullItemIds] = useState('')
    const [snapshotDate, setSnapshotDate] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [savingAdvanced, setSavingAdvanced] = useState(false)

    // Flujo OAuth manual
    const [authUrl, setAuthUrl] = useState('')
    const [authCode, setAuthCode] = useState('')
    const [exchangeStatus, setExchangeStatus] = useState(STATUS_IDLE)
    const [exchangeMsg, setExchangeMsg] = useState('')

    // Sync
    const [syncStatus, setSyncStatus] = useState(STATUS_IDLE)
    const [syncResult, setSyncResult] = useState(null)

    useEffect(() => {
        fetchStatus()
    }, [])

    async function fetchStatus() {
        try {
            const r = await fetch('/api/ml/status')
            const d = await r.json()
            setMlStatus(d)
            if (d.client_id) setClientId(d.client_id)
            if (d.redirect_uri) setCustomRedirect(d.redirect_uri)
            if (d.full_item_ids?.length) setFullItemIds(d.full_item_ids.join(', '))
            else setFullItemIds('MLA864272312, MLA2686396878')
            setSnapshotDate(d.snapshot_date || '2026-02-19')
        } catch (e) {
            console.error('Error fetching ML status:', e)
        }
    }

    async function handleSaveCredentials(e) {
        e.preventDefault()
        setSavingCreds(true)
        try {
            const r = await fetch('/api/ml/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId.trim(),
                    client_secret: clientSecret.trim(),
                    redirect_uri: customRedirect.trim()
                })
            })
            const d = await r.json()
            if (d.success) {
                await fetchStatus()
                // Generar URL de autorización
                const urlRes = await fetch('/api/ml/authorize-url')
                const urlData = await urlRes.json()
                setAuthUrl(urlData.url || '')
            } else {
                alert('Error al guardar: ' + (d.error || 'desconocido'))
            }
        } catch (e) {
            alert('Error: ' + e.message)
        }
        setSavingCreds(false)
    }

    async function handleGetAuthUrl() {
        try {
            const r = await fetch('/api/ml/authorize-url')
            const d = await r.json()
            if (d.url) {
                setAuthUrl(d.url)
                window.open(d.url, '_blank')
            }
        } catch (e) {
            alert('Error: ' + e.message)
        }
    }

    async function handleExchangeCode(e) {
        e.preventDefault()
        if (!authCode.trim()) return
        setExchangeStatus(STATUS_LOADING)
        setExchangeMsg('')
        try {
            // Extraer code si el usuario pegó la URL completa
            let code = authCode.trim()

            if (code.includes('auth.mercadolibre.com.ar/authorization')) {
                setExchangeStatus(STATUS_ERROR)
                setExchangeMsg('❌ Error: Estás pegando la URL de INICIO. Tenés que completar la autorización en la otra ventana y pegar la URL de la página FINAL (la que dice Error o 127.0.0.1).')
                return
            }

            if (code.includes('?')) {
                const params = new URLSearchParams(code.split('?')[1])
                code = params.get('code') || code
            }

            const r = await fetch('/api/ml/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })
            const d = await r.json()
            if (d.success) {
                setExchangeStatus(STATUS_SUCCESS)
                setExchangeMsg(`✅ ¡Conectado! Usuario ML: ${d.user_id}`)
                setAuthCode('')
                await fetchStatus()
            } else {
                setExchangeStatus(STATUS_ERROR)
                setExchangeMsg('❌ ' + (d.error || 'Error al conectar'))
            }
        } catch (e) {
            setExchangeStatus(STATUS_ERROR)
            setExchangeMsg('❌ Error: ' + e.message)
        }
    }

    async function handleSync() {
        setSyncStatus(STATUS_LOADING)
        setSyncResult(null)
        try {
            const r = await fetch('/api/ml/sync', { method: 'POST' })
            const d = await r.json()
            if (d.success) {
                setSyncStatus(STATUS_SUCCESS)
                setSyncResult(d)
                await fetchStatus()
                if (onSyncComplete) onSyncComplete()
            } else {
                setSyncStatus(STATUS_ERROR)
                setSyncResult({ message: d.error || 'Error en sync' })
            }
        } catch (e) {
            setSyncStatus(STATUS_ERROR)
            setSyncResult({ message: e.message })
        }
    }

    function formatDate(iso) {
        if (!iso) return '—'
        const d = new Date(iso)
        return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const isConnected = mlStatus.hasToken
    const hasCredentials = mlStatus.hasClientId

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header */}
            <div style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 16,
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, color: 'var(--primary-violet)', fontSize: '1.3rem' }}>
                        🔗 Sincronización Mercado Libre
                    </h2>
                    <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Importá tus ventas de ML automáticamente con un clic
                    </p>
                </div>
                <div style={{
                    padding: '0.4rem 1rem',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: isConnected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: isConnected ? '#22c55e' : '#ef4444',
                    border: `1px solid ${isConnected ? '#22c55e44' : '#ef444444'}`
                }}>
                    {isConnected ? '● Conectado' : '○ No conectado'}
                </div>
            </div>

            {/* Paso 1: Credenciales */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
                    Paso 1 — Credenciales de la App ML
                </h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Creá una App en{' '}
                    <a href="https://developers.mercadolibre.com.ar/devcenter" target="_blank" rel="noreferrer"
                        style={{ color: 'var(--primary-violet)' }}>
                        developers.mercadolibre.com.ar
                    </a>{' '}
                    con Redirect URI <code style={{ background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: 4 }}>https://127.0.0.1</code>{' '}
                    y pegá el <strong>App ID</strong> y <strong>Secret Key</strong> acá:
                </p>
                <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>App ID (client_id)</label>
                            <input
                                type="text"
                                value={clientId}
                                onChange={e => setClientId(e.target.value)}
                                placeholder="123456789"
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--card-border)',
                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Secret Key (client_secret)</label>
                            <input
                                type="password"
                                value={clientSecret}
                                onChange={e => setClientSecret(e.target.value)}
                                placeholder="••••••••••••••••"
                                style={{
                                    width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--card-border)',
                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                            Redirect URI (Tiene que ser IGUAL a la del portal de ML)
                        </label>
                        <input
                            type="text"
                            value={customRedirect}
                            onChange={e => setCustomRedirect(e.target.value)}
                            placeholder="https://127.0.0.1"
                            style={{
                                width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--card-border)',
                                background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={savingCreds || !customRedirect}
                            style={{
                                padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: 'var(--primary-violet)', color: '#fff', opacity: (savingCreds || !customRedirect) ? 0.5 : 1
                            }}
                        >
                            {savingCreds ? 'Guardando...' : '💾 Guardar configuración'}
                        </button>
                    </div>
                </form>

                {/* Config avanzada */}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        {showAdvanced ? '▼' : '▶'} Configuración avanzada (IDs Full, fecha snapshot)
                    </button>
                    {showAdvanced && (
                        <form onSubmit={async (e) => {
                            e.preventDefault()
                            setSavingAdvanced(true)
                            try {
                                const ids = fullItemIds.split(/[,\s]+/).filter(Boolean)
                                const r = await fetch('/api/ml/config', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ full_item_ids: ids, snapshot_date: snapshotDate.trim() || null })
                                })
                                const d = await r.json()
                                if (d.success) {
                                    await fetchStatus()
                                    alert('Configuración guardada')
                                } else alert('Error: ' + (d.error || 'desconocido'))
                            } catch (err) { alert('Error: ' + err.message) }
                            setSavingAdvanced(false)
                        }} style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    IDs de productos Full (separados por coma)
                                </label>
                                <input
                                    type="text"
                                    value={fullItemIds}
                                    onChange={e => setFullItemIds(e.target.value)}
                                    placeholder="MLA864272312, MLA2686396878"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    Fecha snapshot (solo ventas posteriores)
                                </label>
                                <input
                                    type="date"
                                    value={snapshotDate}
                                    onChange={e => setSnapshotDate(e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85rem' }}
                                />
                            </div>
                            <button type="submit" disabled={savingAdvanced} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--primary-violet)', color: '#fff', fontSize: '0.9rem' }}>
                                {savingAdvanced ? 'Guardando...' : 'Guardar configuración avanzada'}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Paso 2: Autorizar */}
            <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '1.5rem',
                opacity: hasCredentials ? 1 : 0.4, pointerEvents: hasCredentials ? 'auto' : 'none'
            }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text)' }}>
                    Paso 2 — Autorizar con Mercado Libre
                </h3>

                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Hacé clic en el botón para abrir la pantalla de autorización de ML. Después de autorizar,
                    el navegador te va a redirigir a una página que <strong>no carga</strong> (porque es localhost)
                    — eso es normal. Copiá la <strong>URL completa</strong> que aparece en la barra del navegador y pegála abajo.
                </p>

                <button
                    onClick={handleGetAuthUrl}
                    style={{
                        padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                        background: 'linear-gradient(135deg, #FFD000, #FF7733)', color: '#1a1a1a', marginBottom: '0.5rem'
                    }}
                >
                    🔑 Abrir autorización en Mercado Libre
                </button>

                {authUrl && (
                    <div style={{ marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                            Si el botón no abre, copiá y pegá esto en una pestaña nueva (preferentemente Incógnito):
                        </p>
                        <code style={{
                            display: 'block', padding: '0.5rem', background: 'rgba(0,0,0,0.2)',
                            borderRadius: 4, fontSize: '0.7rem', wordBreak: 'break-all'
                        }}>
                            {authUrl}
                        </code>
                    </div>
                )}

                <form onSubmit={handleExchangeCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                            Pegá aquí la URL completa o solo el código (code=XXXXX)
                        </label>
                        <input
                            type="text"
                            value={authCode}
                            onChange={e => setAuthCode(e.target.value)}
                            placeholder="https://localhost?code=TG-XXXXXXXX-... (o solo el código)"
                            style={{
                                width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--card-border)',
                                background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    {exchangeMsg && (
                        <p style={{
                            margin: 0, padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.85rem',
                            background: exchangeStatus === STATUS_SUCCESS ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: exchangeStatus === STATUS_SUCCESS ? '#22c55e' : '#ef4444'
                        }}>
                            {exchangeMsg}
                        </p>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={exchangeStatus === STATUS_LOADING || !authCode}
                            style={{
                                padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: 'var(--primary-violet)', color: '#fff',
                                opacity: (exchangeStatus === STATUS_LOADING || !authCode) ? 0.5 : 1
                            }}
                        >
                            {exchangeStatus === STATUS_LOADING ? 'Conectando...' : '✅ Conectar cuenta'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Paso 3: Sincronizar */}
            <div style={{
                background: 'var(--card-bg)', border: `1px solid ${isConnected ? 'var(--primary-violet)' : 'var(--card-border)'}`,
                borderRadius: 16, padding: '1.5rem',
                opacity: isConnected ? 1 : 0.4, pointerEvents: isConnected ? 'auto' : 'none'
            }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--text)' }}>
                    Paso 3 — Sincronizar ventas
                </h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Importa las últimas ventas de ML (últimos 60 días) sin duplicar las ya existentes.
                    {mlStatus.last_sync && (
                        <span> Último sync: <strong>{formatDate(mlStatus.last_sync)}</strong></span>
                    )}
                </p>

                <button
                    onClick={handleSync}
                    disabled={syncStatus === STATUS_LOADING}
                    style={{
                        padding: '0.8rem 2rem', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700,
                        fontSize: '1rem', background: 'var(--primary-violet)', color: '#fff',
                        opacity: syncStatus === STATUS_LOADING ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                >
                    {syncStatus === STATUS_LOADING
                        ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Sincronizando...</>
                        : '🔄 Sincronizar ahora'}
                </button>

                {/* Resultado del sync */}
                {syncResult && (
                    <div style={{
                        marginTop: '1rem', padding: '1rem', borderRadius: 10,
                        background: syncStatus === STATUS_SUCCESS ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${syncStatus === STATUS_SUCCESS ? '#22c55e33' : '#ef444433'}`
                    }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: syncStatus === STATUS_SUCCESS ? '#22c55e' : '#ef4444' }}>
                            {syncResult.message}
                        </p>

                        {syncResult.sales && syncResult.sales.length > 0 && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                            {['Operación', 'Producto', 'Talle', 'Color', 'Cant.', 'Fecha'].map(h => (
                                                <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {syncResult.sales.map((s, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    {String(s.opNumber).slice(0, 16)}
                                                </td>
                                                <td style={{ padding: '0.4rem 0.6rem' }}>{s.product}</td>
                                                <td style={{ padding: '0.4rem 0.6rem' }}>{s.talle}</td>
                                                <td style={{ padding: '0.4rem 0.6rem' }}>{s.color}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>{s.cantidad}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{s.fechaVenta}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}
