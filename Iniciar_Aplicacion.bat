@echo off
TITLE FRIKA - Control Stock Full
echo ==========================================
echo    INICIANDO CONTROL DE STOCK FRIKA
echo ==========================================
echo.
cd /d "%~dp0"

IF NOT EXIST node_modules (
    echo [INFO] No se encontro la carpeta node_modules.
    echo [INFO] Instalando dependencias por primera vez...
    call npm install
    echo.
)

echo [INFO] Iniciando servidor y abriendo navegador...
call npm run dev

echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause > nul
