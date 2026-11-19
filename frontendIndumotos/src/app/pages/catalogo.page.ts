import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Opcion { marca: string; modelo: string; color: string }

@Component({
  selector: 'app-catalogo-page',
  imports: [FormsModule],
  template: `<div class="form-page"><div class="eyebrow">INVENTARIO DE MOTOCICLETAS</div>
    <h1>Catálogo de motocicletas</h1><p class="lead">Agrega las combinaciones de marca, modelo y color que Inventarios podrá registrar y Comercial podrá solicitar.</p>
    <section class="panel"><h2>Agregar al catálogo</h2><form (ngSubmit)="agregar()" #f="ngForm">
      <div class="row"><div><label for="marca">Marca</label><input id="marca" name="marca" required maxlength="120" [(ngModel)]="nueva.marca" list="marcas" /><datalist id="marcas">@for (marca of marcas(); track marca) { <option [value]="marca"></option> }</datalist></div>
      <div><label for="modelo">Modelo</label><input id="modelo" name="modelo" required maxlength="120" [(ngModel)]="nueva.modelo" /></div></div>
      <label for="color">Color</label><input id="color" name="color" required maxlength="120" [(ngModel)]="nueva.color" />
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (mensaje()) { <p class="message success" role="status">{{mensaje()}}</p> }
      <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Guardando...' : 'Agregar combinación'}}</button>
    </form></section>
    <section class="panel catalogo-list"><h2>Combinaciones disponibles</h2>
      @for (opcion of opciones(); track opcion.marca + opcion.modelo + opcion.color) {
        <div class="detail-row"><span>{{opcion.marca}} {{opcion.modelo}}</span><strong>{{opcion.color}}</strong></div>
      } @empty { <p>No hay combinaciones registradas.</p> }
    </section></div>`,
  styles: [`.catalogo-list{margin-top:20px}`]
})
export class CatalogoPage {
  private readonly http = inject(HttpClient);
  readonly opciones = signal<Opcion[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  nueva = { marca: '', modelo: '', color: '' };

  constructor() { this.cargar(); }
  cargar(): void {
    this.http.get<Opcion[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => this.error.set(apiError(err))
    });
  }
  agregar(): void {
    const datos = { marca: this.nueva.marca.trim(), modelo: this.nueva.modelo.trim(), color: this.nueva.color.trim() };
    if (!datos.marca || !datos.modelo || !datos.color) return;
    this.busy.set(true); this.error.set(''); this.mensaje.set('');
    this.http.post<Opcion>('/api/v1/catalogo-motocicletas', datos).subscribe({
      next: () => { this.nueva = { marca: '', modelo: '', color: '' }; this.busy.set(false);
        this.mensaje.set('Combinación agregada al catálogo.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
