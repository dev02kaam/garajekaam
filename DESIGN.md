---
name: "Garaje Kaam"
description: "Cinco personajes caricaturescos comparten una primera oficina improvisada dentro de un garaje doméstico."
colors:
  ink: "#0b1115"
  night-surface: "#0e171d"
  paper: "#f3efe4"
  paper-dim: "#c9c3b5"
  orange-cable: "#ff5c1a"
  orange-deep: "#b93408"
  deal-yellow: "#f3c94b"
  relay-teal: "#58d9b2"
  bardo-lilac: "#d6adf2"
  arcade-purple: "#a979d8"
  danger: "#ff8576"
  focus: "#fff1a8"
  # Variantes locales de la pestaña Imágenes de El Visionario.
  campaign-ink: "#101416"
  campaign-ink-hover: "#353a3c"
  campaign-preview-paper: "#f8f6f0"
  campaign-muted: "#635b4e"
  campaign-border: "#8e887c"
  campaign-focus: "#665119"
  campaign-active: "#1c6547"
  campaign-error: "#943522"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 5.4vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Atkinson Hyperlegible, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Atkinson Hyperlegible, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  none: "0"
  circle: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.deal-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "48px"
  status-chip:
    backgroundColor: "transparent"
    textColor: "{colors.relay-teal}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
  card-dark:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "24px"
  input-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "14px"
  campaign-upload:
    backgroundColor: "{colors.campaign-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  campaign-upload-hover:
    backgroundColor: "{colors.campaign-ink-hover}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  campaign-action:
    backgroundColor: "transparent"
    textColor: "{colors.campaign-ink}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  campaign-filter-selected:
    backgroundColor: "{colors.campaign-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
---

# Design System: Garaje Kaam

## Overview

**Creative North Star: "El Garaje de Guardia"**

Garaje Kaam convierte la operación invisible de varios workflows en una primera oficina doméstica ocupada por cinco caricaturas. El mundo mezcla herramientas, cartón, cables, fluorescentes y monitores improvisados con caricatura adulta: cómico y friki, pero siempre legible y operativo.

La escena integrada es la puerta de entrada; los controles se descubren sobre el espacio en vez de competir con él. Al abrir un puesto, cada personaje cambia el material y el vocabulario de su dashboard, mientras la estructura de interacción permanece estable para que el humor nunca oculte la siguiente acción.

**Key Characteristics:**

- Garaje doméstico cinematográfico, no taller profesional ni showroom.
- Tipografía condensada, frontal y de alto contraste para la voz de taller.
- Superficies cuadradas con bordes visibles y sombras físicas desplazadas.
- Un color funcional por puesto, con naranja como cable conductor del sistema.
- Movimiento ambiental continuo, breve en la interfaz y prescindible para operar.

## Colors

La paleta parte de una noche azul-negra y papel envejecido; los acentos parecen luz eléctrica, cinta de señalización y pantallas encendidas.

### Primary

- **Naranja de Alargador:** marca rutas activas, navegación seleccionada, llamadas de entrada y energía en la escena.
- **Naranja Quemado:** sostiene numeración, estados de advertencia y sombras cromáticas sin competir con el acento vivo.

### Secondary

- **Marfil de Lanzamiento:** identifica a El Visionario y mantiene CSV, prompt e historial en una superficie sobria de ordenador clásico.
- **Franja Retro:** una línea multicolor muy fina introduce su referencia tecnológica sin usar logotipos ni competir con el estado operativo.
- **Lila de Manuscrito:** identifica a El Bardo, su cola de respuestas y los estados de selección editorial.
- **Púrpura de Recreativa:** reserva el cambio de tono para KAAMCADE y sus controles de juego.

### Tertiary

- **Verde de Relé:** comunica sistema activo, éxito y continuidad temporal; también identifica a Doc Bucle.

### Neutral

- **Tinta de Garaje:** fondo raíz y texto sobre superficies claras.
- **Chapa Nocturna:** barra superior y superficies operativas elevadas.
- **Papel de Taller:** texto principal oscuro y franjas de relevo claras.
- **Papel Gastado:** texto secundario y metadatos.
- **Rojo de Incidencia:** errores de archivo o proceso.
- **Luz de Foco:** contorno accesible de teclado.

### Campaign Images

La pestaña Imágenes prolonga el papel y la tinta de El Visionario. Sus variantes locales conservan esa misma familia: Tinta de campañas sostiene texto, subida y filtro seleccionado; Papel de previsualización separa cada imagen del fondo. El texto secundario y el trazo de los controles usan tonos cálidos apagados. El foco oscuro sobre papel conserva contraste en esta superficie clara; Imagen en uso e Incidencia sobre papel acompañan siempre a una etiqueta o mensaje. Estas variantes pertenecen a la biblioteca de campañas.

### Named Rules

**The Cable Conductor Rule.** El naranja conecta la experiencia y señala entrada o actividad; los colores de personaje no deben reemplazarlo en la navegación global.

**The One Station, One Accent Rule.** Dentro de un dashboard se usa un único acento temático dominante sobre la estructura compartida.

## Typography

**Display Font:** Barlow Condensed (con Arial Narrow y sans-serif como respaldo)  
**Body Font:** Atkinson Hyperlegible (con Arial y sans-serif como respaldo)  
**Label Font:** Atkinson Hyperlegible

**Character:** La combinación junta titulares de cartel industrial con lectura funcional y accesible. Barlow Condensed concentra energía y humor; Atkinson Hyperlegible mantiene claros formularios, métricas y mensajes.

### Hierarchy

- **Display:** peso fuerte, caja alta y ritmo muy compacto; se reserva para la tesis del garaje y frases-personaje.
- **Headline:** encabezados de modal y títulos de panel, todavía condensados pero menos dominantes.
- **Title:** métricas, nombres de puesto y encabezados internos cortos.
- **Body:** instrucciones, mensajes y datos operativos; los párrafos de explicación se mantienen alrededor de 32–48 caracteres por línea cuando la composición lo permite.
- **Label:** estados, cejas, chips y metadatos en negrita, con espaciado abierto y caja alta cuando actúan como señalética.

En Imágenes, el encabezado conserva Barlow Condensed (2.2rem, interlineado 1.1; 2rem hasta 500px). Las instrucciones, nombres de archivo y acciones usan Atkinson Hyperlegible; los controles son compactos (0.9rem, peso 700). Los contadores y tamaños de archivo usan cifras tabulares. El nombre se abrevia con puntos suspensivos en la galería y admite salto de línea en el detalle.

### Named Rules

**The Poster and Manual Rule.** Barlow Condensed anuncia; Atkinson Hyperlegible explica y permite actuar. No se intercambian esos papeles en formularios o contenido largo.

## Layout

El escritorio usa una franja superior fija y una escena panorámica ultrawide. En pantallas estrechas se recorre horizontalmente el mismo garaje, conservando la profundidad y posición relativa de los cinco personajes y la recreativa.

Hasta 1180px, y también en dispositivos táctiles o sin hover de cualquier anchura, los cuatro puestos y la recreativa tienen accesos visibles bajo la escena. El selector usa dos columnas con filas de altura acotada; en horizontal desde 900px, cinco columnas. En pantallas horizontales de hasta 600px de alto se coloca junto a la panorámica para mantener accesibles los controles. La composición permite desplazamiento vertical si falta altura o aumenta el texto.

La misma ilustración se representa una sola vez. En móvil mide hasta 1,65 veces el ancho visible, con un máximo de 720px; en tablet vertical hasta 1180px mide 1,25 veces el ancho visible. Un aviso de desplazamiento aparece solo cuando la escena desborda, y el contenedor admite las flechas del teclado. Al girar a horizontal desde 600px de ancho se muestra la panorámica completa. Los botones superiores miden 44px y los accesos a puestos, al menos 64px de alto (44px en la lista lateral de pantallas bajas). En móvil, ampliar el texto convierte automáticamente el selector a una columna. Los dashboards ocupan toda la pantalla hasta 820px, o hasta 1180px cuando la altura no supera 600px; fuera de ese tramo respetan los márgenes del diálogo.

El ritmo usa saltos cortos de 6–18px dentro de controles y bloques de 24–64px entre regiones. La densidad es deliberadamente operativa: el espacio libre separa tareas, no crea una estética de landing genérica.

La galería de Imágenes ocupa el ancho del panel de El Visionario, debajo de sus pestañas compartidas. Su secuencia es cabecera y subida, explicación del alcance, zona de arrastre, filtros con búsqueda y colección. La cuadrícula usa tres columnas con separaciones de 26px por 22px, dos columnas hasta 760px y una hasta 500px. En ese último tramo, la cabecera se apila, la subida ocupa el ancho disponible, los filtros forman su propia fila y el contenido conserva 18px de margen interior. Las miniaturas tienen 175px de alto en escritorio y 220px hasta 500px; la imagen completa se contiene sin recorte. El detalle combina una vista amplia y una columna de acciones; hasta 760px se apilan, igual que la revisión de sustitución.

### Named Rules

**The Same Garage Rule.** En móvil se recorre la misma escena integrada; no se recortan avatares para convertirlos en una lista de tarjetas.

El selector de producto comparte la barra superior y las cabeceras de los dashboards. Hasta 640px, la barra admite salto de línea y el selector ocupa una fila completa; dentro del dashboard, la cabecera también admite salto y conserva el cierre junto al selector. En ese tramo, su etiqueta sigue disponible para tecnologías de asistencia aunque se oculte visualmente dentro del dashboard.

## Elevation & Depth

La profundidad es híbrida. Las superficies grandes se separan con capas tonales y sombras ambientales oscuras; botones, tickets, etiquetas de puesto y la recreativa usan sombras desplazadas, duras y visibles que recuerdan piezas físicas montadas a mano. El desenfoque se limita a las etiquetas superpuestas sobre la escena.

Dentro de Imágenes, la profundidad se resuelve con papel de distintos tonos, divisores finos y bordes de control. La galería y sus acciones permanecen planas; el marco del dashboard conserva la profundidad compartida del sistema.

### Shadow Vocabulary

- **Techo suspendido** (`0 12px 30px rgba(0, 0, 0, 0.32)`): mantiene la barra superior por delante del mundo.
- **Marco cinematográfico** (`0 26px 60px rgba(0, 0, 0, 0.42), 10px 12px 0 #05080a`): contiene la escena sin separarla de la página.
- **Panel de trabajo** (`16px 18px 0 rgba(0, 0, 0, 0.4)`): da peso físico a los dashboards en escritorio.
- **Acción mecánica** (`5px 6px 0` con el tono oscuro del tema): refuerza botones y tickets sin recurrir a gradientes brillantes.

### Named Rules

**The Built, Not Floating Rule.** La sombra debe parecer soporte o distancia física; no se usan brillos SaaS difusos para decorar superficies neutras.

## Shapes

El sistema es cuadrado por defecto: paneles, botones, entradas, chips, navegación y cartuchos mantienen esquinas rectas y bordes visibles. Los círculos se reservan para personas, numeración de puesto, estado vivo y metáforas temporales; esa excepción hace que cada círculo sea informativo.

Los marcos usan líneas finas claras sobre fondos oscuros y líneas oscuras sobre papel. Las siluetas inclinadas aparecen como gesto puntual —la marca ajedrezada, un icono de carga o una reacción al hover— y nunca deforman el texto funcional.

### Named Rules

**The Square Workshop Rule.** Si un componente no representa identidad, estado o tiempo, conserva esquinas rectas.

## Components

### Buttons

- **Shape:** placa rectangular sin radio, altura mínima de 48px en acciones principales.
- **Primary:** fondo sólido con el acento del puesto, texto Tinta de Garaje, borde de 2px y sombra desplazada oscura.
- **Hover / Focus:** el hover cambia borde, color o desplazamiento en 2–3px; el foco siempre conserva un contorno Luz de Foco de 3px con separación de 3px.
- **Secondary / Ghost:** fondo transparente, borde temático y texto del mismo acento; no compite con la acción principal.

### Chips

- **Style:** señalética compacta, sin radio, borde de 1px, icono pequeño y texto de etiqueta en negrita.
- **State:** el color procede del puesto o del estado; nunca se usa un chip sin significado operativo.

### Cards / Containers

- **Corner Style:** recto.
- **Background:** Chapa Nocturna para operación global; papel, pergamino, verde pizarra o púrpura para el mundo de cada personaje.
- **Shadow Strategy:** desplazamiento duro en paneles accionables; capas tonales en listas y telemetría.
- **Border:** entre 1px y 2px, visible pero secundario al contenido.
- **Internal Padding:** 14–24px en elementos y 28–72px en zonas editoriales grandes.

### Inputs / Fields

- **Style:** fondo claro, trazo temático de 2px, esquinas rectas y texto oscuro; la zona CSV usa un borde discontinuo de 2px sobre fondo oscuro.
- **Focus:** contorno global accesible y cambio de borde temático.
- **Error / Disabled:** el error usa Rojo de Incidencia sobre una superficie granate oscura; los controles deshabilitados bajan a 45% de opacidad y conservan su etiqueta.

### Navigation

La navegación superior usa icono, texto corporal y una línea inferior naranja de 3px para el estado activo. En móvil se convierte en un menú vertical bajo la barra, sin cambiar colores, tamaños de toque ni jerarquía.

### Agent Station

Cada puesto es una zona transparente sobre la escena con un beacon circular numerado y una placa inferior. Hover y foco revelan la descripción mediante `transform`, intensifican el color del puesto y mantienen visible la caricatura integrada.

### Dashboard Modal

Los dashboards comparten marco, cabecera fija, cierre, trampa de foco y comportamiento responsive. El tema cambia el acento, el material interior y la voz —trato, manuscrito, creatividad o relatividad— sin alterar patrones de acción.

### Product Context

El selector nativo **Producto** muestra Ficharia y **DECA · Una app de Kaam**, con una única selección compartida por el garaje y todos los dashboards. Reutiliza papel sobre superficie nocturna, borde fino y geometría recta; su altura mínima es de 44px. El foco usa Luz de Foco con contorno de 2px separado 3px. Durante una operación de escritura se deshabilita al 65% de opacidad, conserva el valor visible y anuncia «Guardando…».

La disponibilidad aparece debajo de la cabecera del dashboard como una franja nocturna con nombre de producto, «Pendiente de configuración» y explicación de las tareas disponibles. Es un estado informativo anunciado, acompañado por restricciones reales en las acciones. Carga de catálogo y fallo recuperable tienen mensajes separados; el error ofrece «Volver a intentar».

**The Shared Product Context Rule.** El nombre seleccionado identifica el contexto de trabajo en todos los puestos; el estado y las acciones disponibles se explican con texto. DECA conserva identidad textual y no introduce otro logotipo, color de marca ni tema de personaje.

### Campaign Images

La biblioteca compartida aparece como cuarta pestaña de El Visionario. Reutiliza la cabecera y navegación del dashboard, incluidas flechas, Inicio y Fin para cambiar de pestaña con el teclado.

- **Controles:** botones y enlaces cuadrados, altura mínima de 44px, borde fino y texto en negrita. Subir imágenes y el filtro seleccionado usan tinta sólida con texto de papel; las acciones restantes tienen fondo transparente. El hover cambia el tono del fondo. El foco local usa un contorno oscuro de 3px separado 3px; los controles deshabilitados conservan su etiqueta al 55% de opacidad.
- **Subida:** el botón de cabecera y Elegir archivos abren el selector local. El área de arrastre usa papel claro y borde discontinuo; al arrastrar cambia a borde continuo, contorno oscuro y papel cálido. Formatos, límite de tamaño y «Se guardan sin activar» permanecen junto a la acción. El botón de cabecera anuncia «Subiendo imágenes…» o «Guardando…» durante la operación; los resultados de cada archivo se muestran como lista legible, con estados escritos y mensajes de error.
- **Exploración:** Todas, En uso y Sin usar conservan contadores visibles; la selección combina fondo oscuro y estado accesible. El buscador por nombre y la actualización comparten su fila. Cada pieza reúne una miniatura completa, Ampliar siempre visible, nombre, estado, tamaño y acciones de uso y descarga. Un divisor inferior organiza la colección sin encerrar cada pieza en otra tarjeta.
- **Estado y alcance:** En uso combina texto verde con un punto; Sin usar mantiene texto secundario. Una explicación antes de la colección hace visible que la lista es compartida y que los cambios afectan a los próximos envíos, incluidas las campañas en marcha. Los mensajes de confirmación nombran el efecto de activar, retirar o sustituir. Al bloquear la retirada de la última activa, el detalle explica cómo continuar.
- **Detalle y sustitución:** ampliar cambia el contenido dentro del mismo panel y ofrece Volver a la galería; el foco pasa a ese control y vuelve a la miniatura cuando la galería está montada. Si la pieza deja de coincidir con la búsqueda, el foco vuelve al buscador. La imagen se presenta completa, con el nombre legible y las acciones de uso, descarga y sustitución al lado. La sustitución se revisa en un bloque de papel con imagen nueva, efecto sobre los envíos, indicación de descargar el archivo anterior y acciones explícitas de confirmar o cancelar.
- **Estados de servicio:** carga, biblioteca vacía, filtro sin resultados, almacenamiento no disponible y error de carga tienen mensajes distintos y una siguiente acción cuando corresponde. Si falla una miniatura, el mensaje conserva las opciones de descargar o sustituir. Confirmaciones y errores se anuncian a las tecnologías de asistencia.

### Access Management

La cabecera reserva un botón cuadrado con icono de persona para administración. Su diálogo mantiene el lenguaje del garaje: listado nocturno a la izquierda, editor de papel a la derecha y naranja para altas y selección. En móvil ambas zonas se apilan dentro de un único flujo vertical. Los roles y estados se muestran con texto además de color; desactivar y eliminar son acciones separadas, y el borrado exige confirmación explícita.

### Arcade Cartridge

Los cartuchos combinan mini-pantalla pixelada, título condensado y microcopy. Al pasar el puntero se desplazan 2px y endurecen su sombra; los juegos mantienen controles de teclado y botones táctiles en pantalla.

### Motion & Media

La escena principal es una única ilustración panorámica estática. Los cinco personajes, muebles, cables y recreativa pertenecen al mismo raster; no se usan vídeos, recortes, rigs ni animaciones sobre las figuras. Las transiciones de interfaz duran normalmente 160–260ms y la entrada de panel usa opacidad, traslación, escala y recorte.

## Do's and Don'ts

### Do:

- **Do** mantener a personajes, muebles, cables y recreativa dentro de una única escena coherente.
- **Do** mostrar estado, siguiente acción y excepciones con texto, no solo con color.
- **Do** conservar el mismo armazón de modal, foco y controles aunque cambie la temática del personaje.
- **Do** usar sombras desplazadas, bordes francos y tipografía condensada para sostener el carácter de taller.
- **Do** etiquetar como demostración cualquier métrica que aún no proceda de n8n.

### Don't:

- **Don't** convertir el garaje doméstico en un box de competición, un taller profesional, un almacén o un showroom.
- **Don't** superponer retratos recortados sobre un fondo ni separar los puestos en tarjetas genéricas.
- **Don't** redondear sistemáticamente paneles, botones, campos o chips.
- **Don't** introducir otra tipografía decorativa o una paleta pastel SaaS que diluya la señalética del garaje.
- **Don't** depender del vídeo, de un hover o de una animación para revelar una acción indispensable.
