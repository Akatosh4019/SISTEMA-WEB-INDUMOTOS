import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Opcion { marca: string; modelo: string; color: string }

@Component({
  selector: 'app-catalogo-page',
  imports: [FormsModule],
  template: `<div class="form-page"><div class="eyebrow">INVENTARIO DE MOTOCICLETAS</div>
    <h1>Catálogo de motocicletas</h1><p class="lead">Define las marcas, sus modelos y los colores disponibles. Estos datos aparecerán como opciones al registrar una ficha y al hacer una solicitud.</p>
    <section class="panel"><h2>Agregar marca, modelo y color</h2><p class="hint">Puedes escribir una marca o modelo nuevo, o elegir uno existente. Para agregar otro color al mismo modelo, conserva la marca y el modelo y cambia el color.</p><form (ngSubmit)="agregar()" #f="ngForm">
      <div class="row"><div><label for="marca">Marca</label><input id="marca" name="marca" required maxlength="120" [(ngModel)]="nueva.marca" list="marcas" /><datalist id="marcas">@for (marca of marcas(); track marca) { <option [value]="marca"></option> }</datalist></div>
      <div><label for="modelo">Modelo de esa marca</label><input id="modelo" name="modelo" required maxlength="120" [(ngModel)]="nueva.modelo" list="modelos" /><datalist id="modelos">@for (modelo of modelosDeMarca(); track modelo) { <option [value]="modelo"></option> }</datalist></div></div>
      <label for="color">Color disponible para ese modelo</label><input id="color" name="color" required maxlength="120" [(ngModel)]="nueva.color" />
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (mensaje()) { <p class="message success" role="status">{{mensaje()}}</p> }
      <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Guardando...' : 'Agregar color al modelo'}}</button>
    </form></section>
    <section class="panel catalogo-list"><h2>Marcas, modelos y colores disponibles</h2>
      @for (marca of grupos(); track marca.nombre) { <div class="brand"><h3>{{marca.nombre}}</h3>
        @for (modelo of marca.modelos; track modelo.nombre) { <div class="model"><strong>{{modelo.nombre}}</strong><span>{{modelo.colores.join(' · ')}}</span></div> }
      </div> } @empty { <p>No hay combinaciones registradas.</p> }
    </section></div>`,
  styles: [`.catalogo-list{margin-top:20px}.brand{padding:16px 0;border-top:1px solid #e5e9ee}.brand h3{margin:0 0 10px;color:#193d61}.model{display:flex;justify-content:space-between;gap:16px;padding:8px 0;color:#405064}.model span{color:#6a788b;text-align:right}@media(max-width:600px){.model{display:grid;gap:3px}.model span{text-align:left}}`]
})
export class CatalogoPage {
  private readonly http = inject(HttpClient);
  readonly opciones = signal<Opcion[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly grupos = computed(() => this.marcas().map(nombre => ({ nombre, modelos: [...new Set(this.opciones()
    .filter(o => o.marca === nombre).map(o => o.modelo))].map(modelo => ({ nombre: modelo,
      colores: this.opciones().filter(o => o.marca === nombre && o.modelo === modelo).map(o => o.color) })) })));
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  nueva = { marca: '', modelo: '', color: '' };

  constructor() { this.cargar(); }
  modelosDeMarca(): string[] {
    return [...new Set(this.opciones().filter(o => o.marca.toLowerCase() === this.nueva.marca.trim().toLowerCase())
      .map(o => o.modelo))];
  }
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
      next: () => { this.nueva.color = ''; this.busy.set(false);
        this.mensaje.set('Color disponible agregado al modelo. Ya aparece en los formularios.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
