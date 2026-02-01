/**
 * Nombres de pasos del test "Ver todos los coches, aplicar filtros, limpiar filtros y listar de nuevo".
 */

export const STEPS = {
  loadCookies: 'Cargar cookies guardadas (si existen)',
  verifySession: 'Verificar si la sesión es válida',
  ensureSession: 'Asegurar sesión válida (login si hace falta)',
  viewAllCars: 'Abrir "Ver todos los coches"',
  openBrand: 'Abrir filtro "Marca"',
  viewAllBrands: 'Pulsar "Ver todas las marcas"',
  reopenBrand: 'Pulsar en Marca de nuevo (reabrir desplegable)',
  selectBrandOpel: 'Seleccionar marca Opel',
  listModels: 'Listar modelos visibles (Opel)',
  exchangeType: 'Pulsar en tipo de cambio',
  selectManualTransmission: 'Seleccionar cambio manual',
  listModelsManual: 'Listar coches con filtros (Opel + Manual)',
  clearFilters: 'Limpiar / resetear filtros',
  listModelsAfterClear: 'Confirmar filtros limpiados (listado sin filtros visible)',
  keepOpen: 'Mantener la página abierta (antes de cerrar)',
} as const;
