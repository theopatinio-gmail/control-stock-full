# FRIKA - Control Stock Full

Aplicación para gestionar el stock de prendas en depósitos de Mercado Libre (Full).

## Funcionalidades

- **Resumen de Stock**: Vista en matriz (talle × color) por producto
- **Ingresar Stock**: Registro manual de envíos al depósito
- **Bajar Stock (Ventas)**: Registro de ventas manual o sincronizado desde ML
- **Historial**: Movimientos de entrada y salida con filtros
- **Sync ML**: Importación automática de ventas desde Mercado Libre

## Requisitos

- Node.js 18+
- Cuenta de Mercado Libre con productos en Full
- App creada en [developers.mercadolibre.com.ar](https://developers.mercadolibre.com.ar/devcenter)

## Instalación

```bash
npm install
```

## Uso

1. Iniciar la aplicación:
   ```bash
   npm run dev
   ```
   O ejecutar `Iniciar_Aplicacion.bat`

2. Abrir http://localhost:5173 en el navegador

3. Configurar Mercado Libre (pestaña "Sync ML"):
   - Crear una App en el portal de desarrolladores de ML
   - Configurar Redirect URI: `https://127.0.0.1`
   - Pegar App ID y Secret Key
   - Autorizar y pegar el código de la URL de retorno
   - En "Configuración avanzada": agregar los IDs de tus productos Full (MLA...) y la fecha del último snapshot de stock
   - Sincronizar ventas

## Estructura

- `server.js` - API Express (puerto 3001)
- `src/` - Frontend React + Vite
- `data.json` - Datos locales (se crea automáticamente)
- `ml_config.json` - Credenciales ML (no se sube a Git)

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor + frontend en desarrollo |
| `npm run server` | Solo servidor API |
| `npm run build` | Build para producción |
| `npm run preview` | Vista previa del build |
