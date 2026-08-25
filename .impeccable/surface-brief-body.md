# Kaam Garage — superficie principal

- **Modo:** Operate con una entrada Experience; la escena atrae, los paneles permiten trabajar.
- **Audiencia y trabajo:** equipo interno de marketing que importa contactos, vigila respuestas y gestiona recontactos sin abrir n8n para cada acción.
- **Acción principal:** elegir un personaje/workflow y completar su siguiente acción operativa.
- **Contenido verificable:** los estados y nombres técnicos se derivan del workflow n8n suministrado. Las métricas iniciales son datos de demostración.
- **Restricciones:** tres caricaturas de referentes famosos con nombres funcionales; Trump debe ser inequívoco; dashboards temáticos pero coherentes; recreativa con dos minijuegos jugables; responsive y accesible.

## Dirección elegida

El garaje doméstico de una casa convertido en la primera oficina de la empresa. Personajes, mesas, sombras, cableado, herramientas y recreativa forman una única ilustración integrada: `src/assets/garage-integrated.png`. El hero reproduce un loop MP4 de ocho segundos derivado de ese mismo fotograma; la cámara, las luces y la señal del cable se animan sin separar ni superponer los personajes. En móvil se recorre la misma escena panorámica, no una recomposición de tarjetas.

El momento memorable es ver un lead recorrer físicamente las tres estaciones mientras el garaje sigue vivo. La máquina recreativa rompe la tensión operativa sin mezclarse con el control de campaña.

## Inventario de fidelidad

| Ingrediente | Medio | Compromiso |
| --- | --- | --- |
| Cabecera compacta y estado Demo | HTML/CSS | Marca a la izquierda, estado y selector a la derecha |
| Garaje y equipo integrados | Raster generado único | Puerta de casa, cajas, bicicleta, tres personajes sentados, mesas, sombras y cable naranja en una sola imagen |
| Escena viva | MP4 HyperFrames | Cámara cíclica, fluorescente, monitores, cronómetro, polvo y señal sobre el cable; el póster queda como fallback |
| Hotspots de workflows | HTML/CSS transparente | Zonas accesibles sobre los puestos; solo muestran baliza y placa, nunca recortes de personaje |
| Recreativa | Parte del raster + React dialog | El cabinet pertenece físicamente a la escena y abre dos juegos al pulsarlo |
| Franja de telemetría | HTML/CSS | Estado, colas y excepciones; valores marcados como Demo |
| Paneles de workflow | React dialog | Misma anatomía, materiales y microcopy propios de cada personaje |
| Snake y bloques | Canvas | Jugables con teclado y controles táctiles; puntuación y reinicio |
| Textura de garaje | CSS + ruido ligero | Metal, papel, cinta y asfalto sin recurrir a glassmorphism |

## Decisiones abiertas

- Endpoints, autenticación y contratos definitivos con n8n.
- Métricas y datos reales de producción.
