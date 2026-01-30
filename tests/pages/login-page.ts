import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/** Selectores reutilizables del flujo de login (POM) */
const SELECTORS = {
  phoneInput: 'xpath=/html/body/div[3]/div/div/div/div[2]/div[1]/form/div[1]/div[1]/div/div[2]/input',
  /**
   * Elemento que indica que el paso OTP está listo (párrafo visible tras el captcha).
   * XPath: /html/body/div[3]/div/div/div/div/div/div[2]/div/div[1]/div[3]/p[1]
   * Cuando está visible, ya se puede escribir el código OTP.
   */
  otpStepIndicator: 'xpath=/html/body/div[3]/div/div/div/div/div/div[2]/div/div[1]/div[3]/p[1]',
  /** CTA "Ver todos los coches" */
  viewAllCarsCta: 'xpath=/html/body/div[3]/div[2]/div/div[3]/div/div[1]/a/p',
  viewAllCarsLink: 'xpath=/html/body/div[3]/div[2]/div/div[3]/div/div[1]/a',
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

  async gotoDashboard(timeout = 30_000) {
    await this.page.goto(URLS.dashboard, { waitUntil: 'domcontentloaded', timeout });
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
      logger.success('Cookies aceptadas (popup visible)');
      return true;
    } catch (error) {
      logger.muted('Popup de cookies no visible, continuando...');
      return false;
    }
  }

  async clickViewAllCars(timeout = 30_000) {
    const beforeUrl = this.page.url();
    const debug = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.DEBUG_SELECTORS ?? '').toLowerCase());

    const candidates: Array<{ name: string; locator: ReturnType<Page['locator']> }> = [
      {
        name: 'role=link[name~="Ver todos los coches"]',
        locator: this.page.getByRole('link', { name: /ver todos los coches/i }),
      },
      {
        name: 'text="Ver todos los coches"',
        locator: this.page.getByText(/ver todos los coches/i).first(),
      },
      {
        name: 'xpath <a>',
        locator: this.page.locator(SELECTORS.viewAllCarsLink),
      },
      {
        name: 'xpath <p> (original)',
        locator: this.page.locator(SELECTORS.viewAllCarsCta),
      },
    ];

    const tryClick = async (name: string, locator: ReturnType<Page['locator']>) => {
      const target = locator.first();

      if (debug) {
        const count = await locator.count().catch(() => 0);
        logger.info(`Intentando click: ${name} (matches: ${count})`);
      }

      await target.waitFor({ state: 'visible', timeout });
      await target.scrollIntoViewIfNeeded();

      // Diagnóstico: ¿qué elemento está encima del target?
      if (debug) {
        const box = await target.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          const top = await this.page
            .evaluate(({ x, y }) => {
              const el = document.elementFromPoint(x, y) as HTMLElement | null;
              if (!el) return null;
              const text = (el.innerText || el.textContent || '').trim().slice(0, 120);
              return {
                tag: el.tagName,
                id: el.id || null,
                className: el.className ? String(el.className).slice(0, 120) : null,
                text: text || null,
              };
            }, { x, y })
            .catch(() => null);
          if (top) {
            logger.muted(
              `Elemento encima (center point): <${top.tag.toLowerCase()}> id=${top.id ?? '-'} class=${top.className ?? '-'} text=${top.text ?? '-'}`
            );
          }
        }
      }

      // Detectar si abre en otra pestaña
      const newPagePromise = this.page.context().waitForEvent('page', { timeout: 4_000 }).catch(() => null);

      try {
        await target.click({ timeout });
      } catch (error) {
        if (debug) logger.warn(`Click normal falló (${name}). Reintentando con force...`);
        await target.click({ timeout, force: true });
      }

      const newPage = await newPagePromise;
      if (newPage) {
        await newPage.waitForLoadState('domcontentloaded').catch(() => {});
        if (debug) logger.success(`Abierto en nueva pestaña: ${newPage.url()}`);
        return;
      }

      // Si no abre pestaña nueva, esperamos a que haya algún cambio (URL o carga)
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      await this.page.waitForTimeout(500);

      const afterUrl = this.page.url();
      if (afterUrl !== beforeUrl) {
        if (debug) logger.success(`Navegación detectada: ${beforeUrl} → ${afterUrl}`);
        return;
      }

      // Último recurso: disparar click vía DOM (evita algunas capas con listeners raros)
      if (debug) logger.warn(`No se detectó navegación tras el click (${name}). Intentando click vía DOM...`);
      await target.dispatchEvent('click');
      await this.page.waitForTimeout(750);
      if (debug) {
        const afterUrl2 = this.page.url();
        logger.info(`URL tras click DOM: ${afterUrl2}`);
      }
    };

    let lastError: unknown = null;
    for (const c of candidates) {
      try {
        await tryClick(c.name, c.locator);
        return;
      } catch (error) {
        lastError = error;
        if (debug) logger.warn(`No funcionó ${c.name}. Probando siguiente opción...`);
      }
    }

    throw new Error(`No se pudo clicar "Ver todos los coches". Último error: ${String(lastError)}`);
  }
}
