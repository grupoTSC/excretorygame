# The Excretory Wheel

Juego de rueda de letras sobre el aparato excretor para una exposición de 5.º de primaria.
Se juega en un iPad **sin conexión**, instalado como PWA desde GitHub Pages.

## Reglas fijas

1. **Interfaz 100 % en inglés británico.** Documentación y commits en español.
2. **Ningún recurso externo**: ni fuentes, ni CDN, ni analítica, ni peticiones de red. Todo lo que
   usa el juego está en el repositorio y en la lista `FILES` de `sw.js`.
3. **Sin compilación ni dependencias**: HTML, CSS y JavaScript planos en la raíz del repositorio.
4. **Rutas relativas** siempre (`./app.js`), porque GitHub Pages sirve el juego bajo `/excretorygame/`.
5. **Contenido**: solo riñones, uréteres, vejiga y uretra, a nivel de 5.º. Nada de piel ni pulmones.
   La rueda tiene 8 letras fijas (B E F H K R U W).
6. **Voz**: solo `en-GB` y siempre opcional. Si no hay voz británica, no se lee con otro acento.
7. Al cambiar cualquier fichero del juego, **subir `VERSION` en `sw.js`**; si no, los iPads ya
   instalados siguen con la copia antigua.
8. Es un juego original: no usar nombres, música ni imagen de concursos de televisión.

## Pruebas

```
node tests/check-words.js     # banco de palabras
node tests/e2e.js             # partida completa, sin conexión, voz y tamaños de pantalla
```

Las dos deben pasar antes de fusionar en `main`, que es la rama que publica GitHub Pages.
`tests/e2e.js` necesita Playwright con Chromium.
