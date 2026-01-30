import { expect, Page } from '@playwright/test';

/** Selectores reutilizables del flujo de login (POM) */
const SELECTORS = {
  phoneInput: 'xpath=/html/body/div[3]/div/div/div/div[2]/div[1]/form/div[1]/div[1]/div/div[2]/input',
  /**
   * Elemento que indica que el paso OTP está listo (párrafo visible tras el captcha).
   * XPath: /html/body/div[3]/div/div/div/div/div/div[2]/div/div[1]/div[3]/p[1]
   * Cuando está visible, ya se puede escribir el código OTP.
   */
  otpStepIndicator: 'xpath=/html/body/div[3]/div/div/div/div/div/div[2]/div/div[1]/div[3]/p[1]',
} as const;

/** URLs del flujo de login */
const URLS = {
  login: 'https://driverevel.com/login',
  /** URL para verificar si la sesión es válida (área protegida después del login) */
  dashboard: 'https://driverevel.com', // Ajustar según la URL real del dashboard
} as const;

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(URLS.login);
  }

  /**
   * Verifica si la sesión actual es válida navegando a una página protegida.
   * Retorna true si está logueado (no redirige al login), false si necesita login.
   */
  async isSessionValid(timeout = 10_000): Promise<boolean> {
    try {
      await this.page.goto(URLS.dashboard, { waitUntil: 'domcontentloaded', timeout });
      // Si estamos en login, la sesión no es válida
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        return false;
      }
      // Si no redirige a login, asumimos que la sesión es válida
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ejecuta el flujo completo de login: teléfono → captcha → OTP → cookies.
   */
  async performFullLogin(phone: string, otp: string): Promise<void> {
    await this.goto();
    await this.fillPhone(phone);
    await this.clickContinueWhenEnabled();
    await this.waitForOtpStepReady();
    await this.fillOtp(otp);
    await this.tryAcceptCookieConsent();
  }

  async fillPhone(phone: string) {
    await this.page.locator(SELECTORS.phoneInput).fill(phone);
  }

  async clickContinueWhenEnabled(timeout = 60_000) {
    const button = this.page.getByRole('button', { name: /continuar/i });
    await button.waitFor({ state: 'visible', timeout });
    await expect(button).toBeEnabled({ timeout });
    await button.click();
  }

  /**
   * Espera a que el paso OTP esté listo (p[1] visible tras el captcha).
   * No hay espera fija: solo se espera hasta que el elemento sea visible.
   */
  async waitForOtpStepReady(timeout = 5 * 60 * 1000) {
    await expect(this.page.locator(SELECTORS.otpStepIndicator)).toBeVisible({ timeout });
  }

  /**
   * Escribe el código OTP. Sin espera fija: solo espera a que los inputs sean visibles (timeout corto).
   */
  async fillOtp(code: string, timeout = 5_000) {
    const digitInputs = this.page.locator('input[maxlength="1"][type="text"], input[maxlength="1"][type="tel"]');
    const singleInput = this.page.locator('input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i]');

    try {
      await expect(digitInputs.first()).toBeVisible({ timeout });
      const count = await digitInputs.count();
      const len = Math.min(count, code.length);
      await Promise.all(
        Array.from({ length: len }, (_, i) => digitInputs.nth(i).fill(code[i]))
      );
      if (count < code.length) {
        await digitInputs.last().type(code.slice(count), { delay: 0 });
      }
      return;
    } catch (err) {
      // Fall back to single input field
    }

    const targetInput = singleInput.first();
    await expect(targetInput).toBeVisible({ timeout });
    await targetInput.fill(code);
  }

  async tryAcceptCookieConsent(timeout = 5_000): Promise<boolean> {
    const acceptButton = this.page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    try {
      await acceptButton.waitFor({ state: 'visible', timeout });
      await acceptButton.click();
      console.log('  ✓ Cookies aceptadas (popup visible)');
      return true;
    } catch (error) {
      console.log('  — Popup de cookies no visible, continuando...');
      return false;
    }
  }
}
