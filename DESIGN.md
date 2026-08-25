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

### Named Rules

**The Poster and Manual Rule.** Barlow Condensed anuncia; Atkinson Hyperlegible explica y permite actuar. No se intercambian esos papeles en formularios o contenido largo.

## Layout

El escritorio usa una franja superior fija y una escena panorámica ultrawide. En pantallas estrechas se recorre horizontalmente el mismo garaje, conservando la profundidad y posición relativa de los cinco personajes y la recreativa.

Por encima de 1180px, la tesis ocupa una columna compacta y el garaje otra; por debajo, ambas se apilan. A 820px la escena conserva su escala narrativa en un lienzo de 1060px y se explora mediante desplazamiento horizontal con snap, en lugar de desmontar los personajes en tarjetas. Los dashboards pasan de dos columnas a una y ocupan toda la pantalla; a 520px se reducen paddings, se apilan métricas y se mantienen controles táctiles de al menos 42–48px.

El ritmo usa saltos cortos de 6–18px dentro de controles y bloques de 24–64px entre regiones. La densidad es deliberadamente operativa: el espacio libre separa tareas, no crea una estética de landing genérica.

### Named Rules

**The Same Garage Rule.** En móvil se recorre la misma escena integrada; no se recortan avatares para convertirlos en una lista de tarjetas.

## Elevation & Depth

La profundidad es híbrida. Las superficies grandes se separan con capas tonales y sombras ambientales oscuras; botones, tickets, etiquetas de puesto y la recreativa usan sombras desplazadas, duras y visibles que recuerdan piezas físicas montadas a mano. El desenfoque se limita a las etiquetas superpuestas sobre la escena.

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
