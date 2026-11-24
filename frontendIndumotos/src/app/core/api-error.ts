import { HttpErrorResponse } from '@angular/common/http';

export function apiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar la operación.';
  if (error.status === 0) return 'No se pudo conectar con el servidor.';
  if (error.status === 401) return 'La sesión terminó. Ingresa nuevamente.';
  const body = error.error as { error?: string; campos?: string[] } | null;
  const mensaje = typeof body?.error === 'string' && body.error.trim() ? body.error : '';
  if (error.status === 403) return mensaje || 'Tu cuenta no tiene permiso para esta acción.';
  if (error.status === 404) return mensaje || 'No se encontró el registro.';
  if (error.status === 409) return mensaje || 'El registro ya existe.';
  if (error.status === 400 && body?.campos?.length) return `Revisa estos campos: ${body.campos.join(', ')}.`;
  if (error.status === 400) return mensaje || 'Revisa los datos ingresados.';
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
