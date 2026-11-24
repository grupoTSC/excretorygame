# The Excretory Wheel

Juego de rueda de letras, en inglés, sobre el aparato excretor (riñones, uréteres, vejiga y
uretra) para una exposición de 5.º de primaria. Funciona en un iPad sin conexión a internet.

**Dirección del juego:** https://grupotsc.github.io/excretorygame/

## Cómo se juega

1. Elige el tiempo (2 min, 3 min o sin tiempo) y pulsa **Start**.
2. Lee la pista a la clase. Cada pista indica si la palabra empieza por la letra
   («Starts with B») o si la contiene («Contains the letter H»).
3. La clase responde en voz alta. **Show answer** enseña la respuesta solo a quien lleva el iPad.
4. Marca **Correct**, **Wrong** o **Pass**. Las letras pasadas vuelven a salir al dar la vuelta.
5. Al terminar aparece el repaso de las 8 palabras.

Otros botones: **Undo** deshace la última marca, **New wheel** reparte otra rueda,
**Sound** activa o quita los sonidos y **Read aloud** hace que el iPad lea las pistas con voz
británica (está apagado por defecto).

Si sales de la app o se bloquea la pantalla, el reloj se pone en pausa y la partida se conserva.

## Instalar en el iPad

Hazlo uno o dos días antes de la exposición.

1. Con conexión, abre https://grupotsc.github.io/excretorygame/ en **Safari**.
2. Espera a que arriba aparezca **Ready: now add to Home Screen**.
3. Pulsa Compartir → **Añadir a pantalla de inicio**.
4. Abre el juego desde el icono nuevo, todavía con conexión, y espera a **Ready to play offline**.
   Este paso es imprescindible: en el iPad, la pestaña de Safari y la app de la pantalla de
   inicio guardan copias separadas, y la que cuenta es la de la app.
5. Activa el **modo avión**, cierra el juego del todo (deslízalo fuera en el selector de apps),
   ábrelo de nuevo desde el icono y juega una partida completa.

Después no borres los datos de Safari ni la app de la pantalla de inicio.

El día de la exposición:

- Pon Ajustes → Pantalla y brillo → **Bloqueo automático → Nunca**, para que la pantalla no se
  apague a mitad de partida. Si se bloquea, el juego queda en pausa y no se pierde nada.
- Los sonidos del juego no se oyen si el iPad está en **modo silencio**; sube también el volumen.
- Respuestas equivalentes que conviene dar por buenas: «urinary tract» por «urinary system».

Si **Read aloud** aparece como «no UK voice», el iPad no tiene una voz británica instalada:
Ajustes → Accesibilidad → Contenido leído → Voces → Inglés → descarga una voz de Reino Unido.

Requiere iPadOS 15 o posterior (recomendado 16 o posterior).

## Publicación (GitHub Pages)

El juego se publica desde la rama `main`, carpeta raíz: Settings → Pages → «Deploy from a branch».
Con el plan gratuito de GitHub, Pages exige que el repositorio sea público.

Cuando el iPad haya pasado la prueba en modo avión se puede desactivar Pages y volver a poner el
repositorio privado: el juego instalado sigue funcionando. A partir de ese momento no se puede
actualizar ni reinstalar sin volver a publicarlo.

## Cambiar las palabras

Las palabras y las pistas están en `words.js`. Después de cambiarlo:

1. Ejecuta `node tests/check-words.js`.
2. Sube el número de `VERSION` en `sw.js` (por ejemplo de `v1` a `v2`).
3. Publica el cambio en `main`.
4. En el iPad, abre el juego con conexión, ciérralo del todo desde el selector de apps y vuelve a
   abrirlo: la copia nueva aparece en la segunda apertura.

## Pruebas

```
node tests/check-words.js
node tests/e2e.js
```

La segunda necesita Playwright con Chromium y comprueba una partida completa, el fin por tiempo,
la recuperación de una partida a medias, el funcionamiento sin conexión, la lectura en voz alta y
el encaje en distintos tamaños de pantalla.
