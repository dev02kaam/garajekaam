# Sesión y subidas de campañas — 30/09/2026

## Diagnóstico

La campaña `BBDD CLM.csv` no estaba registrada en los esquemas de FicharIA ni
DEKAAM. No había ninguna transacción de importación activa en la comprobación.
La versión publicada en Render sí incluía la importación de listas grandes y
ambos endpoints superaron la comprobación autenticada de configuración.

Se reprodujo un fallo en la versión publicada, usando API simulada y una lista
de prueba: ocultar la pestaña ejecutaba `lock()`, desmontaba `ProductsProvider`
y abortaba la subida. El importador del servidor revierte la transacción al
desconectarse el cliente, por lo que no queda una campaña parcial en el historial.
No se dispone de la traza de la subida original para atribuirle con certeza
ese mismo desencadenante.

## Corrección

`src/useSession.ts` mantiene el panel, sus borradores y la solicitud al cambiar
de pestaña o volver del selector de archivos. Las comprobaciones periódicas
pasan de cada 30 segundos a un máximo de una cada cinco minutos mientras la
sesión esté activa y la pestaña visible. Los eventos de foco no repiten una
verificación reciente; la pantalla de login no hace comprobaciones periódicas.

Un error transitorio de red o del servidor en una comprobación o renovación de
actividad conserva la sesión hasta su caducidad ya conocida. La renovación
fallida no alarga ese plazo. Se mantienen la validación del servidor en cada
operación, la caducidad de 30 minutos de inactividad y ocho horas absolutas,
los errores 401/CSRF, el cierre de sesión entre pestañas y el control al
restaurar una página desde la caché del navegador.

## Validación y publicación

- `npm run build`.
- `npm run test:sessions`: 4 pruebas.
- `npm run test:campaign-requests`: 13 pruebas.
- `npm run test:campaign-import`: 6 pruebas.
- Prueba de navegador con todas las rutas API interceptadas: cancelación en la
  versión anterior frente a conservación y finalización de la subida con el arreglo.

El arreglo está preparado en el proyecto local. Se debe publicar mediante el
despliegue manual habitual de Render y recargar el Garaje antes de volver a
subir CLM. No se han lanzado campañas de prueba ni reenviado mensajes reales.
Si el historial sigue sin contener CLM, repetir su importación con el mismo
producto e instrucción que se pretendían usar.
