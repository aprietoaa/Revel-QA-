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

Los logs de cada ejecución se escriben en `tests/logs/` (archivo por run). La carpeta `tests/artifacts/` guarda screenshots (p. ej. del test de coches).

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

### Limitaciones a tener en cuenta

- **Captcha:** Si el login muestra captcha, en CI no puede resolverse de forma manual; hace falta un entorno de prueba sin captcha, cookies pregeneradas, o flujos que no requieran login.
- **Cookies:** En cada run de CI no hay `cookies.json` previo; los tests que necesitan sesión harán login desde cero (con los datos configurados o secretos).
- **Otros CI:** La misma idea sirve para GitLab CI, Jenkins, etc.: instalar Node, dependencias, Playwright browsers y ejecutar `npm run test` con `CI=true`.

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

Para convertir esto en una suite de regresión sólida, se podría:

1. **Más flujos de listado y ficha**
   - Varios filtros (combustible, precio, km).
   - Ordenación y paginación.
   - Apertura de ficha de coche y comprobación de datos clave (precio, marca, modelo).

2. **Login y cuenta**
   - OTP incorrecto ya cubierto (`login-fail-otp.spec.ts`). Añadir: credenciales inválidas, bloqueos, etc.
   - Cerrar sesión y comprobar redirección o estado anónimo.
   - Perfil: ver/editar datos de usuario si la web lo permite.

3. **Resiliencia y mantenibilidad**
   - Fixtures de autenticación reutilizables (p. ej. `authenticatedPage`) para no repetir login en cada spec.
   - Configuración base URL por entorno (dev/staging/prod) vía variables de entorno.
   - Revisar y, si hace falta, estabilizar selectores (data-testid cuando existan, o selectores más robustos).

4. **CI y reporting**
   - Ejecución en CI (GitHub Actions u otro) con `headless: true` y, si aplica, variables de entorno para credenciales/OTP.
   - Reportes HTML de Playwright y, opcionalmente, envío de resultados o screenshots a un almacén compartido.

5. **Datos y entornos**
   - Evitar datos fijos en código: usar variables de entorno o secretos para teléfono/OTP en entornos no locales.
   - Tests de humo mínimos que no dependan de login (p. ej. carga de home, búsqueda sin sesión).

6. **Calidad del código de tests**
   - Añadir pruebas unitarias o de integración para helpers y utilidades (cookies, logger, constantes) si crecen en complejidad.
   - Documentar en el README o en comentarios los criterios de “éxito” de cada spec (qué se considera regresión).

---

## Estructura del proyecto (resumen)

- `tests/specs/` – Specs de Playwright (login, login fallido, view-all-cars).
- `tests/pages/` – Page objects (LoginPage, CarsPage).
- `tests/helpers/` – Helpers compartidos (waitForEnter, stepCheckpoint, keepPageOpenByTimer).
- `tests/steps/` – Nombres de pasos por spec (importados por cada `.spec.ts`).
- `tests/config/` – Constantes (PHONE, OTP, etc.) y `index.ts`.
- `tests/utils/` – Cookies, delete-cookies, logger.
- `tests/reporters/` – Reporter que escribe log por run en `tests/logs/`.
- `tests/fixtures/` – Cookies de sesión (no versionado).
- `tests/logs/` – Log por ejecución (no versionado).
- `tests/artifacts/` – Screenshots (no versionado).
- `playwright.config.ts` – Configuración (Chrome, workers, reporter, etc.).
- `.github/workflows/` – Workflow de ejemplo para CI (GitHub Actions); ver sección *Integración en CI*.
