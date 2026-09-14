# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegado por el usuario: React, Vite y TypeScript, elegidos para combinar una escena interactiva rica con paneles operativos mantenibles y una integración posterior sencilla con n8n.

## Users

Equipo interno de marketing y operaciones comerciales que necesita lanzar, vigilar y entender automatizaciones de prospección por correo sin entrar continuamente en el editor técnico de n8n.

## Product Purpose

Convertir varios workflows de marketing en un espacio de trabajo visual: importar contactos, iniciar campañas, atender respuestas interesadas, reactivar conversaciones y preparar piezas promocionales. El éxito consiste en que el equipo sepa qué está haciendo cada automatización, pueda actuar sobre ella y detecte excepciones desde una única interfaz.

## Positioning

Los workflows no aparecen como diagramas abstractos, sino como personajes que trabajan juntos dentro de un garaje de startup. Los puestos activos funcionan como puerta de entrada a su dashboard especializado y hacen comprensible el reparto de responsabilidades de la automatización.

## Operating Context

- Tres workflows de n8n ya definidos: prospección desde CSV, respuesta a interesados y seguimiento periódico de conversaciones sin respuesta. El Taller Creativo cuenta ya con su experiencia frontend, a la espera del contrato de generación, revisión por correo y aprobación en n8n.
- El workflow de referencia existente contiene operaciones reales de IMAP, PostgreSQL, análisis y borrador mediante IA, esperas humanas, transporte SMTP/relay, bajas, revisión manual y auditoría operativa.
- PostgreSQL es la fuente de verdad compartida: el dashboard consulta directamente las vistas seguras de Ficharia para historiales y estados. Los webhooks de n8n se reservan para comandos que inician trabajo, como lanzar una campaña o solicitar una creatividad.

## Capabilities and Constraints

- El acceso se gestiona en el esquema PostgreSQL aislado `garaje_kaam`, dentro de la misma base que Ficharia. Los administradores disponen en la cabecera de un CRUD de usuarios con búsqueda, roles Administrador/Operador, activación, revocación de sesiones y borrado protegido. Las contraseñas nunca se guardan en el navegador ni en texto plano; la sesión usa una cookie `HttpOnly`, protección CSRF y caducidad deslizante de ocho horas.
- Garaje panorámico con cinco avatares integrados: cuatro puestos de trabajo y un quinto personaje ambiental todavía sin función.
- Panel emergente especializado por personaje/workflow.
- El primer panel separa tres tareas en pestañas: preparar el CSV y la instrucción, seguir la actividad en curso y consultar un historial de campañas con buscador. El CSV puede ser una base grande y heterogénea; el prompt determina qué segmentos se seleccionan y en qué días y franjas se contactan. Cada campaña conserva ambos, distingue empresas del CSV, seleccionadas, contactadas y sin contactar, y muestra el calendario ejecutado por segmento junto con respuestas e interés. La diferencia entre seleccionadas y contactadas abre un detalle de incidencias por empresa, destinatario, segmento, momento y causa; el buscador también encuentra esos datos.
- El panel de El Bardo es exclusivamente de observación y separa dos vistas: la ejecución activa a ancho completo y un historial de conversaciones agrupado por cliente y dirección de correo. El historial permite buscar, contar los correos entrantes de cada conversación y consultar el recorrido individual de cada correo. El workflow opera de forma completamente automática y no ofrece edición ni acciones manuales.
- Doc Bucle supervisa conversaciones con un intercambio real y una respuesta enviada por El Bardo. La revisión ocurre los lunes a las 10:00 de Madrid, con un mínimo de siete días sin respuesta y hasta diez seguimientos por ejecución. El panel muestra también candidatos que aún no han vencido, ordena las próximas revisiones y se actualiza cada 15 segundos mientras está visible. Las fechas son previsiones condicionadas a la publicación y capacidad del flujo. El historial distingue respuestas, cierres, preparación, envío, fallos y entregas sin confirmar; solo cuenta recontactos confirmados como enviados.
- El Taller Creativo permite redactar un prompt, adjuntar una referencia PNG/JPG/WebP de hasta 10 MB, preparar una vista previa visual de demostración y dejar una revisión por correo lista para su conexión con n8n. Separa creación y biblioteca; el historial es buscable y conserva prompt, referencia, estado e identificador, además de permitir descargar o reutilizar cualquier pieza como punto de partida.
- La aprobación futura deberá convertir una pieza en la imagen activa que El Visionario incluye en sus correos promocionales. El frontend explica ese relevo, pero no simula que el correo, la generación ni la activación hayan ocurrido realmente.
- Debe ser responsive, accesible por teclado y usable con movimiento reducido.
- No se inventarán métricas comerciales reales; toda métrica inicial se etiqueta como demostración.

## Brand Commitments

- Nombre provisional autorizado por delegación creativa: **Garaje Kaam**.
- Tono cómico y friki, con estética caricaturesca adulta.
- Cinco personajes caricaturescos basados en figuras famosas; los nombres funcionales definitivos se decidirán más adelante.
- **El Visionario** debe ser una caricatura reconocible, pero moderada, de Steve Jobs y ocuparse de la prospección desde CSV e instrucción escrita.
- **El Bardo** debe ser una caricatura reconocible de William Shakespeare, elegido como referente universal de elocuencia y escritura, y ocuparse de responder a los interesados.
- El reparto evita referentes políticos y se equilibra con figuras tecnológicas, culturales, artísticas y científicas.
- **Doc Bucle** debe ser una caricatura reconocible de Albert Einstein y ocuparse de los recontactos periódicos con una temática de relatividad y tiempo.
- El cuarto puesto, dedicado a imágenes y promociones de marketing, usa una caricatura reconocible de Frida Kahlo y abre el Taller Creativo con generación visual, revisión y biblioteca.
- El quinto personaje usa una caricatura reconocible de Charlie Chaplin y permanece como puesto inactivo, sin hotspot ni dashboard de momento.
- Cada dashboard adopta la temática material y verbal de su personaje sin alterar los patrones de interacción compartidos.
- El espacio debe ser inequívocamente el garaje corriente de una casa reconvertido en primera oficina: puerta seccional, estanterías domésticas, cajas, bicicleta, herramientas, mesas y ordenadores improvisados. No debe parecer un box de rally, taller profesional, almacén o showroom.
- Los avatares trabajan sentados en puestos improvisados y deben sentirse más caricaturescos que retratos literales para mantener una distancia paródica clara.
- El garaje contiene una máquina recreativa antigua clicable con minijuegos jugables, empezando por Snake y un juego de bloques descendentes.

## Evidence on Hand

- Workflow n8n de referencia: `C:\Users\USER\Desktop\Archivos_ABS\VisualStudio\flujoficharia\workflow\Ficharia _ AUTOSUFICIENTE _ IA guiada + espera 65-120 s terminado.json`.
- La base PostgreSQL real contiene actualmente conversaciones, auditoría, campañas, seguimiento semanal y la vista unificada de jobs. El módulo creativo todavía depende de desplegar su migración operativa antes de mostrar datos reales.

## Product Principles

- Personificar para explicar: cada automatización debe entenderse por lo que hace su personaje.
- Lo divertido abre la puerta; la información operativa manda dentro del dashboard.
- Mostrar siempre estado, próxima acción y excepciones.
- Separar con claridad datos de demostración y datos reales.
- Leer estado e historial desde PostgreSQL y usar n8n solo como capa de ejecución para comandos, sin duplicar estado mediante webhooks de notificación.

## Accessibility & Inclusion

Navegación completa por teclado, foco visible, contraste suficiente, objetivos táctiles amplios, etiquetas comprensibles y respeto de `prefers-reduced-motion`.
