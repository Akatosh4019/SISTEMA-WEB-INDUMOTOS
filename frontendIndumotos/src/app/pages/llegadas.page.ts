import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface Llegada {
  id: number;
  numeroGuia: string;
  fechaLlegada: string;
  receptorUsuario: string;
  cantidadDeclarada: number;
  cantidadRecibida: number;
  observacion: string | null;
}

interface FichaVinculada {
  id: number;
  llegadaId: number;
  marca: string;
  modelo: string;
  color: string;
  chasisCompleto: string;
}

interface DetalleLlegada {
  llegada: Llegada;
  fichas: FichaVinculada[];
  cantidadFichas: number;
  diferenciaInformativa: number;
}

@Component({
  selector: 'app-llegadas-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './llegadas.page.html',
  styleUrl: './llegadas.page.css'
})
export class LlegadasPage {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Partial<Record<'numeroGuia' | 'cantidadDeclarada' | 'cantidadRecibida', string>>>({});
  readonly searchError = signal('');
  readonly result = signal<Llegada | null>(null);
  readonly detail = signal<DetalleLlegada | null>(null);
  form: { numeroGuia: string; cantidadDeclarada: number | null; cantidadRecibida: number | null; observacion: string } =
    { numeroGuia: '', cantidadDeclarada: 1, cantidadRecibida: 1, observacion: '' };
  searchId: number | null = null;

  registrar(): void {
    this.error.set('');
    this.fieldErrors.set({});
    const errores: Partial<Record<'numeroGuia' | 'cantidadDeclarada' | 'cantidadRecibida', string>> = {};
    if (!this.form.numeroGuia.trim()) errores.numeroGuia = 'Ingresa el número de guía.';
    if (!Number.isSafeInteger(this.form.cantidadDeclarada) || (this.form.cantidadDeclarada ?? 0) <= 0)
      errores.cantidadDeclarada = 'Ingresa una cantidad declarada entera mayor que cero.';
    if (!Number.isSafeInteger(this.form.cantidadRecibida) || (this.form.cantidadRecibida ?? 0) <= 0)
      errores.cantidadRecibida = 'Ingresa una cantidad recibida entera mayor que cero.';
    if (Object.keys(errores).length) { this.fieldErrors.set(errores); this.error.set('Corrige los campos marcados.'); return; }
    this.busy.set(true);
    this.http.post<Llegada>('/api/v1/llegadas', {
      numeroGuia: this.form.numeroGuia.trim(),
      cantidadDeclarada: Number(this.form.cantidadDeclarada),
      cantidadRecibida: Number(this.form.cantidadRecibida),
      observacion: this.form.observacion.trim()
    }).subscribe({
      next: llegada => { this.result.set(llegada); this.busy.set(false); },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 400) {
          const details = error.error as { errores?: Record<string, string> } | null;
          const fields = details?.errores ?? {};
          this.fieldErrors.set({ numeroGuia: fields['numeroGuia'],
            cantidadDeclarada: fields['cantidadDeclarada'], cantidadRecibida: fields['cantidadRecibida'] });
          this.error.set(Object.keys(fields).length ? 'Corrige los campos marcados.' : 'Revisa el formato de la llegada.');
        } else this.error.set(this.message(error));
        this.busy.set(false);
      }
    });
  }

  buscar(): void {
    this.searchError.set('');
    this.detail.set(null);
    if (!this.searchId || this.searchId < 1) {
      this.searchError.set('Ingresa un ID válido.');
      return;
    }
    this.searchBusy.set(true);
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${this.searchId}/detalle`).subscribe({
      next: detalle => { this.detail.set(detalle); this.searchBusy.set(false); },
      error: (error: unknown) => { this.searchError.set(this.message(error)); this.searchBusy.set(false); }
    });
  }

  private message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar la operación.';
    if (error.status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';
    if (error.status === 404) return 'No se encontró la llegada solicitada.';
    if (error.status === 400) return 'Revisa los datos ingresados.';
    return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }
}
