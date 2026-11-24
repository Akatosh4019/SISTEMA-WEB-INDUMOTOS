import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Opcion { id: number; marca: string; modelo: string; color: string; activo: boolean }
const POR_PAGINA = 10;

@Component({
  selector: 'app-catalogo-page',
  imports: [FormsModule],
  template: `<div class="im-page">
    <header class="page-heading"><div><span class="eyebrow">ADMINISTRACIÓN · DATOS MAESTROS</span><h1>Catálogo de motocicletas</h1>
      <p>Administración define marcas, modelos y colores. Un modelo que ya no se vende se <strong>desactiva</strong>: deja de ofrecerse en nuevas solicitudes, pero conserva su relación con las motos ya registradas.</p></div>
      <button type="button" class="im-btn" (click)="abrirNueva()">+ Agregar combinación</button></header>
    @if (mensaje()) { <p class="im-alert ok" role="status">{{mensaje()}}</p> }
    @if (error() && !formAbierto() && !confirmando()) { <p class="im-alert error" role="alert">{{error()}}</p> }
    <section class="im-card">
      <div class="im-toolbar">
        <div class="im-search"><input type="search" aria-label="Buscar en el catálogo" placeholder="Buscar por marca, modelo o color" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(0)" /></div>
        <select aria-label="Filtrar por estado" [ngModel]="estado()" (ngModelChange)="estado.set($event); pagina.set(0)">
          <option value="TODOS">Todos los estados</option><option value="ACTIVO">Solo activos</option><option value="INACTIVO">Solo inactivos</option>
        </select>
      </div>
      <div class="im-table-wrap"><table class="im-table">
        <thead><tr><th>Marca</th><th>Modelo</th><th>Color</th><th>Estado</th><th class="num">Acciones</th></tr></thead>
        <tbody>
          @for (o of visibles(); track o.id) {
            <tr><td><strong>{{o.marca}}</strong></td><td>{{o.modelo}}</td><td>{{o.color}}</td>
              <td><span class="im-badge" [class.ok]="o.activo" [class.off]="!o.activo">{{o.activo ? 'Activo' : 'Inactivo'}}</span></td>
              <td><div class="actions"><button type="button" class="im-btn small" [class.light]="o.activo" (click)="confirmar(o)">{{o.activo ? 'Desactivar' : 'Activar'}}</button></div></td></tr>
          } @empty { <tr><td colspan="5" class="im-empty">{{cargando() ? 'Cargando catálogo…' : 'No hay combinaciones que coincidan con la búsqueda.'}}</td></tr> }
        </tbody>
      </table></div>
      <div class="im-pager"><span>{{resumen()}}</span>
        @if (totalPaginas() > 1) { <div class="pages"><button type="button" class="im-btn small light" (click)="pagina.set(pagina() - 1)" [disabled]="pagina() === 0">Anterior</button><span>Página {{pagina() + 1}} de {{totalPaginas()}}</span><button type="button" class="im-btn small light" (click)="pagina.set(pagina() + 1)" [disabled]="pagina() + 1 >= totalPaginas()">Siguiente</button></div> }
      </div>
    </section>

    @if (formAbierto()) {
      <div class="im-overlay" (click)="cerrar()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="nueva-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">NUEVA COMBINACIÓN</span><h2 id="nueva-titulo">Agregar marca, modelo y color</h2></div><button type="button" class="im-dialog-close" (click)="cerrar()">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="agregar()" #f="ngForm">
          <p class="hint">Escribe una marca o modelo nuevo, o elige uno existente. Para otro color del mismo modelo, conserva marca y modelo y cambia el color.</p>
          <div class="two"><label>Marca<input name="marca" required maxlength="120" [(ngModel)]="nueva.marca" list="marcas" /></label>
            <label>Modelo<input name="modelo" required maxlength="120" [(ngModel)]="nueva.modelo" list="modelos" /></label></div>
          <datalist id="marcas">@for (marca of marcas(); track marca) { <option [value]="marca"></option> }</datalist>
          <datalist id="modelos">@for (modelo of modelosDeMarca(); track modelo) { <option [value]="modelo"></option> }</datalist>
          <label>Color<input name="color" required maxlength="120" [(ngModel)]="nueva.color" /></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="cerrar()">Cancelar</button><button type="submit" class="im-btn" [disabled]="ocupado() || !f.valid">{{ocupado() ? 'Guardando…' : 'Guardar combinación'}}</button></div>
        </form>
      </section></div>
    }

    @if (confirmando(); as o) {
      <div class="im-overlay" (click)="confirmando.set(null)"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="estado-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">{{o.activo ? 'DESACTIVAR' : 'ACTIVAR'}}</span><h2 id="estado-titulo">{{o.marca}} {{o.modelo}} · {{o.color}}</h2></div><button type="button" class="im-dialog-close" (click)="confirmando.set(null)">Cerrar</button></div>
        <p>{{o.activo ? 'Dejará de aparecer en las nuevas solicitudes de Comercial. Las motos ya registradas con esta combinación no cambian.' : 'Volverá a aparecer en las nuevas solicitudes de Comercial.'}}</p>
        @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
        <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="confirmando.set(null)">Cancelar</button><button type="button" class="im-btn" [class.danger]="o.activo" (click)="cambiarEstado(o)" [disabled]="ocupado()">{{o.activo ? 'Sí, desactivar' : 'Sí, activar'}}</button></div>
      </section></div>
    }
  </div>`
})
export class CatalogoPage {
  private readonly http = inject(HttpClient);
  readonly opciones = signal<Opcion[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
  readonly pagina = signal(0);
  readonly cargando = signal(false);
  readonly ocupado = signal(false);
  readonly formAbierto = signal(false);
  readonly confirmando = signal<Opcion | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');
  nueva = { marca: '', modelo: '', color: '' };

  readonly marcas = computed(() => [...new Set(this.opciones().map(o => o.marca))]);
  readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.opciones().filter(o => (this.estado() === 'TODOS' || o.activo === (this.estado() === 'ACTIVO'))
      && (!texto || `${o.marca} ${o.modelo} ${o.color}`.toLowerCase().includes(texto)));
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)));
  readonly visibles = computed(() => this.filtradas().slice(this.pagina() * POR_PAGINA, (this.pagina() + 1) * POR_PAGINA));
  readonly resumen = computed(() => {
    const total = this.filtradas().length;
    if (!total) return 'Sin resultados';
    const desde = this.pagina() * POR_PAGINA + 1;
    return `Mostrando ${desde}–${Math.min(desde + POR_PAGINA - 1, total)} de ${total} combinaciones`;
  });

  constructor() { this.cargar(); }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cerrar(); this.confirmando.set(null); }

  modelosDeMarca(): string[] {
    const marca = this.nueva.marca.trim().toLowerCase();
    return [...new Set(this.opciones().filter(o => o.marca.toLowerCase() === marca).map(o => o.modelo))];
  }
  cargar(): void {
    this.cargando.set(true);
    this.http.get<Opcion[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.cargando.set(false);
        if (this.pagina() >= this.totalPaginas()) this.pagina.set(0); },
      error: err => { this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }
  abrirNueva(): void { this.nueva = { marca: '', modelo: '', color: '' }; this.error.set(''); this.mensaje.set(''); this.formAbierto.set(true); }
  cerrar(): void { if (!this.ocupado()) { this.formAbierto.set(false); this.error.set(''); } }
  confirmar(o: Opcion): void { this.error.set(''); this.mensaje.set(''); this.confirmando.set(o); }

  agregar(): void {
    const datos = { marca: this.nueva.marca.trim(), modelo: this.nueva.modelo.trim(), color: this.nueva.color.trim() };
    if (!datos.marca || !datos.modelo || !datos.color || this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.post<Opcion>('/api/v1/catalogo-motocicletas', datos).subscribe({
      next: () => { this.ocupado.set(false); this.formAbierto.set(false);
        this.mensaje.set(`${datos.marca} ${datos.modelo} · ${datos.color} se agregó al catálogo.`); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  cambiarEstado(o: Opcion): void {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.put<Opcion>(`/api/v1/catalogo-motocicletas/${o.id}/estado`, { activo: !o.activo }).subscribe({
      next: actual => { this.ocupado.set(false); this.confirmando.set(null);
        this.opciones.update(lista => lista.map(x => x.id === actual.id ? actual : x));
        this.mensaje.set(`${actual.marca} ${actual.modelo} · ${actual.color} quedó ${actual.activo ? 'activo' : 'inactivo'}.`); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
}
