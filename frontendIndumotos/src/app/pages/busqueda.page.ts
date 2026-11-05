import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { apiError } from '../core/api-error';

interface Encontrada { id: number; marca: string; modelo: string; color: string; chasisCompleto: string; }
interface Pagina { items: Encontrada[]; pagina: number; tamano: number; totalElementos: number; totalPaginas: number; }

@Component({
  selector: 'app-busqueda-page', imports: [FormsModule, RouterLink],
  template: `<div class="form-page">
    <div class="eyebrow">IDENTIFICACIÓN DE MOTOCICLETAS</div>
    <h1>Buscar motocicleta</h1><p class="lead">Busca por chasis completo o por su terminación y elige la unidad correcta.</p>
    <section class="panel search-panel"><form (ngSubmit)="buscar()">
      <label for="modoBusqueda">Buscar por</label>
      <select id="modoBusqueda" name="modoBusqueda" [(ngModel)]="modo" (ngModelChange)="cambiarModo()" [disabled]="busy()">
        <option value="completo">Chasis completo</option><option value="terminacion">Últimos cuatro caracteres</option>
      </select>
      <label for="chasisBusqueda">{{modo === 'completo' ? 'Chasis completo' : 'Últimos cuatro caracteres del chasis'}}</label>
      <input id="chasisBusqueda" name="chasisBusqueda" [(ngModel)]="consulta" [maxlength]="modo === 'completo' ? 120 : 4" autocomplete="off" [disabled]="busy()" />
      <p class="hint">{{modo === 'completo' ? 'La coincidencia debe ser exacta. No necesitas conocer el ID de ficha.' : 'Conserva los ceros iniciales. Puede haber varias motocicletas con la misma terminación.'}}</p>
      <div class="actions"><button type="submit" [disabled]="busy()">{{busy() ? 'Buscando…' : 'Buscar'}}</button>
        <button type="button" class="tertiary" (click)="limpiar()" [disabled]="busy()">Limpiar</button></div>
    </form></section>
    @if (error()) { <p role="alert" class="message error search-error">{{error()}}</p> }
    @if (resultado(); as pagina) {
      <section class="results" aria-live="polite"><h2>{{pagina.totalElementos}} {{pagina.totalElementos === 1 ? 'motocicleta encontrada' : 'motocicletas encontradas'}}</h2>
        <p class="hint">Consulta aplicada: {{aplicada}} · {{modoAplicado === 'completo' ? 'Chasis completo' : 'Últimos cuatro'}}. Compara modelo, color y chasis antes de abrir la ficha.</p>
        @if (!pagina.totalElementos) { <div class="empty">No se encontraron motocicletas con ese chasis.</div> }
        <div class="result-grid">@for (item of pagina.items; track item.id) {
          <article class="panel result-card"><div class="eyebrow">{{item.marca}}</div><h2>{{item.modelo}}</h2><p class="result-color">Color: {{item.color}}</p>
            <span class="hint">CHASIS COMPLETO</span><strong class="chassis">{{item.chasisCompleto}}</strong>
            <a [routerLink]="['/app/fichas']" [queryParams]="{id: item.id}" [attr.aria-label]="'Consultar ficha ' + item.id + ' de ' + item.modelo + ', ' + item.color">Consultar ficha #{{item.id}} →</a>
          </article>
        }</div>
        @if (pagina.totalPaginas > 1) { <nav class="pagination" aria-label="Páginas de búsqueda">
          <button class="secondary" type="button" [disabled]="busy() || pagina.pagina === 0" (click)="cargar(pagina.pagina - 1)">Anterior</button>
          <span>Página {{pagina.pagina + 1}} de {{pagina.totalPaginas}}</span>
          <button class="secondary" type="button" [disabled]="busy() || pagina.pagina + 1 >= pagina.totalPaginas" (click)="cargar(pagina.pagina + 1)">Siguiente</button>
        </nav> }
      </section>
    } @else if (!busy() && !error()) { <p class="hint initial">Ingresa un chasis para comenzar. La búsqueda no selecciona automáticamente una unidad.</p> }
  </div>`,
  styles: [`.search-panel{max-width:680px}.search-panel .hint{margin:0 0 18px}.search-error{margin-top:20px}.results{margin-top:30px}.result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.result-card h2{margin-top:12px}.result-color{color:#52647b}.chassis{display:block;overflow-wrap:anywhere;margin:8px 0 22px}.result-card a{color:#b43c24;font-weight:700;text-decoration:none}.pagination{display:flex;align-items:center;gap:16px;margin-top:24px;flex-wrap:wrap}.initial{margin-top:24px}@media(max-width:760px){.result-grid{grid-template-columns:1fr}}`]
})
export class BusquedaPage implements OnDestroy {
  private readonly http = inject(HttpClient);
  private pending?: Subscription;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly resultado = signal<Pagina | null>(null);
  modo: 'completo' | 'terminacion' = 'completo';
  consulta = '';
  aplicada = '';
  modoAplicado: 'completo' | 'terminacion' = 'completo';

  buscar(): void {
    if (this.busy()) return;
    const query = this.consulta.trim();
    this.resultado.set(null); this.error.set('');
    if (!query || query.length > 120 || (this.modo === 'terminacion' && query.length !== 4)) {
      this.error.set(this.modo === 'terminacion' ? 'Ingresa exactamente los cuatro caracteres finales.' : 'Ingresa el chasis completo, de hasta 120 caracteres.'); return;
    }
    this.aplicada = query; this.modoAplicado = this.modo; this.cargar(0);
  }
  cargar(pagina: number): void {
    if (this.busy() || !this.aplicada || pagina < 0) return;
    this.busy.set(true); this.error.set('');
    const key = this.modoAplicado === 'completo' ? 'chasisCompleto' : 'ultimosCuatro';
    this.pending = this.http.get<Pagina>('/api/v1/motocicletas/busqueda', {
      params: { [key]: this.aplicada, pagina, tamano: 20 }
    }).subscribe({
      next: page => { this.resultado.set(page); this.busy.set(false); },
      error: error => { this.resultado.set(null); this.error.set(apiError(error)); this.busy.set(false); }
    });
  }
  cambiarModo(): void { this.limpiar(); }
  limpiar(): void {
    this.pending?.unsubscribe(); this.busy.set(false); this.consulta = ''; this.aplicada = '';
    this.resultado.set(null); this.error.set('');
  }
  ngOnDestroy(): void { this.pending?.unsubscribe(); }
}
