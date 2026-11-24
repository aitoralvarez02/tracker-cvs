# Contrato de datos del CV

Este contrato es compartido por el CV Maker, el CV Hub y HTML Maker. Un cambio que lo rompa deja CVs ya guardados sin poder abrirse en alguna de las tres herramientas. Por eso todo cambio debe ser **aditivo**.

Código de referencia: `codigo-fuente/src/shared/core.js` (`emptyCV`, `normalize`, `clean`, `pick`, `leerCVs`, `urlOk`, `fotoOk`).

## 1. El archivo de un CV

Cada CV es un HTML autocontenido. Al guardar, el CV Maker se copia a sí mismo con los datos dentro, así que el archivo guardado también es el editor de ese CV:

- `<script type="application/json" id="cv-data">` contiene el JSON del CV.
- Los contenedores `[data-dinamico]` (`#app`, `#capas`) se guardan vacíos y se vuelven a pintar al abrir el archivo.
- `<html>` y `<body>` se guardan sin `data-tema`, sin `class` y sin `style`. El tema día/noche es una preferencia del navegador (`localStorage`), no del CV.
- `<title>`: `CV · <nombre> | KPMG`.
- Dentro del JSON, cada `<` se escribe como `<`. Así ningún texto puede cerrar la etiqueta `<script>`.

**Nombre de archivo estable:** `CV_` + las palabras del nombre sin tildes, con la primera letra en mayúscula y unidas por `_` + `.html`. Por ejemplo, «Ana Prueba Núñez» se guarda como `CV_Ana_Prueba_Nunez.html`.

## 2. El JSON

Es el mismo JSON que el de HTML Maker, con una clave opcional `meta` añadida.

| Clave | Tipo | Notas |
|---|---|---|
| `nombre` | texto | Obligatorio para guardar. Es igual en ES y en EN. |
| `cargo` | texto | |
| `empresa` | texto | Por defecto `KPMG España`. |
| `foto` | texto | Solo vale `data:image/(jpeg\|png\|webp\|gif);base64,…`. Con cualquier otro valor se pinta la foto genérica. El editor recorta la foto a 276×324 en JPEG. |
| `linkedin` | texto | Solo se pinta si es `http(s)://…`. |
| `tendencias` | texto | Artículo en KPMG Tendencias. Solo se pinta si es `http(s)://…`. |
| `insights` | texto[] | De 3 a 4 frases de resumen. No salen en el lienzo del CV, solo en el visor. |
| `formacion` | texto[] | Columna izquierda del CV. |
| `parrafo_azul` | texto | Presentación en azul. Los párrafos se separan con una línea en blanco. El primero va en negrita. Un párrafo que empieza por `- ` se pinta como viñeta. |
| `cuerpo` | bloque[] | Experiencia. Los tipos de bloque se describen debajo de esta tabla. |
| `en` | objeto | Versión inglesa de `cargo`, `empresa`, `insights`, `formacion`, `parrafo_azul` y `cuerpo`. Si un campo EN está vacío, se usa el español. |
| `meta` | objeto | Opcional y solo del CV Maker y el CV Hub. HTML Maker la ignora. |

Tipos de bloque de `cuerpo`:

- `{ "tipo": "parrafo", "texto": "…" }`: si el bloque siguiente es una lista, este párrafo hace de introducción y se pinta en negrita.
- `{ "tipo": "intro_lista", "texto": "…" }`: se pinta igual que `parrafo`.
- `{ "tipo": "bullet", "texto": "…" }`: es una viñeta suelta.
- `{ "tipo": "lista", "items": ["…", "…"] }`: cada elemento es una viñeta.
- Si el tipo es desconocido, el bloque se trata como `parrafo`.

En todos los textos, `**texto**` se pinta en negrita. El resto del contenido se escapa siempre como texto.

### `meta`

| Clave | Tipo | Notas |
|---|---|---|
| `schema` | número | Versión de este contrato. Ahora vale `1`. |
| `categoria` | texto | Se elige de una lista sugerida o se escribe libremente. |
| `oficina` | texto | Se elige de una lista sugerida o se escribe libremente. |
| `areas` | texto[] | Se eligen de una lista sugerida o se escriben libremente. Las vacías se quitan. |
| `actualizado` | `AAAA-MM-DD` | Se pone a la fecha de hoy en cada guardado. |

Las listas sugeridas son provisionales y están en `CATEGORIAS`, `OFICINAS` y `AREAS` de `core.js`.

## 3. Reglas al leer (`normalize`)

- La lectura es tolerante: los tipos incorrectos se convierten y los valores que faltan toman su valor por defecto.
- **Se conservan las claves desconocidas** del nivel superior, de `en` y de `meta`. Por ejemplo, `slides` del layout manual de HTML Maker no se pierde al guardar.
- Se aceptan tres formatos:
  - un HTML con `#cv-data`;
  - un JSON suelto, que puede venir rodeado de texto o de vallas ```` ``` ```` como en las respuestas de Copilot;
  - una lista de CVs, como `[…]` o `{ "cvs": […] }`.
- Cada CV debe tener la clave `nombre`.

## 4. Reglas al guardar (`clean`)

- Se recortan los espacios de `nombre`, `cargo`, `empresa` y `parrafo_azul`.
- Se quitan los elementos vacíos de las listas y los bloques vacíos de `cuerpo`.
- **Los campos EN vacíos se eliminan**. Si `en` se queda sin campos, también se elimina. Así HTML Maker no sustituye el texto español por un texto vacío.

## 5. Seguridad

- Un CV ajeno se lee solo con `DOMParser`, que no ejecuta scripts, y de él solo se extrae `#cv-data`. Nunca se ejecuta su HTML.
- Todo el texto se escapa antes de pintarse. La única marca que se interpreta es `**negrita**`.
- Solo se pintan los enlaces `http(s)` y las fotos `data:image/…;base64`.

## 6. Render

- El CV se pinta en un lienzo fijo de **1600×900** que se escala para caber en la pantalla.
- La formación empieza debajo de la persona y su letra baja de 16 px a 11 px si no cabe.
- La experiencia se ajusta así:
  1. Prueba 1 columna a 16 px.
  2. Si no cabe, prueba 2 columnas, de 16 px a 12 px en pasos de 0,5 px.
  3. Si tampoco cabe a 12 px, se marca `data-ajuste="no"` y el editor avisa.
- La versión EN usa los títulos *Experience* y *Education:* y el copyright en inglés.
