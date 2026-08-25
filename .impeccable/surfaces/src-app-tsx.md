---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Garaje Kaam — superficie principal

- **Modo:** Operate con una entrada Experience; la escena atrae, los paneles permiten trabajar.
- **Audiencia y trabajo:** equipo interno de marketing que importa contactos, vigila respuestas y gestiona recontactos sin abrir n8n para cada acción.
- **Acción principal:** elegir un personaje/workflow para actuar cuando corresponda o, en El Bardo, observar el proceso automático sin intervenir.
- **Contenido verificable:** los estados y nombres técnicos se derivan del workflow n8n suministrado. Las métricas iniciales son datos de demostración.
- **Restricciones:** cinco caricaturas de referentes famosos; El Visionario toma como referencia moderada a Steve Jobs; Frida ocupa marketing; Chaplin queda sin función; dashboards temáticos pero coherentes; recreativa con dos minijuegos jugables; responsive y accesible.

## Dirección elegida

El garaje doméstico de una casa convertido en la primera oficina de la empresa. Cinco personajes, mesas, sombras, cableado, herramientas y recreativa forman una única ilustración panorámica: `src/assets/garage-integrated-five-jobs.png`. La composición usa primer plano, mesa central y puestos traseros en vez de alinear a los personajes. La escena es estática y no contiene vídeo, recortes ni rigs superpuestos. En móvil se recorre el mismo garaje a una escala moderada y un selector táctil de puestos permite abrir cualquier workflow sin depender de hotspots o estados hover.

El momento memorable es ver un lead recorrer físicamente las tres estaciones mientras el garaje sigue vivo. La máquina recreativa rompe la tensión operativa sin mezclarse con el control de campaña.

## Inventario de fidelidad

| Ingrediente | Medio | Compromiso |
| --- | --- | --- |
| Cabecera compacta y estado Demo | HTML/CSS | Marca a la izquierda, estado y selector a la derecha |
| Garaje y equipo integrados | Raster generado único | Puerta de casa, cajas, bicicleta, cinco personajes sentados, mesas, sombras y cable naranja en una sola imagen |
| Escena principal | PNG panorámico | Ilustración estática 21:9 sin vídeo ni capas de personaje |
| Hotspots de workflows | HTML/CSS transparente | Zonas accesibles sobre los puestos; solo muestran baliza y placa, nunca recortes de personaje |
| Selector móvil de puestos | React + CSS | Rejilla táctil bajo el panorama con los cuatro workflows y la recreativa; mantiene todos los destinos visibles incluso cuando el personaje está fuera del recorte horizontal |
| Recreativa | Parte del raster + React dialog | El cabinet pertenece físicamente a la escena y abre dos juegos al pulsarlo |
| Franja de telemetría | HTML/CSS | Estado, colas y excepciones; valores marcados como Demo |
| Accesos y sesión | React dialog + API Express/SQLite | El administrador abre desde la cabecera un CRUD responsive con búsqueda, roles y estados. La autenticación, autorización y sesión se resuelven en servidor con contraseñas derivadas, cookie HttpOnly y protección CSRF |
| Paneles de workflow | React dialog | Misma anatomía y materiales propios de cada personaje; El Visionario separa preparación, actividad e historial buscable, hace explícita la diferencia entre empresas seleccionadas y contactadas y permite desplegar sus incidencias de entrega; El Bardo separa ejecución e historial de conversaciones; Doc Bucle muestra una cola de recontactos con intervalo fijo de siete días y un historial buscable; el Taller Creativo de Frida separa creación y biblioteca visual, admite prompt y referencia, muestra una vista previa y prepara el relevo de una pieza aprobada hacia El Visionario |
| Biblioteca del Taller Creativo | React + raster generado | Tres visuales editoriales coherentes sirven como datos de demostración; cada registro conserva prompt, referencia y estado, puede buscarse, descargarse y reutilizarse como nueva referencia |
| Snake y bloques | Canvas | Jugables con teclado y controles táctiles; puntuación y reinicio |
| Textura de garaje | CSS + ruido ligero | Metal, papel, cinta y asfalto sin recurrir a glassmorphism |

## Decisiones abiertas

- Endpoints y contratos definitivos con n8n.
- Proveedor y contrato de generación visual, envío de revisión por correo, webhook de aprobación y mecanismo para marcar la imagen activa de El Visionario.
- Métricas y datos reales de producción.
