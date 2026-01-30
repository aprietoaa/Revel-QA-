/**
 * Nombres de pasos del test de login fallido (OTP incorrecto).
 * Centralizados para reutilizar en el spec y en futuros tests de login fallido.
 */

export const STEPS = {
  gotoLogin: 'Ir a la página de login',
  fillPhoneAndContinue: 'Rellenar teléfono y pulsar Continuar',
  waitCaptchaAndOtp: 'Esperar captcha y paso OTP',
  fillWrongOtp: 'Introducir OTP incorrecto',
  acceptCookiesIfVisible: 'Aceptar cookies si aparece',
  verifyLoginFailed: 'Verificar fallo por OTP incorrecto',
} as const;
