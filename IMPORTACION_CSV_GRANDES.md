# Importación de listas grandes

El formulario admite CSV UTF-8 de hasta **100 MB y 1.000.000 de filas**, tanto
para Ficharia como para DEKAAM. Los nombres de columna determinan el significado,
independientemente de su orden. `Empresa` y `Email` se reconocen junto a sus
aliases; el resto de columnas se conserva para la selección por la instrucción.
Las celdas conservan el límite anterior de 1.000 caracteres.

La lectura y el recuento se realizan en un Web Worker por bloques de 64 KB,
sin cargar todo el texto en el hilo de la interfaz. Incluye progreso y cancelación.
Se reconocen coma, punto y coma, tabulador, campos entrecomillados y saltos de
línea dentro de campos. El resumen descarta correos inválidos, duplicados y bajas.

## Registro y ejecución

Las listas de hasta 10 MB y 10.000 filas mantienen la entrada actual de n8n.
Las mayores usan `POST /api/products/:productId/workflows/campaigns/import`
(también `/api/workflows/campaigns/import` para Ficharia). Requiere sesión,
CSRF, UUID de campaña e instrucción; admite un archivo y como máximo dos
importaciones simultáneas por proceso del servidor.

El servidor guarda la subida en una carpeta temporal privada, valida el archivo
completo y registra los contactos en bloques de 500 dentro de **una transacción**.
Reutiliza `ficharia_campaign_enqueue` para el primer bloque y su configuración
de producto, sin cambiar las reglas de envío. Un error revierte todos los bloques;
ningún contacto queda visible ni puede enviarse hasta confirmar la transacción.
La carpeta temporal se elimina tanto al terminar como al fallar. Una desconexión
antes del commit cancela y revierte la importación; si el proceso se reinicia,
PostgreSQL revierte la transacción abierta y se puede repetir la solicitud.

Un hash del archivo completo, producto e instrucción y un bloqueo por UUID
impiden duplicar campañas en reintentos. Reutilizar el UUID con otro contenido
devuelve 409. La deduplicación de direcciones es **por campaña**; subir de nuevo
la misma lista con un UUID nuevo crea otra campaña.

Tras el commit, n8n recibe únicamente el ID de campaña y un ticket de un solo
uso a través de `/webhook/ficharia/campanas/recuperar` o
`/webhook/dekaam/campanas/recuperar`. El CSV y los cientos de miles de contactos
no pasan por su webhook. La campaña mantiene el plan, segmentación por lotes,
horarios, cuotas, bajas y controles de entrega existentes.

Si n8n no confirma el inicio, el API devuelve 202 con `startup_pending: true`:
la campaña ya está guardada. El ticket pendiente y su reserva permiten que
la recuperación externa vuelva a recogerla cuando caduque la reserva (15 min).
No se reintenta el transporte de correo ni se crea otra campaña automáticamente.

## Despliegue

- Desplegar frontend y servidor de esta misma versión. El campo de correo de
  acceso y el resto de cambios previos se conservan.
- La base debe tener las migraciones existentes hasta **025**, en los esquemas
  de los productos operativos, y n8n sus entradas autenticadas de recuperación.
  No se añade una migración ni se cambia el JSON del workflow en esta entrega.
- Se necesitan las variables existentes de PostgreSQL, URL de n8n y
  `N8N_WEBHOOK_AUTH_TOKEN`. Mantener activa la recuperación externa descrita en
  `RECUPERACION_CAMPANAS.md`. No exponer ese token al navegador.
- `shared/campaign-ingestion-config.json` contiene únicamente configuración no
  secreta, extraída de los nodos de registro de los workflows. Los generadores
  de Ficharia y DEKAAM en `flujoficharia` la actualizan durante la generación.
  La política compartida actual sobrescribe las cuotas y horarios al importar.
- Servidor y navegador conceden hasta 15 minutos a una importación. Si existe
  un proxy adicional, debe permitir cuerpos multipart de 100 MB más sus campos
  y ese tiempo de respuesta. El almacenamiento temporal necesita espacio para
  dos archivos de hasta 100 MB. Un reinicio abrupto puede dejar temporales hasta
  que el sistema limpie su directorio temporal; nunca son campañas parciales.

## Validación

`npm run test:campaign-import` verifica streaming, comillas, Unicode, aliases,
recuentos, límites, autenticación, CSRF, aislamiento, subida a disco y limpieza.
`npm run test:campaign-requests` comprueba la selección de ruta y los plazos.

La prueba SQL exige `BULK_TEST_DATABASE_URL` en localhost y base
`kaam_bulk_test`; no carga `.env`. `LARGE_CSV_TEST_FILE` permite probar un archivo
real exclusivamente en esa base desechable:

```powershell
node scripts/test-campaign-import-database.mjs
```

Se comprobó `BBDD CLM.csv` (68.698.434 bytes): **352.293 filas, 352.274 contactos
registrados y 19 correos inválidos**, en una sola campaña local, sin llamar a IA
ni SMTP. También se comprobaron reintentos idempotentes, contenido contradictorio,
rollback tras un fallo de almacenamiento, el ticket de inicio de un solo uso y
el aislamiento de los dos productos. `BBDD Comunidad Valenciana.csv` tenía el
mismo SHA-256 que `BBDD CLM.csv`: eran archivos idénticos al realizar la prueba.
