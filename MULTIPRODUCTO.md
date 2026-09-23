# Garaje Kaam multiproducto

Ficharia mantiene sus adaptadores y datos actuales. **DECA · Una app de Kaam**
permite organizar su biblioteca de imágenes y preparar borradores de campaña y
creatividad. Sus campañas, respuestas, seguimientos, generación y envío de
revisiones muestran «Bajo construcción» y están bloqueados en servidor hasta
completar la información y la configuración de DECA.

Ficharia conserva sus arreglos de campañas y del formulario. Temporalmente,
`links.video_demo` y `links.personalized_demo` comparten
https://youtu.be/WpOQs9Bdn94. Estos enlaces públicos del catálogo coinciden con
el AUTOSUFICIENTE y el seguimiento de `flujoficharia`; no se aplican a DECA.

## Catálogo y selección

`shared/products.mjs` es el catálogo mantenido exclusivamente en código. Define
`ficharia` (`active`) y `deca` (`preparing`) con las mismas capacidades que usa
`flujoficharia` al generar sus JSON. `server/products.mjs` añade la configuración
interna de esquemas y prefijos. No existen operaciones HTTP para crear productos.

`GET /api/products` requiere autenticación y devuelve `{ products: ProductSummary[] }`.
El tipo frontend está en `src/productContext.ts`. Todos los usuarios autenticados
pueden seleccionar ambos productos; cada carga o nueva sesión empieza en Ficharia.

El selector del garaje y el de la cabecera común de los paneles usan un único
`ProductsProvider`. Cambiar de producto conserva personaje/panel y pestaña,
reinicia filtros y detalles, cancela consultas anteriores y descarta resultados
tardíos. Los usuarios y la recreativa continúan siendo generales.

Los borradores de cada producto guardan en memoria instrucciones, CSV, referencia
y correo de revisión. Sobreviven al cierre del panel y al cambio de producto.
Se eliminan al recargar, cerrar sesión o perder acceso; no usan localStorage,
sessionStorage ni persistencia del servidor. Durante subidas, sustituciones y
peticiones que escriben o envían, ambos selectores quedan temporalmente bloqueados.

Se conservan la estética y los controles existentes. DECA tiene identidad textual,
sin nuevas marcas, imágenes ni colores propios. Sus paneles vacíos no muestran
campañas, conversaciones o creatividades de demostración de Ficharia.

## API de producto

El cliente `createWorkflowApi(productId, signal, beginMutation)` requiere un
producto explícito. Las operaciones y URLs de archivos/miniaturas se construyen
bajo `/api/products/:productId/workflows/...`. `/api/workflows/...` conserva el
adaptador Ficharia como compatibilidad.

| Ruta relativa | Ficharia | DECA |
| --- | --- | --- |
| `GET /jobs`, `/campaigns`, `/conversations`, `/followups`, `/creatives` | Lectura PostgreSQL actual | Listas vacías, `configured: false`, `status: preparing` |
| `GET /config` | Configuración del webhook actual | `campaignWebhookConfigured: false` |
| `/campaign-images` y archivos | Biblioteca Ficharia | Biblioteca DECA |
| `POST /campaigns/launch` | Cliente n8n actual | 503 `PRODUCT_NOT_READY` |
| Comandos de generación/revisión DECA | Integración del Taller pendiente | 503 `PRODUCT_NOT_READY` |

Un producto desconocido devuelve 404 `PRODUCT_NOT_FOUND`, sin usar Ficharia.
Un `product_id` explícito en el cuerpo JSON que contradiga la ruta devuelve 400
`PRODUCT_ID_MISMATCH`. Las operaciones DECA no habilitadas se rechazan antes de
llamar a n8n. Las sesiones, el control de origen y CSRF siguen protegiendo el API.

La disponibilidad de capacidad expresa lo que permite el producto; la conexión
de cada módulo mantiene su estado propio. El Taller de Ficharia conserva su
prototipo de vista previa y su integración pendiente con n8n. No se ha activado
la conexión entre Taller Creativo y biblioteca de imágenes de campañas.

## Biblioteca de imágenes

La migración autoritativa es
[`migrations/001_deca_campaign_email_assets.sql`](migrations/001_deca_campaign_email_assets.sql).
`flujoficharia` referencia y prueba este mismo archivo, sin definir otra tabla.

| Producto | Esquema | Tabla | Prefijo |
| --- | --- | --- | --- |
| Ficharia | `FICHARIA_DATABASE_SCHEMA` (habitualmente `public`) | `campaign_email_assets` | `ficharia-campana-` |
| DECA | `garaje_deca` | `campaign_email_assets` | `deca-campana-` |

Se reutiliza el gestor de imágenes con esquema y prefijo validados. Cada
biblioteca dispone de capacidad, duplicados SHA-256, selección, revisiones y
cachés independientes. Los mismos bytes pueden existir en ambos productos;
identificadores de otro producto no permiten leer ni modificar su archivo.

Contrato bajo `/api/products/:productId/workflows/campaign-images`:

| Método y sufijo | Operación |
| --- | --- |
| `GET /` | Metadatos de biblioteca |
| `POST /` | Multipart `image`; subida inactiva o duplicado existente |
| `PATCH /:id` | JSON `{active, revision}`; selección para futuras campañas |
| `PUT /:id` | Multipart `image`, `revision`; sustituye y conserva selección |
| `GET /:id/file` | Original; `?download=1` descarga, `?thumbnail=1` miniatura |

Se mantienen los límites: 100 imágenes, 10 MB por archivo, PNG/JPEG/WebP estáticos,
25 megapíxeles y 10.000 px por lado. El original se conserva y Sharp genera las
miniaturas. Las revisiones impiden sobrescribir un cambio ajeno. La biblioteca
DECA tiene restricciones y trigger de versiones propios.

Si falta el almacenamiento DECA, su biblioteca devuelve `available: false`;
jamás carga imágenes de Ficharia. Seleccionar una imagen no habilita campañas ni
envíos. El estado preparado se conserva para su activación futura.

## Configuración y despliegue posterior

### Campañas grandes y continuidad laboral

La política `shared/campaign-policy.mjs` se comparte con los perfiles de Ficharia
y DECA del generador. Admite CSV de hasta 10.000 contactos y 10 MB. Los contactos
seleccionados se conservan en una cola que trabaja de lunes a viernes, de 10:00 a
17:00 en Europe/Madrid, y continúa el siguiente día laborable hasta terminar.
La cola ya no descarta contactos cuando se llenan las fechas iniciales del prompt.

El máximo configurado es 150 intentos por hora móvil y buzón de Ficharia,
compartidos con respuestas y seguimientos. La separación mínima es de 30 segundos,
por lo que el ritmo efectivo máximo ronda 120/h, menos el tiempo de transporte.
La cola se conserva entre jornadas y no repite entregas ambiguas. Los cuatro
flujos existentes de n8n se actualizaron el 23/09/2026; el acta y la reversión
están en `../flujoficharia/docs/PRODUCCION_2026-09-23.md`. Esta publicación no
despliega automáticamente el frontend/backend del Garaje.
DECA comparte la política preparada, pero continúa bloqueado hasta tener su
adaptador, remitente y credenciales; nunca envía a través de Ficharia.

La petición del navegador espera hasta 150 segundos; el servidor espera 120 a
la confirmación de n8n. Un error de una operación se muestra en su panel sin
invalidar la sesión. Los 401/CSRF, la pérdida de conexión del navegador y las
comprobaciones de sesión fallidas siguen retirando las vistas privadas.
El mismo CSV e instrucción conservan un `campaign_id` entre reintentos mientras
viva el borrador, para aprovechar la deduplicación de n8n. Una confirmación
perdida aparece como pendiente de revisión, sin reintento automático.

Para la continuidad laboral, aplicar también
`flujoficharia/sql/012_kaam_campaign_business_queue.sql` antes de importar el
workflow actualizado. La migración no reenvía entregas históricas ni reactiva
contactos que quedaron anteriormente en `capacity_exhausted`.

Prueba del cliente: `npm run test:campaign-requests`. La prueba de 4.140 contactos
del generador usa exclusivamente la base local desechable `kaam_bulk_test`.

1. Respaldar la base y la versión actual de la aplicación.
2. Aplicar primero la migración aditiva con la configuración del destino:

   ```powershell
   npm run db:products
   ```

   Es idempotente y no modifica tablas operativas de Ficharia. Usar un rol de
   migración; el rol del servidor necesita acceso a `garaje_deca` y su tabla.
3. Ejecutar `npm run build` y `npm run lint`, desplegar servidor y frontend de
   esta misma versión y comprobar el catálogo autenticado y ambas bibliotecas.
4. Conservar `N8N_PROSPECTING_WEBHOOK_URL` o `N8N_BASE_URL`/ruta actuales para
   Ficharia. El valor por defecto sigue siendo `/webhook/ficharia/campanas`.
   Esta ampliación del Garaje no necesita publicar ni cambiar workflows n8n.

La entrega coordinada de `flujoficharia` incluye JSON inactivos y una migración
aditiva de contexto Ficharia (`011`). Su actualización se prepara por separado;
consultar [su procedimiento](../flujoficharia/docs/MULTIPRODUCTO.md).

`deca@kaam.es` es el buzón previsto. La contraseña no figura en el proyecto.
La oferta/política comercial, el remitente efectivo, firma, conexiones y
automatizaciones DECA siguen pendientes. No basta con cambiar una capacidad:
la activación requiere implementar su adaptador, credenciales y validación.

Para revertir el Garaje, restaurar la versión anterior de servidor y frontend.
Conservar el esquema DECA y sus imágenes; las migraciones son aditivas y la
versión anterior las ignora. No borrar datos para revertir esta ampliación.

## Pruebas

Build, lint y las 4 pruebas de sesión pasan. Con PostgreSQL 16 desechable pasan
las 14 pruebas de imágenes existentes, 12 de seguimiento y 5 multiproducto.
La prueba multiproducto exige explícitamente una base local `kaam_products_test`
con las migraciones Ficharia instaladas; no usa `DATABASE_URL` ni `.env`.

```powershell
$env:PRODUCTS_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/kaam_products_test'
npm run test:products
```

La suite crea datos de prueba y vacía la biblioteca DECA de esa base desechable.
No apuntarla a un almacén que se quiera conservar. La preparación reproducible
y todas las suites se describen en
[VALIDACION_MULTIPRODUCTO.md](../flujoficharia/docs/VALIDACION_MULTIPRODUCTO.md).

Pruebas en navegador realizadas en escritorio y móvil: selección compartida,
navegación y teclado, borradores separados al cambiar/cerrar panel, subida con
selector bloqueado, consulta antigua cancelada y respuesta tardía ignorada,
limpieza al recargar/cerrar sesión/perder acceso y ausencia de demos DECA.
No se han aplicado migraciones al servidor real, publicado workflows ni enviado
correos.
