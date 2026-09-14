# PostgreSQL compartido

Garaje Kaam usa la misma base PostgreSQL que los workflows de Ficharia, pero separa responsabilidades por esquema:

- `public`: tablas, funciones y vistas operativas de Ficharia.
- `garaje_kaam`: usuarios y sesiones de la aplicación.

Al arrancar, el servidor crea de forma idempotente `garaje_kaam.users` y `garaje_kaam.user_sessions`. Si la tabla de usuarios está vacía, las variables `KAAM_INITIAL_ADMIN_*` crean una única cuenta administradora bajo un bloqueo transaccional.

## Fuente de verdad

El dashboard lee historiales y estados mediante la API propia y consultas PostgreSQL parametrizadas, acotadas y dirigidas a las vistas de Ficharia. Si una migración operativa aún no está desplegada, la API devuelve `available: false` para ese módulo en vez de fallar toda la aplicación.

Vistas utilizadas:

- `ficharia_conversation_lead_inbox`
- `ficharia_outbound_campaign_status`
- `ficharia_weekly_followup_status`
- `ficharia_creative_library`
- `ficharia_dashboard_jobs`

En el entorno conectado, conversaciones, campañas, seguimiento y jobs ya están desplegados. Las tablas/vista del Taller Creativo siguen pendientes; hasta entonces su endpoint informa `available: false`.

Los webhooks de n8n siguen siendo necesarios para comandos que inician trabajo o adjuntan archivos. No se usan para replicar al dashboard cada cambio de estado.
El lanzamiento de campañas usa el webhook `POST /webhook/ficharia/campanas`: puede configurarse mediante la URL completa o combinando `N8N_BASE_URL` con `N8N_PROSPECTING_WEBHOOK_PATH`.

## Seguimiento semanal de Doc Bucle

`GET /api/workflows/followups` combina el historial de `ficharia_weekly_followup_status` con una proyección de candidatos desde conversaciones, correos, leads y bajas. La consulta es de solo lectura: no crea jobs ni ejecuta el trabajador. Un candidato aparece antes de vencer y también después de un seguimiento enviado, mientras continúe siendo elegible. Las respuestas en cualquier hilo del contacto y las bajas se reflejan en cada consulta.

`FICHARIA_FOLLOWUP_START_AFTER` debe coincidir con `start_after` del flujo; el valor predeterminado es el 11/09/2026 a las 00:00 de Madrid. La proyección de revisiones está alineada con el disparador de los lunes a las 10:00, usa `Europe/Madrid` para respetar cambios de hora y distingue vencimiento de revisión prevista. Si cambia el disparador en n8n, debe actualizarse también `server/followups.mjs` y el texto del panel. Las fechas no certifican que el flujo esté publicado ni garantizan una plaza en su lote de diez.

El límite se aplica a conversaciones completas, después de agrupar el historial. El contador solo incluye jobs con estado `sent` y fecha de envío. El panel refresca cada 15 segundos mientras está visible y conserva la última consulta con un aviso explícito si falla la conexión.

Las pruebas `npm run test:followups` requieren `FOLLOWUP_TEST_DATABASE_URL` apuntando a un PostgreSQL desechable. Crean únicamente tablas y una vista temporales en una conexión independiente; no leen `DATABASE_URL`. Cubren candidatos, bajas, respuesta en otro hilo, reintentos, estados, historial, orden y cambios de hora.

## Configuración

La URL real solo debe existir en `.env` o en el gestor de secretos del despliegue. `.env.example` contiene únicamente el contrato de variables. En producción deben configurarse `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN` y las opciones SSL.

Comandos de diagnóstico sin datos personales:

```sh
npm run db:inspect
npm run db:state
```

Después del primer arranque se recomienda retirar `KAAM_INITIAL_ADMIN_PASSWORD` del entorno: el bootstrap no vuelve a ejecutarse mientras exista algún usuario.
