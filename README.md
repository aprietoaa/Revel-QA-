# Revel – Tests E2E (Playwright)

Tests end-to-end para **driverevel.com**: login, listado de coches, filtros y selección. Incluye gestión de cookies para reutilizar sesión y evitar repetir login/captcha.

**Inicio rápido:** `npm install` → `npm run test`. Para forzar login desde cero: `npx tsc && npm run clean:cookies && npm run test`.

---

## Prerrequisitos

- **Node.js** (v18 o superior recomendado)
- **npm**
- **Google Chrome** instalado (los tests usan `channel: 'chrome'`)
- Para `clean:cookies`: que exista `dist/` (ejecutar `npx tsc` si no lo has compilado antes; el script usa `node dist/tests/utils/delete-cookies.js`)

Ejecutar los tests desde una **terminal** (Terminal.app, iTerm, etc.) suele dar mejor resultado que desde el IDE, sobre todo para lanzar Chrome y para pausas con ENTER (`STEP_BY_STEP`).

---

## Cómo ejecutar

### Instalación

```bash
npm install
```

### Ejecutar todos los tests

```bash
npm run test
```

- Ejecuta los 3 specs con 1 worker.
- Por defecto el navegador se abre en modo visible (`headless: false`).
- Si existen cookies guardadas en `tests/fixtures/cookies.json`, los tests que requieren sesión las reutilizan; si no, hacen login (teléfono + OTP).

### Ejecutar solo el test de coches (paso 3)

```bash
npm run test:cars
```

### Ejecutar solo el paso 3 sin cookies (login + coches desde cero)

Para lanzar únicamente el test “Ver todos los coches” pero forzando login desde cero (sin usar cookies guardadas):

```bash
npx tsc          # solo si dist/ no existe
npm run clean:cookies
npm run test:cars
```

Así el flujo hace login (teléfono + OTP) y luego el test de coches; al terminar se guardan cookies para la próxima vez.

### Borrar cookies y forzar login completo (los 3 tests)

Para simular “primera vez” y que el flujo pase por login + OTP (y captcha manual si aplica):

```bash
npx tsc
npm run clean:cookies
npm run test
```

`clean:cookies` elimina `tests/fixtures/cookies.json`. La siguiente ejecución de tests guardará nuevas cookies al completar el login.

### Variables de entorno opcionales

| Variable | Uso |
|----------|-----|
| `STEP_BY_STEP` | Si `1`/`true`/`yes`, pausa con “Pulsa ENTER” en checkpoints (solo tiene efecto con terminal interactiva). |
| `KEEP_OPEN_SECONDS` | Segundos que se mantiene la página abierta al final del test de coches (por defecto 20). |
| `KEEP_OPEN_MODE` | Modo de espera al final (`manual` / `timer`). |
| `DEBUG_SELECTORS` | `1`/`true` para logs de depuración de selectores. |
| `BRAND_LOCATOR`, `BRAND_TESTID`, `VIEW_ALL_BRANDS_LOCATOR` | Overrides para filtro de marca. |
| `BRAND_OPEL_LOCATOR` / `BRAND_OPEL_TESTID` | Overrides para opción “Opel”. |
| `EXCHANGE_TYPE_LOCATOR`, `EXCHANGE_TYPE_OPTION_LOCATOR`, etc. | Overrides para filtro tipo de cambio. |
| `FIRST_CAR_LOCATOR`, `CAR_LIST_TESTID`, `CAR_CARD_TESTID` | Overrides para listado y primera ficha de coche. |

### Credenciales (teléfono y OTP)

En este proyecto el **número de teléfono** y el **OTP** de prueba están definidos en código (`tests/config/constants.ts`) y son **visibles** en el repositorio. Esto sirve para ejecutar los tests en local de forma sencilla, pero **no es la forma correcta** desde el punto de vista de seguridad: lo adecuado sería no commitear credenciales y mantenerlas fuera del código.

En un **pipeline o CI** (GitHub Actions, GitLab CI, etc.) las credenciales deberían guardarse en **variables de entorno o secretos** del propio pipeline (por ejemplo `E2E_PHONE`, `E2E_OTP`), de modo que no queden expuestas en el repo ni en los logs. Los tests pueden leer `process.env.E2E_PHONE` y `process.env.E2E_OTP` cuando existan, y usar las constantes solo como valor por defecto en entornos locales.

Los logs de cada ejecución se escriben en `tests/logs/` (archivo por run). La carpeta `tests/artifacts/` guarda screenshots (p. ej. del test de coches).

### Estabilidad de los tests (esperas)

Se prioriza **estabilidad**: se evitan esperas fijas (`sleep` / `waitForTimeout`) en el flujo y se usan **esperas por condiciones**.

- **Specs y page objects:** se usa `waitFor({ state: 'visible' })`, `waitForURL(...)`, `waitForLoadState('networkidle')`, esperas a texto/roles visibles, etc., en lugar de timeouts fijos antes de clicks o listados.
- **Excepción intencionada (no de estabilidad):** el único `waitForTimeout` que queda está en `keepPageOpenByTimer` (helper que mantiene la página abierta N segundos al final de un test). Se usa en el test de login con 5 s y en el test de coches con `KEEP_OPEN_SECONDS` (por defecto 20). La espera fija es el comportamiento deseado, no una condición de UI.

### Selectores, esperas, assertions e independencia

| Criterio | Estado | Detalle |
|----------|--------|---------|
| **Selectores estables** | Parcial | Se prioriza `getByRole`, `getByText` y atributos semánticos cuando es posible. También hay XPath absolutos y clases CSS (p. ej. en login y en algunos filtros) que pueden romperse si cambia el DOM; las variables de entorno (BRAND_LOCATOR, etc.) permiten overrides sin tocar código. Lo ideal sería usar `data-testid` si el front los expone. |
| **Esperas correctas (sin sleeps)** | Sí | En el flujo no se usan sleeps; solo esperas por condiciones (`waitFor`, `waitForURL`, `waitForLoadState`, `expect(...).toBeVisible()`). La única espera fija es la intencionada en `keepPageOpenByTimer`. |
| **Assertions útiles** | Parcial | Hay assertions de visibilidad y estado en los page objects (`toBeVisible`, `toBeEnabled`). El spec de login fallido comprueba explícitamente la URL (`expect(page).toHaveURL(/.*login/)`). El flujo de coches verifica sesión con `assertLoggedInAndGetInitials()`. Se podría añadir más assertions de resultado en los specs (p. ej. que el listado tenga al menos un coche, que la URL contenga "coches"). |
| **Tests independientes** | Sí | Cada spec puede ejecutarse solo y pasar: login hace su flujo (con o sin cookies); login-fail-otp no usa cookies; view-all-cars carga cookies si existen o hace login. No hay dependencia de orden entre specs; el archivo de cookies es opcional para reutilizar sesión. |

---

## Integración en CI (propuesta)

Se incluye un **workflow de GitHub Actions** de ejemplo para ejecutar los tests E2E en cada push/PR (y bajo demanda).

### Dónde está

- **Workflow:** [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)

### Qué hace el workflow

1. Checkout del repo y uso de Node.js 20 con caché de npm.
2. `npm ci` e instalación del navegador Chromium de Playwright (`npx playwright install chromium --with-deps`).
3. Ejecución de todos los tests con `npm run test`. En CI, Playwright usa **headless** y **Chromium** (sin Chrome del sistema); la config detecta `CI=true` y ajusta `headless` y `channel` automáticamente.
4. Subida de artefactos (resultados, reporte, screenshots, logs) con retención de 7 días, tanto si los tests pasan como si fallan.

### Cómo activarlo

- Con el repo en GitHub: el workflow se ejecuta en **push** y **pull_request** a `main`/`master`, y también con **Run workflow** en la pestaña Actions.
- Si los tests hacen **login con teléfono/OTP**, en entornos reales conviene usar secretos (p. ej. `E2E_PHONE`, `E2E_OTP`) y leerlos en los tests en lugar de constantes en código; en el YAML hay comentarios donde definirlos.

### Cookies en CI (sin subir cookies al repositorio)

En CI no hay `cookies.json` porque **no se suben cookies al repo** (sería un riesgo de seguridad y están en `.gitignore`). Para que los tests no tengan que hacer login + captcha en cada run, se usan **cookies guardadas como secreto** del pipeline:

1. **Secreto `E2E_COOKIES_BASE64`**  
   En GitHub: Settings → Secrets and variables → Actions → New repository secret. Nombre: `E2E_COOKIES_BASE64`.

2. **Cómo generar el valor del secreto**  
   Tras ejecutar los tests en local y hacer login (una vez resuelto el captcha), el archivo `tests/fixtures/cookies.json` existe. En la terminal:
   - **Mac:** `base64 -i tests/fixtures/cookies.json | pbcopy` (queda en el portapapeles; pégalo en el valor del secreto).
   - **Linux:** `base64 -w0 tests/fixtures/cookies.json` y copia la salida.
   El workflow decodifica ese base64 y escribe `tests/fixtures/cookies.json` al inicio del job. Así los tests reutilizan sesión sin login ni captcha en CI.

3. **Caducidad**  
   Las cookies de sesión caducan. Cuando el job empiece a fallar por sesión inválida, hay que volver a ejecutar el flujo de login en local (o en un job que pueda resolver captcha), generar de nuevo el base64 de `cookies.json` y **actualizar el secreto** `E2E_COOKIES_BASE64` en GitHub.

Si **no** configuras el secreto, el workflow sigue ejecutándose pero los tests harán login desde cero; si la web muestra captcha, ese paso fallará en CI. Alternativa a largo plazo: usar un entorno de prueba donde el login no exija captcha.

### Limitaciones a tener en cuenta

- **Captcha:** Si el login muestra captcha y no usas cookies desde el secreto, en CI no puede resolverse de forma manual; hace falta cookies pregeneradas (secreto anterior), un entorno sin captcha, o flujos que no requieran login.
- **Otros CI:** La misma idea sirve para GitLab CI, Jenkins, etc.: instalar Node, dependencias, Playwright browsers, restaurar cookies desde un secreto/variable si existe, y ejecutar `npm run test` con `CI=true`.

### Mentalidad CI/CD: pipeline, reporting, paralelismo y flakiness

| Aspecto | Situación actual | Detalle |
|---------|------------------|---------|
| **Pipeline** | Implementado | Workflow de GitHub Actions en `.github/workflows/e2e.yml`: se ejecuta en push/PR a `main`/`master` y con *Run workflow*. Pasos: checkout, Node 20, `npm ci`, instalación de Chromium, `npm run test`, subida de artefactos (retention 7 días). En CI se usa `CI=true` (headless + Chromium). |
| **Reporting** | Implementado + mejorable | **Actual:** reporter `list` en terminal; reporter propio que escribe `tests/logs/run-YYYY-MM-DD-HH-mm-ss.log` con RUN_RESULT, fecha, duración y lista de tests con estado; subida de `test-results/`, `playwright-report/`, `tests/artifacts/`, `tests/logs/` como artefactos. **Opcional:** añadir reporter HTML de Playwright (`['html', { outputFolder: 'playwright-report' }]`) para ver fallos y trazas en el navegador. |
| **Paralelismo** | 1 worker | `workers: 1` en config y en los scripts `npm run test` / `test:cars`. Los tests se ejecutan en serie. **Motivo:** reutilización de cookies y flujos que comparten sesión; con más workers habría que evitar compartir estado o usar un worker por spec con contexto limpio. Para más paralelismo en el futuro: asegurar que los specs no dependan de orden ni de un único archivo de cookies (p. ej. cada worker con su propio storage o specs que no reutilicen cookies). |
| **Reducir flakiness** | Varias medidas | (1) **Esperas por condiciones:** no hay sleeps en el flujo; se usa `waitFor`, `waitForURL`, `expect(...).toBeVisible()` para que los tests no fallen por tiempos fijos. (2) **Un solo worker:** evita contención por recursos y estado compartido. (3) **Retries en CI:** en la config, `retries: 2` solo cuando `CI=true` para reintentar fallos transitorios (red, carga); en local `retries: 0` para ver el fallo a la primera. (4) **Artefactos en fallo:** se suben resultados y logs aunque falle el job, para depurar. |

---

## Criterios de priorización (qué automatizar primero y por qué)

Se eligió qué automatizar en este orden: primero lo que más afecta si falla, luego lo que más suele cambiar, y priorizando tests que den mucho valor con poco esfuerzo.

| Orden | Test | Qué cubre | Por qué en esta posición |
|-------|------|-----------|---------------------------|
| 1 | **Login exitoso** (`login.spec.ts`) | Teléfono, OTP, guardar cookies, llegar al dashboard. | Sin login no se puede probar nada más. Si auth o OTP se rompen, todo falla. Este test además permite reutilizar sesión (menos captcha y menos tiempo en runs siguientes). |
| 2 | **Login fallido (OTP)** (`login-fail-otp.spec.ts`) | Introducir OTP incorrecto y comprobar que no se accede. | Asegura que un error de validación no deje entrar. Es un solo spec y detecta regresiones importantes en seguridad y mensajes de error. |
| 3 | **Ver todos los coches** (`view-all-cars.spec.ts`) | Ir al listado, aplicar filtros (Marca Opel, Manual), ver coches y pulsar el primero. Screenshot al final. | Es el flujo principal de uso (buscar coche). Un solo test recorre varias pantallas y filtros; si algo se rompe ahí, lo vemos enseguida. |

**Resumen del orden:** Entrada (login) → camino negativo (OTP mal) → flujo principal (listado y filtros). Con estos tres specs se cubre lo esencial sin duplicar esfuerzo.

**Próximas ideas** (detalle en *Qué automatizarías a continuación*): ficha del coche, más filtros, cerrar sesión, y pruebas rápidas sin estar logueado (p. ej. que la home cargue).

---

## Supuestos

- **Entorno bajo prueba:** driverevel.com (producción o el que apunte la URL usada en los tests).
- **Login:** Se usa un número de teléfono y OTP fijos definidos en `tests/config/constants.ts` (PHONE, OTP). El OTP es válido para ese flujo de prueba.
- **Captcha:** Si la web muestra captcha en login, debe resolverse manualmente durante la ejecución; las cookies se guardan después para no repetir en siguientes runs.
- **Cookies:** La sesión se persiste en `tests/fixtures/cookies.json` (no versionado). Sin este archivo o tras `clean:cookies`, los tests que necesitan sesión harán login desde cero.
- **Navegador:** Chrome instalado en el sistema; Playwright usa `channel: 'chrome'`.
- **Estructura de la web:** Los tests dependen de selectores y flujos actuales (marca, tipo de cambio, listado de coches). Cambios de diseño o de DOM pueden requerir actualizar page objects o constantes.

---

## Qué automatizarías a continuación (suite de regresión real)

Ideas para ampliar la suite, en bloques lógicos:

**Listado y ficha de coche**
- Más filtros (combustible, precio, km), ordenación y paginación.
- Abrir la ficha de un coche y comprobar que se muestran bien precio, marca y modelo.

**Login y cuenta**
- OTP incorrecto ya está cubierto. Añadir: teléfono inválido, bloqueos, etc.
- Cerrar sesión y comprobar que se redirige o se ve como usuario anónimo.
- Perfil: ver y editar datos de usuario si la web lo permite.

**Pruebas rápidas sin estar logueado (humo)**
- Comprobar que la home carga bien.
- Comprobar que se puede ver listado o búsqueda sin tener sesión.
- Sirven para detectar fallos graves en segundos y se pueden ejecutar en CI sin credenciales.

**Mantenimiento del código de tests**
- Fixture de sesión reutilizable para no repetir login en cada spec.
- Base URL y credenciales por entorno (dev/staging/prod) con variables de entorno o secretos.
- Selectores más estables (p. ej. `data-testid` si el front los expone).
- Reporte HTML de Playwright y subida de resultados/screenshots en CI.
- Criterios de éxito de cada spec documentados (qué se considera regresión).

---

## Arquitectura y mantenibilidad

**Estructura del repo**

- **Specs** (`tests/specs/`): solo los tests; cada spec importa pages, config, helpers y steps.
- **Pages** (`tests/pages/`): Page Object Model (POM). `LoginPage` y `CarsPage` reciben `page` en el constructor y exponen métodos por pantalla/acción (p. ej. `fillPhone`, `openBrandFilter`, `getVisibleModelsWithPrices`). Los selectores y URLs están agrupados en constantes dentro de cada page.
- **Helpers** (`tests/helpers/`): lógica compartida que no es de una pantalla concreta: `waitForEnter`, `stepCheckpoint`, `keepPageOpenByTimer`. Evitan duplicar pausas y cuenta atrás en los specs.
- **Steps** (`tests/steps/`): nombres de pasos por spec (`STEPS.loadCookies`, `STEPS.openBrand`, etc.). Centralizados para que el spec use `test.step(STEPS.xxx, ...)` y los reportes sean legibles sin repetir strings.
- **Config** (`tests/config/`): constantes (PHONE, OTP, WRONG_OTP) y punto de entrada `index.ts`. Un solo sitio para datos de test.
- **Utils** (`tests/utils/`): cookies (guardar/cargar/borrar), logger, script de borrado de cookies. Usados por specs y por pages cuando hace falta.
- **Fixtures** (`tests/fixtures/`): solo datos (cookies de sesión en `cookies.json`). No hay fixtures de Playwright (p. ej. `authenticatedPage`); cada spec instancia los page objects y, si hace falta, hace login o carga cookies.

**Reutilización**

- Los page objects se reutilizan entre specs: `LoginPage` en login, login-fail-otp y view-all-cars; `CarsPage` en view-all-cars. No se duplica la lógica de “rellenar teléfono”, “abrir filtro Marca” o “listar coches”.
- Helpers, config y utils se importan desde un único lugar; no hay copia de constantes ni de funciones de cookies/logger en los specs.
- Los nombres de pasos (STEPS) se definen una vez por spec y se reutilizan en todos los `test.step(...)`.

**Patrones**

| Patrón | Uso en el proyecto |
|--------|--------------------|
| **POM** | `LoginPage` y `CarsPage` encapsulan selectores y acciones; los specs solo llaman métodos y no usan `page.locator(...)` directamente (salvo casos puntuales en view-all-cars para overrides por env). |
| **Helpers** | Pausas (ENTER), checkpoints (STEP_BY_STEP) y “mantener página abierta” están en `test-helpers.ts` para no repetir código en los specs. |
| **Config / steps** | Constantes y nombres de pasos centralizados; los specs quedan cortos y legibles. |
| **Fixtures (datos)** | Cookies en `tests/fixtures/`; no hay fixture de Playwright tipo “página ya logueada” (se podría añadir más adelante para no repetir login en varios specs). |

**Claridad del código**

- Nombres: métodos de los pages describen la acción (`fillPhone`, `assertLoggedInAndGetInitials`, `clickFirstVisibleCar`); STEPS describen el paso en lenguaje de negocio.
- Comentarios: JSDoc en helpers y en métodos no obvios; constantes SELECTORS/URLS comentadas donde aporta.
- Responsabilidades: specs orquestan (pasos y orden); pages implementan cómo interactuar con la UI; utils y config no contienen lógica de pantalla.

**Tamaño de `CarsPage` (~1000 líneas)**

`CarsPage` concentra todo el flujo de listado y filtros en un solo archivo: abrir/cerrar filtro marca, “ver todas las marcas”, elegir marca (Opel), tipo de cambio, opción Manual, scroll, listado de modelos/precios, clic en la primera ficha, etc. **Está bien a nivel funcional** (un solo Page Object para la zona de coches, los specs siguen claros), pero **a medio/largo plazo no es ideal** para mantenimiento: un archivo tan grande cuesta navegar, mezcla muchas responsabilidades y hace más probables conflictos si varias personas lo tocan.

- **Cuándo compensa dividir:** cuando el archivo o el equipo crezcan, o cuando cambiar una parte (p. ej. filtros) obligue a revisar demasiado código ajeno.
- **Cómo dividir sin romper tests:** separar por dominio: (1) **Filtros** (marca, tipo de cambio, “ver todas las marcas”, opciones Manual/Opel) en un módulo o clase (p. ej. `CarsFiltersPage` o `tests/pages/cars-filters.ts`); (2) **Listado** (scroll, `getVisibleModelsWithPrices`, `clickFirstVisibleCar`) en `CarsPage` o en `cars-list.ts`. `CarsPage` puede instanciar y usar el módulo de filtros para que los specs sigan llamando solo a `CarsPage` si no quieres tocar los specs. No es obligatorio partirlo ya; es el siguiente paso razonable cuando la mantenibilidad lo pida.

---

## Estructura del proyecto (resumen)

Cada carpeta tiene un rol claro para que negocio y desarrollo sepan dónde está cada cosa:

- **`tests/specs/`** – Los **tests en sí**: cada archivo es un flujo que se ejecuta (login correcto, login fallido con OTP mal, ver todos los coches y filtros). Son los “casos de prueba” que el pipeline lanza.
- **`tests/pages/`** – **Objetos de página (POM):** definen cómo interactuar con cada pantalla (login, listado de coches). Los specs los usan para no repetir “cómo se rellena el teléfono” o “cómo se abre el filtro Marca” en cada test.
- **`tests/helpers/`** – **Funciones auxiliares** compartidas entre tests: pausas (p. ej. “esperar ENTER”), mantener la página abierta unos segundos al final. Evitan duplicar esa lógica en varios specs.
- **`tests/steps/`** – **Nombres de los pasos** de cada test (p. ej. “Cargar cookies”, “Abrir filtro Marca”). Se usan en los reportes para que se entienda qué paso se estaba ejecutando cuando algo falla.
- **`tests/config/`** – **Datos de prueba** centralizados (teléfono, OTP). Un solo sitio para cambiarlos sin tocar los tests.
- **`tests/utils/`** – **Utilidades técnicas:** guardar/cargar/borrar cookies de sesión, logger de consola, script para borrar cookies (uso local o CI).
- **`tests/reporters/`** – Lógica que **genera el log de cada ejecución** (éxito/fallo, lista de tests) en `tests/logs/`.
- **`tests/fixtures/`** – **Datos generados** (cookies de sesión). No se sube al repo; en CI se puede restaurar desde un secreto.
- **`tests/logs/`** y **`tests/artifacts/`** – **Salida de cada run:** logs por ejecución y screenshots. No versionados.
- **`playwright.config.ts`** – **Configuración** del motor de tests (navegador, timeouts, reintentos en CI).
- **`.github/workflows/`** – **Pipeline de CI:** define cuándo se ejecutan los tests (push, PR) y qué pasos se dan (instalar, ejecutar, subir resultados). Ver *Integración en CI*.
