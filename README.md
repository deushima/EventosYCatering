# Sushi Libre

Sitio estático y responsive para la experiencia Sushi Libre de SushiClub Puerto Madero.

La fuente mantenible vive en Sass y TypeScript. `dist/` es la distribución estática completa y contiene todo lo necesario para ejecutar el sitio.

## Estructura

- `src/scss/breakpoints/_desktop.scss`: estilos completos de hero, dock y menú; constituye la base heredable.
- `src/scss/breakpoints/_tablet.scss`: modificaciones heredadas para tablet.
- `src/scss/breakpoints/_mobile.scss`: modificaciones finales para mobile.
- `src/scss/components/`: únicamente unidades reutilizables y acotadas, como botón, countdown, chips y visor de piezas.
- `src/ts/`: comportamiento TypeScript para layout, animaciones e interacción; no genera los campos del menú.
- `src/static/index.html`: plantilla HTML de producción con el marcador de compilación del menú.
- `menu.json`: fuente de desarrollo del menú; no se distribuye en producción.
- `scripts/menu-html.mjs`: valida `menu.json` y lo convierte en elementos HTML normales durante build y desarrollo.
- `dist/assets/`: única ubicación de imágenes, videos y archivos gráficos.
- `dist/assets/piezas/`: ubicación de las imágenes WebP abiertas por los botones `VER PIEZA`.
- `dist/`: sitio estático final con HTML, CSS, JavaScript y assets; no contiene `menu.json`.
- `tests/`: contratos funcionales tolerantes al formateo del HTML y validaciones estructurales del CSS compilado.

`src/scss/main.scss` carga desktop, luego tablet y finalmente mobile. No existe una capa separada de secciones: toda la estructura visual vive dentro de esos tres breakpoints. Las reglas de accesibilidad y capacidades del navegador se aplican después sin introducir breakpoints adicionales.

La raíz del repositorio redirige a `dist/`, que es también la ruta publicada por GitHub Pages.

## Datos e imágenes de las piezas

Cada producto de `piezas`, `niguiris`, `sashimis` y `geisha` debe declarar una propiedad `image` dentro de `menu.json`:

```json
{
  "name": "BUENOS AIRES",
  "description": "...",
  "image": "assets/piezas/buenos_aires.webp"
}
```

Las rutas deben comenzar con `assets/piezas/` y terminar en `.webp`. Las bebidas no llevan imagen ni botón. Durante el build, cada ruta se copia como atributo del botón estático correspondiente y un único modal reutilizable carga la imagen seleccionada.

## Desarrollo

Requiere Node.js 22.

```bash
npm ci
npm run dev
```

El servidor queda disponible en `http://127.0.0.1:4173`.

Durante `npm run dev`:

- los cambios de SCSS se recompilan y se aplican sin recargar la página;
- los cambios de TypeScript se recompilan y recargan la página automáticamente;
- cada cambio en `menu.json` regenera los elementos del menú dentro de `dist/index.html` y recarga la página;
- los cambios de la plantilla o los assets recargan la página automáticamente.

## Verificación antes de subir cambios

Ejecutá el mismo comando que usa GitHub Actions:

```bash
npm run verify
```

Ese comando realiza, en orden, typecheck, limpieza de archivos generados, build estático y todos los tests. Los contratos de HTML no dependen de comillas, indentación o saltos de línea, por lo que formatear la plantilla no genera falsos errores.

Para revisar el sitio compilado:

```bash
npm run serve
```

`npm run build` valida `menu.json`, genera categorías, productos, chips, botones y el modal como DOM estático dentro de `dist/index.html`, elimina cualquier `dist/menu.json` residual y compila un `app.js` sin cargador ni renderer de datos del menú.

`npm run clean` elimina solamente los archivos generados y preserva `dist/assets/`.

## Integración continua

`.github/workflows/build.yml` instala exactamente las versiones de `package-lock.json` mediante `npm ci` y ejecuta `npm run verify`. Sólo hay una ejecución por push en `refactor/sass-typescript`; los commits automáticos que contienen únicamente cambios en `dist/` no vuelven a disparar Actions.
