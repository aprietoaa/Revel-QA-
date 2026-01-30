# Revel – Tests E2E con Playwright

Tests end-to-end para el flujo de login de driverevel.com usando **Playwright** y **Page Object Model (POM)**.

## Requisitos

- Node.js (con npm)
- Chrome instalado (o navegadores de Playwright)

## Instalación

```bash
npm install
npx playwright install chromium   # solo Chrome
```

## Ejecutar tests

```bash
# Todos los tests
npm test

# Solo el spec de login (flujo normal con gestión de sesión)
npm test -- tests/specs/login.spec.ts

# Test 2: login fallido con OTP incorrecto (no toca cookies)
npm test -- tests/specs/login-fail-otp.spec.ts

# Test 3: ver todos los coches (usa cookies si existen; si no, hace login)
npm run test:cars -- --headed

# (Opcional) Si los botones no se encuentran por texto/role, puedes forzar selectores estables:
# BRAND_TESTID=brand-filter ALL_BRANDS_TESTID=brands-select-all npm run test:cars -- --headed
# o con locator directo:
# BRAND_LOCATOR='css=[data-testid="brand-filter"]' ALL_BRANDS_LOCATOR='css=[data-testid="brands-select-all"]' npm run test:cars -- --headed

# Con interfaz visible (headed)
npm test -- tests/specs/login.spec.ts --headed

# Forzar borrado de cookies (para forzar nuevo login y captcha)
npm run clean:cookies
```

## Flujo del test de login

El test `login.spec.ts` documenta cada paso en la terminal (con `test.step`):

1. **Cargar cookies guardadas** – Intenta cargar cookies de sesión guardadas previamente
2. **Verificar sesión** – Comprueba si la sesión es válida navegando a una página protegida
3. **Login completo** (solo si es necesario) – Si no hay cookies válidas:
   - Ir a la página de login
   - Rellenar teléfono y pulsar Continuar
   - **Nota: La resolución del captcha es siempre manual en este momento, incluso para números inválidos o sin sesión previa.**
   - Esperar captcha y paso OTP (resolución manual)
   - Escribir el código OTP (8048)
   - Aceptar cookies (popup CybotCookiebot)
4. **Guardar cookies** – Después de un login exitoso, guarda las cookies para próximas ejecuciones
5. **Esperar 5 segundos (fin del test)** – El test termina automáticamente (no hace falta cerrar la pestaña a mano)

## Flujo del test 2 (OTP incorrecto)

El test `login-fail-otp.spec.ts` valida el escenario **KO** de OTP incorrecto **sin tocar cookies** (no carga ni guarda sesión):

1. Ir a la página de login
2. Rellenar teléfono y pulsar Continuar
3. Resolver captcha manualmente
4. Introducir OTP incorrecto (por defecto `1111`)
5. Aceptar cookies si aparece el popup
6. Verificar que el login **no** se completa (actualmente la comprobación es “seguir en `/login`”)

> Nota: si el sistema deja pasar OTPs incorrectos, este test fallará y nos servirá como señal de que el entorno no está validando OTP.

## Flujo del test 3 (Ver todos los coches)

El test `view-all-cars.spec.ts` documenta cada paso en la terminal (con `test.step`):

1. **Cargar cookies guardadas (si existen)** – Intenta cargar cookies de sesión guardadas previamente
2. **Verificar si la sesión es válida** – Comprueba si la sesión es válida navegando a una página protegida
3. **Asegurar sesión válida (login si hace falta)** – Si no hay cookies válidas, hace login completo; si no, va al dashboard
4. **Abrir "Ver todos los coches"** – Pulsa en el enlace para entrar al listado de coches
5. **Abrir filtro "Marca"** – Pulsa en Marca para abrir el desplegable del filtro
6. **Pulsar "Ver todas las marcas"** – Pulsa en "Ver todas las marcas" dentro del desplegable
7. **Pulsar en Marca de nuevo (reabrir desplegable)** *(workaround)* – Tras "Ver todas las marcas" el desplegable se cierra; se vuelve a pulsar en Marca para reabrir (ver [Bugs conocidos](#bugs-conocidos-qa))
8. **Seleccionar marca Opel** – Pulsa en la marca Opel
9. **Mantener la página abierta (antes de cerrar)** – Espera ENTER o temporizador configurable

### Sistema de cookies/sesión

El test usa un **sistema de gestión de cookies** para evitar resolver el captcha en cada ejecución:

- **Primera ejecución**: Hace login completo y guarda las cookies en `tests/fixtures/cookies.json`
- **Ejecuciones siguientes**: Carga las cookies y verifica si la sesión sigue válida
- **Si la sesión expiró**: Vuelve a hacer login completo y actualiza las cookies

**Ventajas:**
- ✅ No necesitas resolver el captcha cada vez
- ✅ Los tests son más rápidos en ejecuciones consecutivas
- ✅ Las cookies se guardan localmente (no se suben al repositorio)

## Estructura del proyecto (POM)

```
tests/
  fixtures/
    cookies.json    # Cookies de sesión guardadas (no se sube al repo)
  pages/
    login-page.ts   # Page Object: login y "Ver todos los coches"
    cars-page.ts    # Page Object: filtro Marca, Ver todas las marcas, Seleccionar todas las marcas
  specs/
    login.spec.ts           # Test: flujo de login usando LoginPage
    login-fail-otp.spec.ts  # Test: login fallido (OTP incorrecto) — no toca cookies
    view-all-cars.spec.ts   # Test: navegar a "Ver todos los coches" (reutiliza cookies si existen)
  utils/
    cookies.ts      # Utilidades para guardar/cargar cookies
```

- **Page Object** (`login-page.ts`): selectores en `SELECTORS`, métodos por paso (goto, fillPhone, clickContinueWhenEnabled, waitForOtpStepReady, fillOtp, tryAcceptCookieConsent, isSessionValid, performFullLogin).
- **Utils** (`cookies.ts`): funciones para guardar/cargar cookies de sesión.
- **Specs**: orquestan los pasos llamando al Page Object; cada paso va envuelto en `test.step()` para que se vea en la terminal.

## Bugs conocidos (QA)

Se documentan aquí comportamientos erróneos de la aplicación detectados durante las pruebas E2E, para trazabilidad y para que el equipo de desarrollo pueda corregirlos.

### Filtro Marca: desplegable se cierra al pulsar "Ver todas las marcas"

- **Qué ocurre**: Al pulsar en "Ver todas las marcas" dentro del filtro Marca, el filtro se aplica pero el desplegable se cierra. Para ver la lista de marcas hay que pulsar de nuevo en "Marca" para reabrir el desplegable.
- **Comportamiento esperado**: El desplegable debería permanecer abierto (o abrir la vista "todas las marcas") sin cerrarse.
- **Workaround en el test**: En `view-all-cars.spec.ts`, el **paso 7** ("Pulsar en Marca de nuevo") vuelve a pulsar en "Marca" en la misma página para reabrir el desplegable y poder continuar con el paso 8 ("Seleccionar todas las marcas").

## Configuración

- `playwright.config.ts`: timeout, navegador (Chromium/Chrome), viewport, etc.
- Los tests usan **Chrome** (`channel: 'chrome'` en la config).

## Automatización de OTP con CI/CD

Dado el enfoque del proyecto en **GitHub** y la intención de usar **Twilio**, esta sección detalla una estrategia para automatizar un flujo de autenticación con OTP (One-Time Password) enviado por SMS, integrándolo en pipelines CI/CD de manera segura y reproducible.

### Estrategia de Implementación

- **Número de prueba dedicado**: Utilización de un número de teléfono exclusivo (p. ej., Twilio) para entornos de QA/staging, totalmente aislado de producción.
- **Recuperación programática del OTP**: Los tests consultan una API (como la de Twilio) para filtrar el mensaje correcto y extraer el código OTP automáticamente.
- **Flujo E2E automatizado**: Un framework como Playwright introduce el OTP extraído para completar el login sin requerir intervención manual.

### Integración en CI/CD

- **Ejecución automática**: Los pipelines de integración continua (especialmente **GitHub Actions**, así como GitLab CI, Jenkins, etc.) ejecutan los tests de forma automatizada.
- **Conectividad**: El runner de CI/CD debe tener acceso a Internet para comunicarse con la API de Twilio.
- **Gestión segura de credenciales**: Las credenciales de Twilio y el número de prueba se almacenan en variables de entorno seguras (p. ej., GitHub Secrets, GitLab CI/CD Variables) y nunca se exponen en logs o el repositorio.
- **Robustez**: Se implementan mecanismos de *polling* y reintentos para asegurar la estabilidad frente a posibles retrasos en la entrega de SMS.

### Seguridad y Trazabilidad

- Las credenciales sensibles nunca se exponen.
- El flujo de pruebas en QA está completamente aislado y no impacta en el entorno de producción.

### Beneficios Clave

- **Tests reproducibles y fiables** en entornos de integración continua.
- **Eliminación de la dependencia** de teléfonos físicos o intervención manual.
- **Mantiene la seguridad y la integridad** del flujo de autenticación.
- Refleja **prácticas profesionales** de automatización en entornos de desarrollo reales.