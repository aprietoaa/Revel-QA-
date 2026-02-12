import { expect, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/** Selectores reutilizables del flujo de login (POM) */
const SELECTORS = {
  /** Input de teléfono: por atributos estables (autocomplete, inputmode) en lugar de XPath frágil */
  phoneInput: 'input[autocomplete="tel"][inputmode="tel"], input[name="phone number"]',
  /**
   * Input único OTP: dentro del wrapper del modal (selector que apunta al input del código).
   * Usamos class*="otp_wrapper" para no depender del hash (D7qu7 puede cambiar en build).
   */
  otpSingleInput:
    'div[class*="otp_wrapper"] form input, input[autocomplete="one-time-code"][inputmode="numeric"], input[autocomplete="one-time-code"]',
  /** Inputs de OTP por dígito (maxlength=1) por si la página usa varias cajas */
  otpDigitInputs:
    'input[maxlength="1"][type="text"], input[maxlength="1"][type="tel"], input[inputmode="numeric"][maxlength="1"]',
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
   * Ejecuta el flujo completo de login: teléfono → (captcha a mano) → OTP → cookies.
   */
  async performFullLogin(phone: string, otp: string): Promise<void> {
    await this.goto();
    await this.fillPhone(phone);
    await this.clickContinueWhenEnabled();
    await this.waitForOtpStepReady();
    await this.fillOtp(otp);
    await this.tryAcceptCookieConsent();
  }

  async fillPhone(phone: string, timeout = 15_000) {
    const input = this.page.locator(SELECTORS.phoneInput).first();
    await input.waitFor({ state: 'visible', timeout });
    await input.click();
    await input.fill(phone);
  }

  async clickContinueWhenEnabled(timeout = 60_000) {
    const button = this.page.getByRole('button', { name: /continuar/i });
    await button.waitFor({ state: 'visible', timeout });
    await expect(button).toBeEnabled({ timeout });
    await button.click();
  }

  /**
   * Espera a que el paso del código esté listo: el textbox del dialog visible
   * (el mismo que rellenamos en fillOtp). No depende del texto ("Introduce el código", "OTP", etc.).
   */
  async waitForOtpStepReady(timeout = 5 * 60 * 1000) {
    const codeInput = this.page.getByRole('dialog').getByRole('textbox');
    await expect(codeInput).toBeVisible({ timeout });
  }

  /**
   * Escribe el código OTP. Usa el textbox del dialog (lo que generó codegen).
   * Fallback a selectores por atributos / otp_wrapper.
   */
  async fillOtp(code: string, timeout = 15_000) {
    const dialogInput = this.page.getByRole('dialog').getByRole('textbox');
    const singleInput = this.page.locator(SELECTORS.otpSingleInput).first();
    const digitInputs = this.page.locator(SELECTORS.otpDigitInputs);

    try {
      await dialogInput.waitFor({ state: 'visible', timeout });
      await dialogInput.click();
      await dialogInput.fill(code);
      logger.success('OTP rellenado (dialog textbox)');
      return;
    } catch {
      // Fallback: selectores por atributos / otp_wrapper
    }

    try {
      await singleInput.waitFor({ state: 'visible', timeout });
      await singleInput.click();
      await singleInput.fill(code);
      return;
    } catch {
      // Fallback: varios inputs de un dígito
    }

    await digitInputs.first().waitFor({ state: 'visible', timeout });
    const count = await digitInputs.count();
    const len = Math.min(count, code.length);
    for (let i = 0; i < len; i++) {
      const input = digitInputs.nth(i);
      await input.click();
      await input.fill(code[i]);
    }
    if (count < code.length) {
      const last = digitInputs.last();
      await last.click();
      await last.type(code.slice(count), { delay: 0 });
    }
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

  /**
   * Verifica que el usuario tiene login correcto y NO está en sesión anónima.
   *
   * Comprobaciones:
   * 1. URL: no estamos en /login (sesión anónima suele redirigir ahí).
   * 2. Header: existe texto de iniciales en li[8]/div/p (ej. "J P" => "JP"); si en su lugar
   *    aparece el enlace de login (href="/login" o aria-label="Login"), es sesión anónima.
   *
   * Devuelve las iniciales normalizadas. Lanza error si está anónimo o no se puede determinar.
   */
  async assertLoggedInAndGetInitials(timeout = 10_000): Promise<string> {
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Sesión anónima: la URL es de login. Se requiere sesión válida.');
    }

    const container = this.page.locator('xpath=/html/body/header/ul/li[8]').first();
    const initialsNode = container.locator('xpath=.//div/p').first();
    const loginLink = container.locator('a[href="/login"], a[aria-label="Login"]').first();

    await container.waitFor({ state: 'attached', timeout }).catch(() => {});

    await Promise.race([
      initialsNode.waitFor({ state: 'visible', timeout }),
      loginLink.waitFor({ state: 'visible', timeout }),
    ]).catch(() => {});

    const initialsVisible = await initialsNode.isVisible().catch(() => false);
    if (initialsVisible) {
      const raw = (await initialsNode.innerText().catch(() => '')).trim();
      const normalized = raw.replace(/\s+/g, '');
      if (normalized) {
        logger.success(`Sesión activa (no anónima). Iniciales detectadas: ${normalized}`);
        return normalized;
      }
    }

    const loginVisible = await loginLink.isVisible().catch(() => false);
    if (loginVisible) {
      throw new Error('Sesión anónima: se detectó el enlace de login en el header. Se requiere sesión válida.');
    }

    throw new Error('No se pudo determinar si la sesión es válida (sin iniciales ni enlace de login en el header).');
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

      // Si no abre pestaña nueva, esperamos a que la URL cambie (navegación en la misma pestaña)
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      await this.page.waitForURL((url) => url.href !== beforeUrl, { timeout: 5_000 }).catch(() => {});

      const afterUrl = this.page.url();
      if (afterUrl !== beforeUrl) {
        if (debug) logger.success(`Navegación detectada: ${beforeUrl} → ${afterUrl}`);
        return;
      }

      // Último recurso: disparar click vía DOM (evita algunas capas con listeners raros)
      if (debug) logger.warn(`No se detectó navegación tras el click (${name}). Intentando click vía DOM...`);
      await target.dispatchEvent('click');
      await this.page.waitForURL((url) => url.href !== beforeUrl, { timeout: 3_000 }).catch(() => {});
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
