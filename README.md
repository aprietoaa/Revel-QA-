# Revel – Tests E2E (Playwright)

Tests end-to-end para **driverevel.com**: login, listado de coches, filtros y selección. Incluye gestión de cookies para reutilizar sesión y evitar repetir login/captcha.

**Inicio rápido:** `npm install` → `npm run test`. Para forzar login desde cero: `npx tsc && npm run clean:cookies && npm run test`.

**Usuario de prueba (caso práctico):** teléfono +34879542345 y OTP fijo definidos en `tests/config/constants.ts`. Login por teléfono (no por email en este repo).

---

## Cumplimiento del caso práctico (checklist para evaluadores)

| Requisito | Cumplido | Dónde / cómo |
|-----------|----------|--------------|
| **Login:** al menos 1 flujo OK | Sí | `tests/specs/login.spec.ts`: teléfono + OTP, guardar cookies, reutilizar sesión. |
| **Login:** al menos 1 escenario KO | Sí | `tests/specs/login-fail-otp.spec.ts`: OTP incorrecto, se valida que no se accede. |
| **README:** cómo resolver OTP dinámico en real/CI | Sí | Sección *Credenciales* y *Si el OTP no fuese fijo*: Twilio API, endpoint de test, backdoor staging. |
| **Filtros grid:** mínimo 2 filtros | Sí | Filtro **Marca** (Opel) y filtro **Tipo de cambio** (Manual). |
| **Filtros grid:** 1 combinación y validar grid | Sí | Combinación Opel + Manual; se listan coches y se valida el listado. |
| **Filtros grid:** validar al aplicar y limpiar filtros | Sí | `tests/specs/view-all-cars-clear-filters.spec.ts`: aplicar Opel + Manual, listar, limpiar filtros y comprobar estado. |
| **Caso borde (reset / sin resultados)** | Sí | Caso **reset**: limpiar filtros y validar que el listado sin filtros es visible. |
| **Al menos 2 tests E2E + 1 negativo** | Sí | Login (`login.spec.ts`), filtros (`view-all-cars.spec.ts`, `view-all-cars-clear-filters.spec.ts`), negativo (`login-fail-otp.spec.ts`). |
| **README:** ejecutar, prerrequisitos, supuestos, qué automatizarías** | Sí | Secciones correspondientes más abajo. |
| **CI (opcional)** | Sí | `.github/workflows/e2e.yml`: GitHub Actions en push/PR, cookies desde secreto, artefactos. |
| **Estabilidad:** sin sleeps, esperas por condiciones | Sí | `waitFor`, `waitForURL`, `expect(...).toBeVisible()`; único timeout fijo intencionado al final (mantener página abierta). |
| **Selectores mantenibles / overrides** | Parcial | `getByRole`, `getByText`; variables de entorno para overrides (BRAND_LOCATOR, etc.). |
| **Tests independientes, logs/screenshots** | Sí | Cada spec ejecutable solo; logs en `tests/logs/`, screenshots en `tests/artifacts/`. |

---

## Cambios recientes (mantenimiento de selectores y flujo de login)

Ajustes realizados para que los tests sigan funcionando cuando la web cambia textos, estructura del DOM o hashes de clases CSS:

- **Login (teléfono y OTP):**
  - Input de teléfono: selector por atributos (`input[autocomplete="tel"]`, `input[name="phone number"]`) en lugar de XPath; espera a que sea visible, click y luego fill para que formularios React respondan bien.
  - Paso OTP: se espera al **textbox del dialog** (`getByRole('dialog').getByRole('textbox')`) en lugar de un XPath o texto concreto; el campo se rellena con ese mismo locator. Así no depende de que el copy diga "OTP", "Introduce el código" o "Escríbelo aquí para entrar".
  - El **captcha se resuelve a mano**; el test solo espera a que aparezca el campo del código y lo rellena.
- **Test login fallido (OTP incorrecto):** mensaje de error mejorado: si falla la comprobación de URL, se muestra la URL actual para depurar.
- **Filtros (Marca y Cambio):**
  - Selectores que usaban clases con hash (p. ej. `FilterShortcutButton_filter__button__ZCF57`, `ShortcutsFilterBar_filters__shorcuts__V25SQ`) sustituidos por `class*="FilterShortcutButton"` y `class*="ShortcutsFilterBar"` para que sigan funcionando aunque cambie el hash en un nuevo build.
  - Filtro de tipo de cambio: eliminado el XPath por defecto en los specs; el page object usa candidatos por rol/texto. Añadidos candidatos para el label **"Cambio"** (además de "Tipo de cambio") porque la web pasó a mostrar "Cambio".
- **Variables de entorno:** si defines `EXCHANGE_TYPE_LOCATOR` o `BRAND_LOCATOR` etc., se siguen usando; si no, se usan los selectores resilientes anteriores.

---

## Agentes, instrucciones y skills (QA Automation AI)

Este repositorio incluye una **biblioteca de agentes, instrucciones y skills** pensada para QA Automation, integrada desde un catálogo tool-agnostic (compatible con Cursor, Claude, GitHub Copilot, etc.):

| Carpeta | Contenido |
|--------|-----------|
| `agents/` | Definiciones de agentes especializados (Playwright Test Generator/Healer, Flaky Test Hunter, API Tester, Selenium Specialist, Test Refactor, etc.). |
| `instructions/` | Reglas operativas y estándares: Playwright TypeScript, Selenium Java, accesibilidad (a11y), autoría de agentes/skills. |
| `skills/` | Playbooks reutilizables por carpeta: `playwright-e2e-testing`, `a11y-playwright-testing`, `webapp-playwright-testing`, `qa-test-planner`, `qa-manual-istqb`, `webapp-selenium-testing`, `accessibility-selenium-testing`. |

**Cómo empezar a usarlos (Cursor)**

1. **Reglas de Cursor (automático)**  
   Hay una regla en `.cursor/rules/playwright-qa.mdc` que se aplica al editar specs y page objects: el asistente sigue las convenciones de `instructions/playwright-typescript.instructions.md` (locators, POM, assertions). Al tocar `tests/**` o `tests/pages/**` esa regla se usa automáticamente.

2. **En el chat (bajo demanda)**  
   Pide explícitamente que use un skill o instrucciones, por ejemplo: sigue `instructions/playwright-typescript.instructions.md` para añadir un test, aplica el skill playwright-e2e-testing, o usa el agente Flaky Test Hunter (ver `agents/flaky-test-hunter.agent.md`).

3. **Referencia con @**  
   Incluye ficheros en el contexto con @: `@instructions/playwright-typescript.instructions.md` o `@skills/playwright-e2e-testing/SKILL.md`.

4. **Generador de tests (Playwright Test Generator + MCP)**  
   - **Configuración:** En el proyecto está `.cursor/mcp.json` con el servidor MCP de Playwright (`npx playwright run-test-mcp-server`). En Cursor: **Settings → Tools & MCP** y comprobar que el servidor `playwright-test` aparece (o reinicia Cursor para que cargue `.cursor/mcp.json`).  
   - **Uso:** En el chat, pide que actúe como **Playwright Test Generator** y entrega un **plan de pruebas** con pasos y verificaciones. Ejemplo de prompt:  
     *"Usa el agente Playwright Test Generator. Plan: 1) Ir a la URL del listado de coches. 2) Abrir el filtro Marca. 3) Verificar que aparece el enlace 'Ver todas las marcas'. 4) Pulsar 'Ver todas las marcas' y verificar que se muestra la lista de marcas. Genera el spec en tests/specs."*  
     El agente usa las herramientas MCP (navegar, clic, verificar, etc.) y al final escribe el `.spec.ts` con `generator_write_test`.  
   - **Requisitos:** Node 18+, Playwright instalado (`npm install` en el proyecto). Si el MCP no aparece en Cursor, revisa que la versión de Playwright incluya el servidor (`npx playwright run-test-mcp-server --help`).

Las carpetas `agents/`, `instructions/` y `skills/` no tienen build ni tests; son documentación y guías para la IA.

---


**Origen del contenido:** [test-automation-skills-agents](https://github.com/fugazi/test-automation-skills-agents) (Douglas Urrea Ocampo, MIT). En ese repo encontrarás el README completo, flujos end-to-end y cómo mapear todo a GitHub Copilot (`.github/agents`, `.github/instructions`, `.github/skills`) si lo necesitas.

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

- Ejecuta los 4 specs con 1 worker.
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

### Tests dinámicos de filtros (Nivel 5)

Un spec adicional descubre los filtros disponibles desde la UI (marcas y tipos de cambio), genera combinaciones de forma automática y valida que los resultados contengan la marca aplicada. No sustituye a los 4 tests existentes; los mantiene sin cambios.

**Ejecutar solo el test dinámico:**

```bash
npx playwright test tests/specs/dynamic-filters.spec.ts
```

El flujo: sesión → ir a listado → abrir filtro Marca y obtener lista de marcas → abrir filtro Cambio y obtener tipos → generar matriz (p. ej. 3 marcas × 2 tipos) → por cada combinación aplicar filtros, validar que los resultados contienen la marca y limpiar filtros.

Variables opcionales para este test: `DYNAMIC_MAX_BRANDS` (por defecto 3), `DYNAMIC_MAX_EXCHANGE_TYPES` (por defecto 2).

### Test listado todas las marcas e informe (`cars-list-loads.spec.ts`)

Un spec recorre **todas las marcas** del filtro (tras pulsar "Ver todas las marcas"), por cada una aplica el filtro, obtiene modelos con precio (hasta 25 por marca), limpia filtros y al final genera dos informes en consola:

1. **Por marca:** modelo y precio agrupados por marca, con totales y marcas omitidas (si alguna falla).
2. **Precios de mayor a menor:** todos los vehículos ordenados por cuota mensual (formato europeo: 1.510 € → 1510).

**Ejecutar solo este test:**

```bash
npx playwright test tests/specs/cars-list-loads.spec.ts
```

- Excluye no-marcas del filtro (p. ej. "Pick-up"). Si una marca devuelve 0 vehículos se registra un **warning** (posible carga incompleta de cards).
- Timeout del test: 30 min; se han reducido esperas fijas y scroll para acortar la duración.

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
| `DYNAMIC_MAX_BRANDS`, `DYNAMIC_MAX_EXCHANGE_TYPES` | Límites para el test dinámico de filtros (por defecto 3 y 2). |
| `CLEAR_FILTERS_LOCATOR` | Override del botón "Borrar filtros" (usado en cars-list-loads y view-all-cars-clear-filters). |

### Credenciales (teléfono y OTP)

En este proyecto el **número de teléfono** y el **OTP** de prueba están definidos en código abierto (`tests/config/constants.ts`) y son **visibles** en el repositorio. **Sabemos que no es una buena práctica**: en un entorno real nunca commitearíamos credenciales ni las dejaríamos en código; se usarían variables de entorno o secretos. Aquí se hace así solo para que el caso práctico se pueda ejecutar de forma sencilla en local sin configurar secretos; no es algo que replicaríamos en producción ni en CI real.

En un **pipeline o CI** (GitHub Actions, GitLab CI, etc.) las credenciales deberían guardarse en **variables de entorno o secretos** del propio pipeline (por ejemplo `E2E_PHONE`, `E2E_OTP`), de modo que no queden expuestas en el repo ni en los logs. Los tests pueden leer `process.env.E2E_PHONE` y `process.env.E2E_OTP` cuando existan, y usar las constantes solo como valor por defecto en entornos locales.

**Si el OTP no fuese fijo (entorno real / staging / CI):** en un flujo con OTP dinámico (p. ej. Twilio) no se puede hardcodear el código. Opciones: (1) **API de Twilio** (o del proveedor de SMS): antes de rellenar el OTP en el test, llamar a la API para obtener el último SMS enviado al teléfono de prueba y extraer el código; (2) **endpoint de test en backend**: si staging expone un endpoint tipo “último OTP generado para este teléfono” (solo en entornos de prueba), el test lo consulta y usa ese valor; (3) **backdoor en staging**: usuario de prueba cuyo OTP sea siempre el mismo o desactivar OTP para ese usuario en entorno de test. La opción (2) o (3) suele ser la más estable para CI; la (1) depende de que Twilio (u otro) esté disponible desde el pipeline y de permisos.

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
| 4 | **Limpiar filtros** (`view-all-cars-clear-filters.spec.ts`) | Aplicar Opel + Manual, listar coches, limpiar filtros y comprobar que el listado sin filtros es visible. | Valida que el botón “Limpiar filtros” funciona y que la UI vuelve al estado sin filtros. |

**Resumen del orden:** Entrada (login) → camino negativo (OTP mal) → flujo principal (listado y filtros) → limpiar filtros. Con estos cuatro specs se cubre lo esencial sin duplicar esfuerzo.

**Próximas ideas** (detalle en *Qué automatizarías a continuación*): ficha del coche, más filtros, cerrar sesión, y pruebas rápidas sin estar logueado (p. ej. que la home cargue).

---

## Supuestos

- **Entorno bajo prueba:** driverevel.com (producción o el que apunte la URL usada en los tests).
- **Login:** Se usa un número de teléfono y OTP fijos definidos en `tests/config/constants.ts` (PHONE, OTP). El OTP es válido para ese flujo de prueba.
- **Captcha:** Si la web muestra captcha en login, debe resolverse manualmente durante la ejecución; las cookies se guardan después para no repetir en siguientes runs.
- **Cookies:** La sesión se persiste en `tests/fixtures/cookies.json` (no versionado). Sin este archivo o tras `clean:cookies`, los tests que necesitan sesión harán login desde cero.npm run clena
- **Navegador:** Chrome instalado en el sistema; Playwright usa `channel: 'chrome'`.
- **Estructura de la web:** Los tests dependen de selectores y flujos actuales (marca, tipo de cambio, listado de coches). Cambios de diseño o de DOM pueden requerir actualizar page objects o constantes.

### Comportamiento conocido del filtro Marca (workaround)

**Qué pasa:** En la web, al pulsar **"Ver todas las marcas"** el desplegable del filtro **Marca** se cierra. Eso impide elegir una marca (p. ej. Opel) justo después sin hacer un clic extra: el usuario tendría que abrir de nuevo el filtro. **Es un bug de la UI**: lo esperado sería que el desplegable siguiera abierto tras "Ver todas las marcas" para poder elegir marca directamente; al cerrarse, obliga a un paso innecesario (abrir → "Ver todas las marcas" → **reabrir** → elegir marca).

**Cómo lo cubrimos en los tests:** En los specs de listado de coches hay un paso explícito que **vuelve a pulsar en "Marca"** para reabrir el desplegable antes de seleccionar Opel. El flujo automatizado es: abrir filtro Marca → pulsar "Ver todas las marcas" → **pulsar de nuevo en Marca (reabrir)** → seleccionar Opel. Ese paso está en `STEPS.reopenBrand` y lo implementa `BrandFilterPage` / `CarsPage.openBrandFilter` llamado por segunda vez.

**Cómo se podría arreglar (en la web):** Que el desplegable **no se cierre** al hacer clic en "Ver todas las marcas", de modo que la lista de marcas siga visible y se pueda elegir una sin reabrir. Sería un cambio de front/UX en driverevel.com.

**Si la web se corrige:** En los tests se podría eliminar el paso "reabrir Marca" (el `test.step(STEPS.reopenBrand, ...)` y la llamada correspondiente a `openBrandFilter` en ese punto) y dejar solo: abrir Marca → Ver todas las marcas → seleccionar Opel.

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

- Los page objects se reutilizan entre specs: `LoginPage` en login, login-fail-otp, view-all-cars y view-all-cars-clear-filters; `CarsPage` en view-all-cars y view-all-cars-clear-filters. No se duplica la lógica de “rellenar teléfono”, “abrir filtro Marca” o “listar coches”.
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

**Estructura de `CarsPage` (fachada)**

`CarsPage` es una **fachada** (~100 líneas) que delega en tres Page Objects: `BrandFilterPage` (filtro de marca), `ExchangeTypeFilterPage` (tipo de cambio) y `CarsGridPage` (listado, scroll, limpiar filtros, clic en coche). Los specs siguen usando solo `CarsPage`; la lógica de filtros y listado está en `brand-filter.page.ts`, `exchange-type-filter.page.ts` y `cars-grid.page.ts`. Así se mantiene una sola API para los tests y el código queda repartido por responsabilidad.

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

---

## Archivos del proyecto (listado completo)

Qué hace cada archivo del repo:

### Raíz

| Archivo | Qué hace |
|---------|----------|
| `package.json` | Dependencias (Playwright, chalk, boxen, etc.) y scripts: `test`, `clean:cookies`, `test:cars`. |
| `package-lock.json` | Lockfile de npm; fija versiones de dependencias. |
| `playwright.config.ts` | Configuración de Playwright: `testDir`, timeout, 1 worker, reporters (list + run-logger), path del log por ejecución (`tests/logs/run-*.log`), headless en CI, Chrome en local. |
| `tsconfig.json` | Configuración de TypeScript (target, module, etc.). |
| `.gitignore` | Archivos/carpetas ignorados (node_modules, tests/fixtures, tests/logs, tests/artifacts, dist, etc.). |
| `README.md` | Este documento. |

### .github/workflows/

| Archivo | Qué hace |
|---------|----------|
| `e2e.yml` | Workflow de GitHub Actions: checkout, Node 20, `npm ci`, instalación de Chromium, restauración de cookies desde secreto `E2E_COOKIES_BASE64`, `npm run test`, subida de artefactos (test-results, playwright-report, tests/artifacts, tests/logs). Se ejecuta en push/PR a main/master y con *Run workflow*. |

### tests/config/

| Archivo | Qué hace |
|---------|----------|
| `constants.ts` | Constantes de prueba: `PHONE`, `OTP`, `WRONG_OTP`. Usadas por login y specs que requieren sesión. |
| `index.ts` | Punto de entrada de la config: re-exporta constantes para importar desde un solo sitio (`tests/config`). |

### tests/helpers/

| Archivo | Qué hace |
|---------|----------|
| `car-card-helpers.ts` | Lógica pura para cards de coche: regex para modelo/precio, `getBrandPlusModel`, `limitToCarsOnly`. Usado por el page del grid para extraer datos de las cards. |
| `test-helpers.ts` | Helpers compartidos: `waitForEnter` (pausa con “Pulsa ENTER”), `stepCheckpoint` (pausa si `STEP_BY_STEP`), `keepPageOpenByTimer` (mantener página N segundos al final). |

### tests/pages/

| Archivo | Qué hace |
|---------|----------|
| `brand-filter.page.ts` | Page Object del filtro de marca: abrir filtro, “Ver todas las marcas”, seleccionar marca (p. ej. Opel), reabrir panel. Selectores y reintentos centralizados aquí. |
| `cars-grid.page.ts` | Page Object del listado/grid: scroll para cargar más cards, `getVisibleModelsWithPrices`, limpiar filtros, `clickFirstVisibleCar`. Usa `car-card-helpers` para parsear texto de las cards. |
| `cars-page.ts` | Fachada que agrupa filtro marca, filtro tipo de cambio y grid. Delega en `BrandFilterPage`, `ExchangeTypeFilterPage` y `CarsGridPage`; los specs siguen usando `CarsPage` con la misma API. |
| `exchange-type-filter.page.ts` | Page Object del filtro “Tipo de cambio”: abrir filtro, seleccionar opción (p. ej. Manual). |
| `login-page.ts` | Page Object del login: rellenar teléfono, continuar, rellenar OTP, aceptar cookies, detectar sesión (`assertLoggedInAndGetInitials`), guardar cookies. Usado por login.spec, login-fail-otp y view-all-cars. |

### tests/reporters/

| Archivo | Qué hace |
|---------|----------|
| `run-logger.ts` | Reporter de Playwright: al final de cada ejecución escribe/append en el fichero de log (`PLAYWRIGHT_LOG_FILE`) un resumen: RUN_RESULT (PASS/FAIL), fecha, duración y lista de tests con estado. El logger de consola escribe durante el run en ese mismo fichero. |

### tests/specs/

| Archivo | Qué hace |
|---------|----------|
| `login.spec.ts` | Test de login exitoso: cargar cookies, verificar sesión; si no hay sesión válida, login (teléfono + OTP), guardar cookies, aceptar cookies si aparecen. |
| `login-fail-otp.spec.ts` | Test de login fallido: introduce OTP incorrecto y comprueba que no se accede (no usa cookies). |
| `view-all-cars.spec.ts` | Test “Ver todos los coches”: cookies/sesión, ir al listado, abrir filtro Marca, Ver todas las marcas, seleccionar Opel, listar modelos, abrir tipo de cambio, seleccionar Manual, listar coches, clic en el primero, screenshot, mantener página abierta. |
| `view-all-cars-clear-filters.spec.ts` | Test “Limpiar filtros”: mismo flujo hasta listar con Opel + Manual; luego limpiar filtros y comprobar que el listado sin filtros es visible (sin listar todos los coches). |
| `cars-list-loads.spec.ts` | Test "Listado todas las marcas e informe": sesión, descubre todas las marcas, por cada una aplica filtro, obtiene modelos con precio (hasta 25/marca), limpia filtros; genera informe por marca y segundo informe con precios ordenados de mayor a menor. Excluye no-marcas (p. ej. Pick-up); warning si una marca devuelve 0 vehículos. |

### tests/steps/

| Archivo | Qué hace |
|---------|----------|
| `login.steps.ts` | Nombres de pasos para el spec de login: `loadCookies`, `verifySession`, `login`, `saveCookies`, etc. Se usan en `test.step(STEPS.xxx, ...)`. |
| `login-fail-otp.steps.ts` | Nombres de pasos para el spec de login fallido (OTP incorrecto). |
| `view-all-cars.steps.ts` | Nombres de pasos para el spec “Ver todos los coches” (openBrand, viewAllBrands, selectBrandOpel, listModels, etc.). |
| `view-all-cars-clear-filters.steps.ts` | Nombres de pasos para el spec de limpiar filtros (incluye clearFilters, listModelsAfterClear, etc.). |

### tests/utils/

| Archivo | Qué hace |
|---------|----------|
| `cookies.ts` | Guardar, cargar y eliminar cookies de sesión en `tests/fixtures/cookies.json`. Comprueba validez/expiración y formatea mensajes. Usado por specs y login-page. |
| `delete-cookies.ts` | Script ejecutable (`npm run clean:cookies`): borra el fichero de cookies. Usa `node dist/tests/utils/delete-cookies.js` tras compilar con `npx tsc`. |
| `logger.ts` | Logger de consola con colores (chalk) y cajas (boxen) para pasos: `step`, `info`, `success`, `warn`, `error`, `muted`, `car`. Escribe también en el fichero de log de la ejecución (`PLAYWRIGHT_LOG_FILE`) sin ANSI. |

### Carpetas generadas (no versionadas)

| Carpeta | Qué contiene |
|---------|--------------|
| `tests/fixtures/` | `cookies.json` (cookies de sesión). No se sube al repo; en CI se puede restaurar desde el secreto `E2E_COOKIES_BASE64`. |
| `tests/logs/` | Un fichero por ejecución: `run-YYYY-MM-DD-HHMMSS.log` (salida de consola + resumen al final). |
| `tests/artifacts/` | Screenshots y otros artefactos generados por los tests. |
| `dist/` | Salida de `npx tsc`; el script `clean:cookies` usa `dist/tests/utils/delete-cookies.js`. |
