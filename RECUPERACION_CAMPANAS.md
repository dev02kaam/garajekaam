# Recuperación de campañas — 30 de septiembre de 2026

La aplicación comprueba una vez por minuto la base de datos. Las comprobaciones
no llaman a ningún workflow. Una campaña activa cuyo propietario y reservas hayan
caducado puede obtener un ticket único y arrancar una ejecución de recuperación.
Las campañas sanas siguen dentro de su ejecución; se respetan las pausas, el
horario laboral, las bajas y los límites existentes de cada buzón.

FicharIA usa `public` y DEKAAM `garaje_deca`. Los propietarios anteriores quedan
bloqueados. Una entrega que llegó a SMTP pero no tiene confirmación no se reenvía
automáticamente. Los intentos excepcionales se limitan a tres por hora y seis en
24 horas por campaña para evitar bucles y consumo descontrolado.

## Subida manual a Render

Subir el proyecto LabKaam actualizado al servicio
`https://garajekaam.onrender.com` mediante vuestro procedimiento habitual.
Incluye `server/campaign-recovery.mjs` y la modificación de `server/index.mjs`.
El repositorio también incorpora `scripts/test-campaign-recovery.mjs`.

Usa las variables del servicio ya configuradas para la integración:

- `DATABASE_URL` y sus opciones SSL habituales.
- `N8N_BASE_URL=https://kaam.app.n8n.cloud`, o bien
  `N8N_PROSPECTING_WEBHOOK_URL` con el mismo origen.
- `N8N_WEBHOOK_AUTH_TOKEN`: la credencial de integración existente. No introducir
  contraseñas del correo ni copiarlas al repositorio.

No requiere `N8N_API_KEY` ni un programador en n8n. Se activa al iniciar el servidor.
Si falta el origen o el token queda desactivado. Para desactivarlo expresamente:
`KAAM_CAMPAIGN_RECOVERY_ENABLED=false`.

Con una sesión iniciada, abrir `/api/campaign-recovery/status`: debe mostrar
`enabled: true`; después del primer minuto `lastPollAt` debe avanzar y `lastError`
debe ser `null`. Este endpoint requiere autenticación y no devuelve credenciales.
El servicio debe permanecer en ejecución: un servicio Render dormido no realiza
comprobaciones hasta que vuelve a arrancar. Las campañas ya activas en n8n
continúan independientemente de estas comprobaciones.

Pruebas locales: `node --test scripts/test-campaign-recovery.mjs` y `npm run build`.
La migración SQL 025 y los webhooks de recuperación deben estar instalados en
producción. La aplicación omite los esquemas que aún no tienen esa migración.
