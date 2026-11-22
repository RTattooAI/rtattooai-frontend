/**
 * Fuerza la descarga de un blob ya recibido. Las exportaciones viajan con el token
 * en la cabecera, así que no se pueden abrir con un enlace normal: hay que pedirlas
 * por HTTP y entregar el resultado al navegador aquí.
 */
export function downloadBlob(blob: Blob, namePrefix: string, extension = 'csv'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${namePrefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
