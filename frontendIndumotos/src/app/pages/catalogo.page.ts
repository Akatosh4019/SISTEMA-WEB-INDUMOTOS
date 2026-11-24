import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Opcion { id: number; marca: string; modelo: string; color: string; habilitado: boolean }

@Component({
  selector: 'app-catalogo-page',
  imports: [FormsModule],
  templateUrl: './catalogo.page.html',
  styleUrl: './catalogo.page.css'
})
export class CatalogoPage {
  private readonly http = inject(HttpClient);
  readonly opciones = signal<Opcion[]>([]);
  readonly marcas = computed(() => [...new Set(this.opciones().map(o => o.marca))]);
  readonly busy = signal(false);
  readonly cargando = signal(false);
  readonly cambiando = signal<number | null>(null);
  readonly error = signal('');
  readonly errorListado = signal('');
  readonly mensaje = signal('');
  readonly filtro = signal('');
  readonly estado = signal('TODOS');
  readonly filas = computed(() => {
    const texto = this.filtro().trim().toLocaleLowerCase();
    return this.opciones().filter(o =>
      (!texto || [o.marca,o.modelo,o.color].some(valor => valor.toLocaleLowerCase().includes(texto))) &&
      (this.estado() === 'TODOS' || o.habilitado === (this.estado() === 'HABILITADO')))
      .slice().sort((a,b) => a.marca.localeCompare(b.marca, 'es') ||
        a.modelo.localeCompare(b.modelo, 'es') || a.color.localeCompare(b.color, 'es') || a.id-b.id);
  });
  nueva = { marca: '', modelo: '', color: '' };

  constructor() { this.cargar(); }
  modelosDeMarca(): string[] {
    return [...new Set(this.opciones().filter(o => o.marca.toLowerCase() === this.nueva.marca.trim().toLowerCase())
      .map(o => o.modelo))];
  }
  cargar(): void {
    this.cargando.set(true);
    this.errorListado.set('');
    this.http.get<Opcion[]>('/api/v1/catalogo-motocicletas/administracion').subscribe({
      next: opciones => { this.opciones.set(opciones); this.cargando.set(false); },
      error: err => { this.errorListado.set(apiError(err)); this.cargando.set(false); }
    });
  }
  cambiarEstado(opcion: Opcion): void {
    if (this.cambiando() !== null || this.busy() || this.cargando()) return;
    this.cambiando.set(opcion.id);
    this.errorListado.set('');
    this.mensaje.set('');
    this.http.put<Opcion>(`/api/v1/catalogo-motocicletas/${opcion.id}/estado`,
      {habilitado: !opcion.habilitado}).subscribe({
      next: actualizada => {
        this.opciones.update(actual => actual.map(o => o.id === actualizada.id ? actualizada : o));
        this.cambiando.set(null);
        this.mensaje.set(`${actualizada.marca} · ${actualizada.modelo} · ${actualizada.color}: ${actualizada.habilitado ? 'habilitado' : 'deshabilitado'}.`);
      },
      error: err => { this.errorListado.set(apiError(err)); this.cambiando.set(null); }
    });
  }
  agregar(): void {
    if (this.busy() || this.cambiando() !== null || this.cargando()) return;
    const datos = { marca: this.nueva.marca.trim(), modelo: this.nueva.modelo.trim(), color: this.nueva.color.trim() };
    if (!datos.marca || !datos.modelo || !datos.color) return;
    this.busy.set(true); this.error.set(''); this.mensaje.set('');
    this.http.post('/api/v1/catalogo-motocicletas', datos).subscribe({
      next: () => { this.nueva.color = ''; this.busy.set(false);
        this.mensaje.set('Combinación agregada y habilitada. Ya está disponible en los formularios.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
