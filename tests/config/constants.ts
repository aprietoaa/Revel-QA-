/**
 * Constantes compartidas por los tests (login, coches, etc.).
 * Un solo sitio para evitar duplicar teléfono, OTP, etc. en cada spec.
 */

/** Teléfono usado en login (tests que requieren sesión o login fallido). */
export const PHONE = '879542345';

/** OTP correcto para login exitoso. */
export const OTP = '8048';

/** OTP incorrecto para test de login fallido. */
export const WRONG_OTP = '1111';
