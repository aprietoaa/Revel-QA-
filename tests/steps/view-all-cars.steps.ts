/**
 * Nombres de pasos del test "Ver todos los coches" (con sesión/cookies).
 * Centralizados para reutilizar en el spec y en futuros tests del flujo de coches.
 */

export const STEPS = {
  loadCookies: 'Cargar cookies guardadas (si existen)',
  verifySession: 'Verificar si la sesión es válida',
  ensureSession: 'Asegurar sesión válida (login si hace falta)',
  viewAllCars: 'Abrir "Ver todos los coches"',
  openBrand: 'Abrir filtro "Marca"',
  viewAllBrands: 'Pulsar "Ver todas las marcas"',
  reopenBrand:
    'Pulsar en Marca de nuevo (reabrir desplegable; workaround: se cierra al pulsar "Ver todas las marcas")',
  selectBrandOpel: 'Seleccionar marca Opel',
  listModels: 'Listar los modelos visibles (Opel Corsa, Opel Frontera, Opel MOKA, etc.)',
  exchangeType: 'Pulsar en tipo de cambio',
  selectManualTransmission: 'Seleccionar cambio manual',
  listModelsManual: 'Listar coches con cambio manual encontrados (repetir paso 9)',
  clickFirstCar: 'Seleccionar el coche',
  keepOpen: 'Mantener la página abierta (antes de cerrar)',
} as const;
