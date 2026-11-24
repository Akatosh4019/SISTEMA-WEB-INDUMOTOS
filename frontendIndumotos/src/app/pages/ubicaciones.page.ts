import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Sede { id: number; codigo: string; nombre: string; tipo: string; referencia?: string | null; activo?: boolean }
const TIPOS: Record<string, string> = { ALMACEN: 'Almacén', TIENDA: 'Tienda', TALLER: 'Taller', DESPACHO: 'Despacho' };
const POR_PAGINA = 10;

@Component({
  selector: 'app-ubicaciones', imports: [FormsModule, RouterLink],
  template: `<div class="im-page">
    <header class="page-heading"><div><span class="eyebrow">CONTROL DE INVENTARIO</span><h1>Ubicaciones</h1>
      <p>Almacenes, tiendas y talleres de la empresa. Para ver dónde está una moto y su recorrido, o para registrar su movimiento, usa <a routerLink="/app/seguimiento">Seguimiento</a>.</p></div>
      @if (esAdmin()) { <button type="button" class="im-btn" (click)="abrir(null)">+ Agregar ubicación</button> }</header>
    @if (mensaje()) { <p class="im-alert ok" role="status">{{mensaje()}}</p> }
    @if (error() && !formAbierto() && !confirmando()) { <p class="im-alert error" role="alert">{{error()}}</p> }
    <section class="im-card">
      <div class="im-toolbar">
        <div class="im-search"><input type="search" aria-label="Buscar ubicación" placeholder="Buscar por código, nombre o referencia" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(0)" /></div>
        <select aria-label="Filtrar por tipo" [ngModel]="tipo()" (ngModelChange)="tipo.set($event); pagina.set(0)">
          <option value="">Todos los tipos</option>@for (t of tipos; track t[0]) { <option [value]="t[0]">{{t[1]}}</option> }
        </select>
      </div>
      <div class="im-table-wrap"><table class="im-table">
        <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Referencia</th><th>Estado</th>@if (esAdmin()) { <th class="num">Acciones</th> }</tr></thead>
        <tbody>
          @for (s of visibles(); track s.id) {
            <tr><td><span class="muted">{{s.codigo}}</span></td><td><strong>{{s.nombre}}</strong></td><td>{{nombreTipo(s.tipo)}}</td>
              <td>{{s.referencia || '—'}}</td>
              <td><span class="im-badge" [class.ok]="s.activo !== false" [class.off]="s.activo === false">{{s.activo === false ? 'Inactiva' : 'Activa'}}</span></td>
              @if (esAdmin()) { <td><div class="actions"><button type="button" class="im-btn small light" (click)="abrir(s)">Editar</button>
                <button type="button" class="im-btn small" [class.light]="s.activo !== false" (click)="confirmar(s)">{{s.activo === false ? 'Activar' : 'Desactivar'}}</button></div></td> }</tr>
          } @empty { <tr><td [attr.colspan]="esAdmin() ? 6 : 5" class="im-empty">{{cargando() ? 'Cargando ubicaciones…' : 'No hay ubicaciones que coincidan con la búsqueda.'}}</td></tr> }
        </tbody>
      </table></div>
      <div class="im-pager"><span>{{resumen()}}</span>
        @if (totalPaginas() > 1) { <div class="pages"><button type="button" class="im-btn small light" (click)="pagina.set(pagina() - 1)" [disabled]="pagina() === 0">Anterior</button><span>Página {{pagina() + 1}} de {{totalPaginas()}}</span><button type="button" class="im-btn small light" (click)="pagina.set(pagina() + 1)" [disabled]="pagina() + 1 >= totalPaginas()">Siguiente</button></div> }
      </div>
    </section>

    @if (formAbierto()) {
      <div class="im-overlay" (click)="cerrar()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="sede-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">{{editando() ? 'EDITAR UBICACIÓN' : 'NUEVA UBICACIÓN'}}</span><h2 id="sede-titulo">{{editando() ? editando()!.nombre : 'Agregar ubicación'}}</h2></div><button type="button" class="im-dialog-close" (click)="cerrar()">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="guardar()" #f="ngForm">
          <div class="two"><label>Código<input name="codigo" required maxlength="50" [(ngModel)]="form.codigo" [disabled]="!!editando()" placeholder="Ej. ALM-CENTRAL" />
              @if (editando()) { <span class="hint">El código identifica la sede y no se cambia.</span> }</label>
            <label>Tipo<select name="tipo" [(ngModel)]="form.tipo">@for (t of tipos; track t[0]) { <option [value]="t[0]">{{t[1]}}</option> }</select></label></div>
          <label>Nombre<input name="nombre" required maxlength="120" [(ngModel)]="form.nombre" placeholder="Ej. Almacén central" /></label>
          <label>Dirección o referencia <span class="hint">(opcional)</span><input name="referencia" maxlength="300" [(ngModel)]="form.referencia" placeholder="Ej. Av. Javier Prado 123, Ate" /></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="cerrar()">Cancelar</button><button type="submit" class="im-btn" [disabled]="ocupado() || !form.nombre.trim() || (!editando() && !form.codigo.trim())">{{ocupado() ? 'Guardando…' : 'Guardar'}}</button></div>
        </form>
      </section></div>
    }

    @if (confirmando(); as s) {
      <div class="im-overlay" (click)="confirmando.set(null)"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="estado-sede" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">{{s.activo === false ? 'ACTIVAR' : 'DESACTIVAR'}}</span><h2 id="estado-sede">{{s.nombre}}</h2></div><button type="button" class="im-dialog-close" (click)="confirmando.set(null)">Cerrar</button></div>
        <p>{{s.activo === false ? 'La ubicación volverá a aparecer en los formularios de solicitudes y movimientos.' : 'Dejará de aparecer en los formularios. Solo se puede desactivar si no tiene motos, envíos, solicitudes abiertas ni cuentas asignadas.'}}</p>
        @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
        <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="confirmando.set(null)">Cancelar</button><button type="button" class="im-btn" [class.danger]="s.activo !== false" (click)="cambiarEstado(s)" [disabled]="ocupado()">{{s.activo === false ? 'Sí, activar' : 'Sí, desactivar'}}</button></div>
      </section></div>
    }
  </div>`
})
export class UbicacionesPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly tipos = Object.entries(TIPOS);
  readonly sedes = signal<Sede[]>([]);
  readonly busqueda = signal('');
  readonly tipo = signal('');
  readonly pagina = signal(0);
  readonly cargando = signal(false);
  readonly ocupado = signal(false);
  readonly formAbierto = signal(false);
  readonly editando = signal<Sede | null>(null);
  readonly confirmando = signal<Sede | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');
  form = { codigo: '', nombre: '', tipo: 'ALMACEN', referencia: '' };

  readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.sedes().filter(s => (!this.tipo() || s.tipo === this.tipo())
      && (!texto || `${s.codigo} ${s.nombre} ${s.referencia ?? ''}`.toLowerCase().includes(texto)));
  });
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)));
  readonly visibles = computed(() => this.filtradas().slice(this.pagina() * POR_PAGINA, (this.pagina() + 1) * POR_PAGINA));
  readonly resumen = computed(() => {
    const total = this.filtradas().length;
    if (!total) return 'Sin resultados';
    const desde = this.pagina() * POR_PAGINA + 1;
    return `Mostrando ${desde}–${Math.min(desde + POR_PAGINA - 1, total)} de ${total} ubicaciones`;
  });

  // Recarga cuando llegan los permisos: Administración ve también las ubicaciones inactivas.
  constructor() { effect(() => { this.access.access(); untracked(() => this.cargar()); }); }

  esAdmin(): boolean { return this.access.can('PERMISOS_ASIGNAR'); }
  nombreTipo(tipo: string): string { return TIPOS[tipo] ?? tipo; }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cerrar(); this.confirmando.set(null); }

  cargar(): void {
    this.cargando.set(true);
    const url = this.esAdmin() ? '/api/v1/ubicaciones?todas=true' : '/api/v1/ubicaciones';
    this.http.get<Sede[]>(url).subscribe({
      next: sedes => { this.sedes.set(sedes); this.cargando.set(false); },
      error: err => { this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }
  abrir(sede: Sede | null): void {
    this.editando.set(sede); this.error.set(''); this.mensaje.set('');
    this.form = sede ? { codigo: sede.codigo, nombre: sede.nombre, tipo: sede.tipo, referencia: sede.referencia ?? '' }
      : { codigo: '', nombre: '', tipo: 'ALMACEN', referencia: '' };
    this.formAbierto.set(true);
  }
  cerrar(): void { if (!this.ocupado()) { this.formAbierto.set(false); this.error.set(''); } }
  confirmar(sede: Sede): void { this.error.set(''); this.mensaje.set(''); this.confirmando.set(sede); }

  guardar(): void {
    if (this.ocupado()) return;
    const sede = this.editando();
    const datos = { nombre: this.form.nombre.trim(), tipo: this.form.tipo, referencia: this.form.referencia.trim() || null };
    this.ocupado.set(true); this.error.set('');
    const peticion = sede ? this.http.put<Sede>(`/api/v1/ubicaciones/${sede.id}`, datos)
      : this.http.post<Sede>('/api/v1/ubicaciones', { ...datos, codigo: this.form.codigo.trim() });
    peticion.subscribe({
      next: () => { this.ocupado.set(false); this.formAbierto.set(false);
        this.mensaje.set(sede ? 'Ubicación actualizada.' : 'Ubicación registrada.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  cambiarEstado(sede: Sede): void {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.put<Sede>(`/api/v1/ubicaciones/${sede.id}/estado`, { activo: sede.activo === false }).subscribe({
      next: actual => { this.ocupado.set(false); this.confirmando.set(null);
        this.sedes.update(lista => lista.map(x => x.id === actual.id ? actual : x));
        this.mensaje.set(`${actual.nombre} quedó ${actual.activo ? 'activa' : 'inactiva'}.`); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
}
