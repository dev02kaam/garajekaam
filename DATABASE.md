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

## Configuración

La URL real solo debe existir en `.env` o en el gestor de secretos del despliegue. `.env.example` contiene únicamente el contrato de variables. En producción deben configurarse `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN` y las opciones SSL.

Comandos de diagnóstico sin datos personales:

```sh
npm run db:inspect
npm run db:state
```

Después del primer arranque se recomienda retirar `KAAM_INITIAL_ADMIN_PASSWORD` del entorno: el bootstrap no vuelve a ejecutarse mientras exista algún usuario.
