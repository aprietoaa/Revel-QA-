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
```

## Flujo del test de login

El test documenta cada paso en la terminal (con `test.step`):

1. **Ir a la página de login** – Navega a `https://driverevel.com/login`
2. **Rellenar teléfono y pulsar Continuar** – Introduce el teléfono y hace clic en Continuar
3. **Esperar captcha y paso OTP** – Espera a que el usuario resuelva el captcha manualmente y aparezca la imagen indicadora del paso OTP
4. **Escribir el código OTP** – Rellena el OTP (8048) en cuanto el paso está listo
5. **Aceptar cookies** – Acepta el popup de cookies (CybotCookiebot)
6. **Esperar cierre de la página** – El test termina cuando se cierra la pestaña

## Estructura del proyecto (POM)

```
tests/
  pages/
    login-page.ts   # Page Object: selectores y acciones del login
  specs/
    login.spec.ts   # Test: flujo de login usando LoginPage
```

- **Page Object** (`login-page.ts`): selectores en `SELECTORS`, métodos por paso (goto, fillPhone, clickContinueWhenEnabled, waitForOtpStepReady, fillOtp, acceptCookieConsent).
- **Specs**: orquestan los pasos llamando al Page Object; cada paso va envuelto en `test.step()` para que se vea en la terminal.

## Configuración

- `playwright.config.ts`: timeout, navegador (Chromium/Chrome), viewport, etc.
- Los tests usan **Chrome** (`channel: 'chrome'` en la config).
