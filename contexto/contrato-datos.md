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
| `foto` | texto | Solo vale `data:image/(jpeg\|png\|webp\|gif);base64,…`. Con cualquier otro valor se pinta la foto genérica. Una ruta (p. ej. `../../assets/maestro-cvs/fotos-equipo/X.jpg` de HTML Maker) se conserva al guardar hasta que se sustituya, y el editor avisa al abrir el CV de que hay que subir la foto. El editor recorta la foto a 276×324 en JPEG. |
| `linkedin` | texto | Solo se pinta si es un enlace `http(s)://…` válido (ver «Seguridad»). Si no lo es, se guarda vacío. |
| `tendencias` | texto | Artículo en KPMG Tendencias. Mismas reglas que `linkedin`. |
| `insights` | texto[] | De 3 a 4 frases de resumen. No salen en el lienzo del CV, solo en el visor. |
| `formacion` | texto[] | Columna izquierda del CV. |
| `parrafo_azul` | texto | Presentación en azul. Los párrafos se separan con una línea en blanco. El primero va en negrita. Un párrafo que empieza por `- ` se pinta como viñeta. |
| `cuerpo` | bloque[] | Experiencia. Los tipos de bloque se describen debajo de esta tabla. |
| `en` | objeto | Versión inglesa de `cargo`, `empresa`, `insights`, `formacion`, `parrafo_azul` y `cuerpo`. Si un campo EN está vacío, se usa el español. Puede llevar `slides` (ver abajo). |
| `slides` | objeto | Layout del modo slides de HTML Maker para «Ver CV completo». Lo escribe el CV Maker al guardar (ver «`slides`» más abajo). |
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

### `slides` (y `en.slides`)

Es el formato de HTML Maker (`cv-equipo.js`, «Modo slides»):

```
{ base, bloques: [{ html, attrs, x, y, w, h }], lineas: [{ dir, x, y, l }], formacion?: { base, html, attrs }, columna?: { formacion } }
```

HTML Maker usa `slides` si `base` es la firma del texto actual. Si no, rehace solo el primer bloque con todo el texto y deja los demás, así que un CV de 2 columnas saldría con el texto repetido. Por eso el CV Maker, **al guardar** (también al descargar o exportar el JSON), hace esto (`prepararSlides` en `core.js`):

- **Firma**: la de HTML Maker. `firma(v)` es djb2 sobre `JSON.stringify(v)`, con el formato `(h>>>0).toString(36) + '.' + longitud`. `firmaExperiencia` firma `[parrafo_azul, cuerpo]` y `firmaFormacion` firma `formacion`. Se calcula sobre los datos ya limpios, que son los que se guardan.
- **Si `slides.base` coincide** con la firma del texto actual, `slides` se conserva tal cual: se respeta el layout manual hecho en HTML Maker. El CV Maker sigue pintando con su ajuste automático.
- **Si no coincide o no hay `slides`**, se regenera para que HTML Maker muestre lo mismo que el CV Maker:
  - 1 columna: un bloque `x 0, y 0, w 1140` con el alto de la zona (unos 642 px), y `lineas: []`.
  - 2 columnas: dos bloques de `w 538` en `x 0` y `x 602` (64 px entre ellos), con el alto de su texto, y una línea `{ dir: "v", x: 562, y: -10, l: alto + 20 }` (10 px por encima y por debajo del texto más alto). El corte es el del CV Maker: entre párrafos o viñetas, y nunca entre la frase que presenta una lista y su primera viñeta. Si la columna derecha empieza por una viñeta, esta lleva `--vin-arriba: 0px`.
  - `html`: los párrafos con las clases de `experienciaInicial` (`cv-exp-p`, `cv-exp-p--azul`, y `cv-exp-p--punto txt-vin` con `data-vin="flecha" style="--vin-c: #00338D;"`) y todo el texto escapado. Cada párrafo que no es viñeta lleva su hueco inferior en `style="--fmt-despues: Npx;"` (16 px entre párrafos, 26 px tras el párrafo azul), porque HTML Maker deja 0 px entre párrafos.
  - `attrs`: siempre `data-fmt-inter: "1.15"`, el interlineado «1,15» de HTML Maker (1,362 × 1,15). Si la letra baja de 16 px, también `data-hero-tam` y `style: "--hero-n: N;"`.
  - Columna azul: `columna: { formacion: top }` solo si la formación no empieza en 388 px (cargo largo), y `formacion: { base, html, attrs }` con `data-hero-tam` solo si su letra baja de 16 px. Si no, no se escriben. Lo manual anterior de la columna azul se pierde, igual que el de los bloques.
- **EN**: `en.slides` se trata igual con el texto inglés (la firma usa `en.parrafo_azul` y `en.cuerpo`, o el español si faltan), pero solo si hay experiencia EN propia (`en.parrafo_azul` o `en.cuerpo`). Sin ella, HTML Maker usa el `slides` español. Si hubiera un `en.slides` que ya no coincide, se quita para que no repita texto.
- Guardar dos veces seguidas da el mismo `slides`.

Medidas comprobadas en el editor de HTML Maker (build del 19-11-2026): zona de 1144×643 en `x 400, y 184` del lienzo, bloques de 1140 o 538+64+538, línea de 16 px de caja en `x 562` y formación en `top 388`. Para repetir la comprobación con los 25 CVs de muestra: `node herramientas/comparar-html-maker.js <carpeta> [--fotos]` desde `codigo-fuente/`. Mide cada párrafo, la línea y la formación en los dos y da la mayor diferencia (ahora 0,4 px).

## 3. Reglas al leer (`normalize`)

- La lectura es tolerante: los tipos incorrectos se convierten y los valores que faltan toman su valor por defecto.
- **Se conservan las claves desconocidas** del nivel superior, de `en` y de `meta`. `slides` y `en.slides` se conservan si su firma coincide; si no, se regeneran al guardar (ver «`slides`»).
- Se aceptan tres formatos:
  - un HTML con `#cv-data`;
  - un JSON suelto, que puede venir rodeado de texto o de vallas ```` ``` ```` como en las respuestas de Copilot;
  - una lista de CVs, como `[…]` o `{ "cvs": […] }`.
- Cada CV debe tener la clave `nombre`.

## 4. Reglas al guardar (`clean`)

- Se recortan los espacios de `nombre`, `cargo`, `empresa` y `parrafo_azul`.
- Se quitan los elementos vacíos de las listas y los bloques vacíos de `cuerpo`.
- `linkedin` y `tendencias` que no sean un enlace válido se guardan vacíos, y el editor avisa.
- **Los campos EN vacíos se eliminan**. Si `en` se queda sin campos, también se elimina. Así HTML Maker no sustituye el texto español por un texto vacío.

## 5. Seguridad

- Un CV ajeno se lee solo con `DOMParser`, que no ejecuta scripts, y de él solo se extrae `#cv-data`. Nunca se ejecuta su HTML.
- Todo el texto se escapa antes de pintarse. La única marca que se interpreta es `**negrita**`.
- Solo se pintan las fotos `data:image/…;base64` y los enlaces que pasan `urlOk`: empiezan por `http://` o `https://`, `new URL` los acepta con un host, y no llevan comillas (`"`, `'`, `` ` ``), `<`, `>`, espacios ni caracteres de control. Hace falta porque HTML Maker escribe `linkedin` y `tendencias` dentro de `href="…"` sin escapar.

## 6. Render

- El CV se pinta en un lienzo fijo de **1600×900** que se escala para caber en la pantalla.
- La formación empieza debajo de la persona y su letra baja de 16 px a 11 px si no cabe.
- La experiencia se ajusta así:
  1. Prueba 1 columna a 16 px.
  2. Si no cabe, prueba 2 columnas, de 16 px a 12 px en pasos de 0,5 px.
  3. Si tampoco cabe a 12 px, se marca `data-ajuste="no"` y el editor avisa.
- El texto mide 1140 px de ancho (dos columnas de 538 px con 64 px entre ellas), con el interlineado 1,566 (el «1,15» de HTML Maker) y las negritas del color del párrafo, como HTML Maker en slides.
- La línea entre columnas empieza 10 px por encima del texto y acaba 10 px por debajo de la columna más alta.
- La versión EN usa los títulos *Experience* y *Education:* y el copyright en inglés.
