# Lógica del dashboard - Finanzas Rodrigo

## Archivos

- `gastos_visa.csv` → TODOS los gastos reales (tarjeta de crédito)
- `ingresos_cuenta.csv` → TODOS los ingresos (cuenta corriente)
- `finanzas_completas.csv` → mezcla cuenta + Visa con columnas `tipo_movimiento` y `fuente`

## REGLA CRÍTICA - Sin doble conteo

El banco tiene dos productos:

1. **Cuenta corriente**: donde entran los ingresos (freelance, cambios de USD)
2. **Tarjeta Visa**: donde se registran los gastos

Cada mes, Rodrigo paga la Visa desde la cuenta corriente. Eso aparece como
`DEB. VARIOS VISA-ILINK` en la cuenta corriente. **NO es un gasto real** frente
al extracto de Visa: es solo el pago de la tarjeta.

## Cómo calcula la app al importar CSV

- **`pago_tarjeta`** (o texto tipo `DEB. VARIOS VISA-ILINK`): se importa el
  movimiento pero queda **fuera del resumen** (KPI), para no sumar dos veces
  el mismo gasto si ya cargaste el extracto Visa.
- **`transferencia_recibida`** y **`prestamo_recibido`**: **no se importan**
  (movimientos internos / deuda, no ingreso “real” del mes).
- **`prestamo`** como ingreso (ej. desembolso T.C.): se importa **fuera del
  resumen**. Las **cuotas** de préstamo en Visa siguen como gasto normal.

## Cómo calcular a mano (referencia)

### Gastos del mes

Sumar `gastos_visa.csv` donde `mes === mesActual` (montos negativos = egresos).

### Ingresos del mes

Sumar `ingresos_cuenta.csv` donde `tipo === 'ingreso'` y `mes === mesActual`.
Ignorar `transferencia_recibida` y `prestamo_recibido`.

### Balance real

`balance = ingresos - gastos`

## Notas

- Los montos en `gastos_visa.csv` suelen ser negativos (egresos).
- Los montos en `ingresos_cuenta.csv` son positivos en ingresos.
- Algunas cuotas de compras anteriores aparecen en meses siguientes.
