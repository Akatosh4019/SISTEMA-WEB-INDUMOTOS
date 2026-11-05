import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Llegada {
  id: number;
  numeroGuia: string;
  fechaLlegada: string;
  receptorUsuario: string;
  cantidadDeclarada: number;
  cantidadRecibida: number;
  observacion: string | null;
}

@Component({
  selector: 'app-llegadas-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './llegadas.page.html',
  styleUrl: './llegadas.page.css'
})
export class LlegadasPage {
  private readonly http = inject(HttpClient);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly searchError = signal('');
  readonly result = signal<Llegada | null>(null);
  readonly searched = signal<Llegada | null>(null);
  form = { numeroGuia: '', cantidadDeclarada: 1, cantidadRecibida: 1, observacion: '' };
  searchId: number | null = null;

  registrar(): void {
    this.error.set('');
    if (!this.form.numeroGuia.trim() || this.form.cantidadDeclarada < 1 || this.form.cantidadRecibida < 1) {
      this.error.set('Completa la guía y las cantidades con valores mayores que cero.');
      return;
    }
    this.busy.set(true);
    this.http.post<Llegada>('/api/v1/llegadas', {
      numeroGuia: this.form.numeroGuia.trim(),
      cantidadDeclarada: Number(this.form.cantidadDeclarada),
      cantidadRecibida: Number(this.form.cantidadRecibida),
      observacion: this.form.observacion.trim()
    }).subscribe({
      next: llegada => { this.result.set(llegada); this.busy.set(false); },
      error: (error: unknown) => { this.error.set(this.message(error)); this.busy.set(false); }
    });
  }

  buscar(): void {
    this.searchError.set('');
    this.searched.set(null);
    if (!this.searchId || this.searchId < 1) {
      this.searchError.set('Ingresa un ID válido.');
      return;
    }
    this.searchBusy.set(true);
    this.http.get<Llegada>(`/api/v1/llegadas/${this.searchId}`).subscribe({
      next: llegada => { this.searched.set(llegada); this.searchBusy.set(false); },
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
