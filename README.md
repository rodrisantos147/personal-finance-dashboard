# Dashboard de finanzas personales

Next.js (App Router) + Tailwind + Recharts. Tema oscuro con acentos blancos. Los datos se guardan en **localStorage** del navegador (sin servidor). Podés exportar/importar JSON desde la pestaña **Datos**.

## Funciones

- **Pesos uruguayos (UYU) y dólares (USD)** por movimiento; moneda por defecto en **Datos** → Ajustes generales; el dashboard permite elegir en qué moneda ver KPIs y gráficos
- **Total de referencia en UYU** (opcional): en Datos podés cargar un tipo de cambio “pesos por 1 USD” para ver un bloque extra en el resumen que combina ambas monedas sin afectar los gráficos
- Ingresos y egresos con categoría, débito/crédito/efectivo/transferencia, pendientes
- Tarjetas con día de cierre y vencimiento (recordatorios en Consejos); opcional **calendario mensual** (ej. tabla 2026 tipo Itaú)
- Ingresos recurrentes para estimar ingresos futuros del mes
- Gráficos: últimos 6 meses, torta por categoría, reparto débito vs crédito
- Comparativa vs período anterior (misma duración)
- Lista de deseos con sugerencia según superávit proyectado
- Exportar / importar respaldo JSON
- **Importar CSV** (export del banco o Excel guardado como CSV) para cargar meses anteriores de una vez
- **Dataset demo** reproducible (ventas, onboarding, capturas)

## Demo comercial (replicable)

En la pestaña **Datos**:

- **Cargar dataset demo** reemplaza el estado local por datos ficticios completos (~6 meses, tarjetas, recurrentes, lista de deseos, pendientes). Las fechas se calculan respecto de **la fecha actual**, así las gráficas y el mes en curso siempre se ven bien.
- **Solo descargar JSON demo** genera el mismo contenido que un respaldo exportable; podés versionarlo en el repo (`demo-seed.json`) o importarlo en otro navegador.

Para mostrar un aviso con enlace rápido en el dashboard (útil en una landing o preview de Vercel), copiá `.env.example` a `.env.local` y definí `NEXT_PUBLIC_SHOW_DEMO_BANNER=true`.

Código: `src/lib/demo-data.ts` (`buildDemoSnapshot`, `buildDemoExportJson`).

### Estados de cuenta en CSV

En **Datos** → **Importar desde CSV**: subí el archivo o pegá el texto. Se detectan columnas típicas (**Fecha**, **Descripción**, **Débito** / **Crédito**, o **Monto**; opcional **Moneda**). Podés elegir la moneda por defecto del lote si el archivo no la trae; también se intenta detectar **US$** en los importes. Podés mezclar varios meses en un solo archivo. Si el banco exporta una sola columna de importe, usá signo (negativo = egreso) o indicá que todo es egreso/ingreso. La categoría y el medio de pago por defecto se aplican a todo el lote (después podés editar o borrar filas en Movimientos).

### PDF (Itaú y similares)

En **Datos** → **Importar PDF**: se lee el texto en el navegador (no sube el archivo a un servidor). El formato de cada PDF varía: si no detecta movimientos, usá la exportación **CSV/Excel** del banco o la importación CSV pegando la tabla. Los PDFs escaneados (imagen) no pueden leerse sin OCR.

## Desarrollo

```bash
cd personal-finance-dashboard
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Deploy en Vercel

1. Sube el proyecto a GitHub/GitLab/Bitbucket (solo la carpeta `personal-finance-dashboard` como raíz del repo, o monorepo con root en esa carpeta).
2. En [vercel.com](https://vercel.com), **Add New Project** → importá el repo.
3. **Framework Preset:** Next.js. **Root Directory:** si el repo es solo esta app, dejá vacío; si está dentro de un monorepo, indicá la subcarpeta.
4. **Build Command:** `npm run build` (por defecto). **Output:** maneja Vercel automáticamente.
5. Deploy.

**Nota:** al no haber backend, cada visitante tiene su propio almacenamiento local en su dispositivo. Para sincronizar entre dispositivos o usuarios, habría que añadir autenticación y base de datos (p. ej. Supabase) en una iteración futura.
