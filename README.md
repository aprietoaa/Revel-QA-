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

# Solo el spec de login
npm test -- tests/specs/login.spec.ts

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
5. **Esperar cierre de la página** – El test termina cuando se cierra la pestaña

### Flujo del test KO (Login exitoso para guardar sesión)

El test `login-ko.spec.ts` ahora contiene un único test que realiza un login exitoso. Su propósito principal es forzar un inicio de sesión limpio para guardar cookies válidas, que luego pueden ser utilizadas por el test `login.spec.ts` en ejecuciones posteriores (siempre y cuando las cookies no hayan expirado).

1. **Forzar borrado de cookies** – Para asegurar un estado limpio.
2. **Login exitoso** – Se realiza un login completo con OTP correcto.
3. **Guardar cookies** – Las cookies de esta sesión se guardan.

**Importante**: Este test también requiere la resolución manual del captcha.

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
    login-page.ts   # Page Object: selectores y acciones del login
  specs/
    login.spec.ts   # Test: flujo de login usando LoginPage
  utils/
    cookies.ts      # Utilidades para guardar/cargar cookies
```

- **Page Object** (`login-page.ts`): selectores en `SELECTORS`, métodos por paso (goto, fillPhone, clickContinueWhenEnabled, waitForOtpStepReady, fillOtp, acceptCookieConsent, isSessionValid, performFullLogin).
- **Utils** (`cookies.ts`): funciones para guardar/cargar cookies de sesión.
- **Specs**: orquestan los pasos llamando al Page Object; cada paso va envuelto en `test.step()` para que se vea en la terminal.

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