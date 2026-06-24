/**
 * El backend devuelve fechas UTC, pero al releerlas de SQL Server pierden el
 * sufijo "Z" (Kind=Unspecified). Sin forzarlo, `new Date()` las interpretaría
 * como hora local del navegador. Confirmado contra el backend real: las
 * fechas recién creadas sí traen "Z", las releídas no — ambas son UTC.
 */
export function parseApiDate(value: string): Date {
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}
