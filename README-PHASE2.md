# Fase 2 — Operaciones y tracking (doc del operador)

Rama: `phase-2-ops`. Todo lo de esta fase son archivos nuevos mas una entrada
de cron en `vercel.json`. No toca checkout, webhook ni paginas de producto
(eso vive en `phase-1-checkout`).

---

## 1. Variables de entorno (Vercel > Settings > Environment Variables)

Agregar en Production (y Preview si se quiere probar ahi):

| Variable | Que es | Valor |
|---|---|---|
| `ADMIN_SECRET` | Frase de acceso del panel `/admin.html`. Se compara en tiempo constante contra el header `Authorization: Bearer ...`. | Genera una propia: `openssl rand -base64 30`. Ejemplo del formato (NO usar este): `SGq3Z8LQHqqhAVnXsPsBPBmq7qksNwJ7hJoo16gY` |
| `SUPABASE_SERVICE_KEY` | Service role key del proyecto Supabase `mwfnvqsyvvzpkjwqasbk` (Dashboard > Settings > API > service_role). Da acceso total a las tablas; solo vive en serverless, nunca en el navegador. | Copiar del dashboard de Supabase |
| `CRON_SECRET` | Protege `/api/cron-lowstock`. Cuando esta env var existe, Vercel manda `Authorization: Bearer <CRON_SECRET>` automaticamente en cada invocacion del cron; cualquier llamada sin ese header recibe 401. | Genera una propia: `openssl rand -hex 24`. Ejemplo del formato (NO usar este): `c63f3c10093171694f7932ad27dd928306101511c036bf76` |
| `RESEND_API_KEY` | Ya existe (la usa `send-protocol`). La reutilizan el correo de guia y la alerta de inventario. | Sin cambios |

Despues de agregar variables hay que redeployar para que las tomen las funciones.

## 2. El panel: `https://biogradix.com/admin.html`

- Herramienta interna, en espanol, con `noindex,nofollow`. No hay link a ella
  desde el sitio; compartir solo la URL y la frase con quien opere.
- Al abrir pide la frase de acceso (el valor de `ADMIN_SECRET`). Se guarda en
  `sessionStorage`, o sea que dura lo que dure la pestana; "Salir" la borra.
- Frase incorrecta = error limpio y re-prompt. Si el backend responde 401 en
  cualquier momento, el panel regresa a la puerta de acceso.
- Todas las llamadas van a `/api/admin` con `Authorization: Bearer <frase>`.

### Pestanas

- **Pedidos** — tabla de `biogradix_orders`, mas recientes primero, filtro por
  estado, chip de color por estado, productos, total y guia.
- **Inventario** — stock, reservado, disponible, umbral y valor a precio de
  venta por SKU (mas totales). Boton "Ajustar" por fila: delta (+/-), motivo
  (Restock / Muestra / Daño / Ajuste) y nota. Abajo, los ultimos 50
  movimientos de `biogradix_inventory_movements`.
- **Leads** — solo lectura de `biogradix_quiz_leads` con link de WhatsApp
  (mensaje pre-llenado; como el quiz no captura telefono, el link abre el
  selector de contacto de WhatsApp) y mailto por fila.

### Si una tabla de la Fase 1 aun no existe

Los endpoints no truenan: responden un error JSON tipado
(`missing_table`, HTTP 424) y el panel muestra el mensaje
"La tabla X no existe todavía en Supabase. Ejecuta primero el SQL de la Fase 1."

## 3. Ciclo de vida del pedido

```
paid  →  preparing  →  shipped  →  delivered
                (refunded / cancelled en cualquier punto, via API)
```

- **Pagado → Preparando**: boton "Preparar" en la fila (solo cambia el estado).
- **Preparando → Enviado**: boton "Enviar" abre el formulario de paqueteria +
  numero de guia. Al confirmar, `orders.markShipped`:
  1. pone `status = 'shipped'`, `shipped_at = ahora`, guarda paqueteria y guia;
  2. manda el correo de rastreo al cliente (ver abajo).
- **Enviado → Entregado**: boton "Entregado" (solo cambia el estado).
- Reembolsos/cancelaciones no tienen boton en el panel (son casos raros);
  se hacen con `orders.updateStatus` o directo en Supabase.

## 4. Correo de guia (mark-shipped)

- Remitente `Biogradix <protocolos@biogradix.com>`, BCC a `hello@biogradix.com`.
- Contenido: banda con paqueteria + numero de guia, tabla de datos de envio,
  contenido del pedido con total, direccion de entrega y boton de WhatsApp.
  Mismo estilo visual de la casa (bone/ink/forest, sin sombras, sin emojis).
- Idioma: ingles si el pedido trae `utm.lang = 'en'` (o `utm.language`, o
  `source` que indique `en`); espanol en cualquier otro caso.
- Si el correo falla, la guia YA quedo guardada: el panel avisa
  "Guía guardada, pero el correo no se envió". Se puede reintentar
  confirmando el envio otra vez (eso re-manda el correo).

## 5. Cron de inventario bajo

- `vercel.json` agenda `GET /api/cron-lowstock` con `"0 14 * * *"` UTC
  = 08:00 CDMX, diario.
- Revisa `biogradix_products` (solo `active = true`); si algun SKU tiene
  `stock <= low_stock_threshold`, manda UN correo a `hello@biogradix.com`
  con la lista (SKU, stock, umbral). Si no hay ninguno, no manda nada.
- El endpoint exige `Authorization: Bearer <CRON_SECRET>`; Vercel lo agrega
  automaticamente al invocar el cron. Para probarlo a mano:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://biogradix.com/api/cron-lowstock`
- Si la tabla de productos aun no existe, responde 200 con `skipped`
  (no marca el cron como fallido).
- El cron se activa cuando esta rama se deploya a produccion (los crons de
  `vercel.json` solo corren en el deployment de produccion).

## 6. TikTok Pixel (paso del dia del merge)

- El codigo base vive en `snippets/tiktok-pixel.html` y NO esta inyectado en
  ninguna pagina (las paginas de producto pertenecen a la rama de la Fase 1).
- El dia del merge, desde la sesion que controla el merge:
  1. Reemplazar `PIXEL_ID_PLACEHOLDER` por el Pixel ID real de TikTok Ads
     Manager.
  2. Pegar el bloque `<script>` completo justo antes de `</head>` en todas
     las paginas publicas (index, producto-*, quiz, blog*, tecnologia,
     educacion, contacto, gracias). No pegarlo en `admin.html`.
  3. Verificar con TikTok Pixel Helper que dispare `Pageview`.

## 7. Archivos de esta fase

| Archivo | Que hace |
|---|---|
| `admin.html` | Panel de operaciones (pedidos, inventario, leads) |
| `api/admin.js` | Endpoint unico gateado; router por `action` |
| `api/cron-lowstock.js` | Alerta diaria de inventario bajo |
| `snippets/tiktok-pixel.html` | Codigo base del pixel, para inyectar en el merge |
| `vercel.json` | Solo se agrego la entrada `crons` |
