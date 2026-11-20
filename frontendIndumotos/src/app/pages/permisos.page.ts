import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, debounceTime, switchMap, tap } from 'rxjs';
import { apiError } from '../core/api-error';

interface Permiso { codigo: string; porRol: boolean; excepcion: string | null; permitido: boolean; }
interface Accesos { usuarioId: number; nombreUsuario: string; rolCodigo: string; permisos: Permiso[]; }
interface Cuenta { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; estado: string; }
interface PaginaCuentas { items: Cuenta[]; pagina: number; totalElementos: number; }

@Component({
  selector: 'app-permisos-page', imports: [FormsModule],
  template: `<div class="form-page access-page">
    <div class="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Roles y permisos</h1>
    <p class="lead">Revisa el acceso de cada trabajador. Los permisos se asignan por rol; las excepciones individuales se usan cuando haga falta.</p>
    <section class="panel"><div class="list-head"><div><h2>Cuentas del sistema</h2><p class="hint">Hasta 10 cuentas por página.</p></div>
      <label class="search-field" for="buscarAcceso"><span>Buscar cuenta</span><input id="buscarAcceso" type="search" placeholder="Nombre o usuario" maxlength="180" [(ngModel)]="busqueda" (ngModelChange)="buscar()" /></label></div>
      @if (errorLista()) { <p class="message error" role="alert">{{errorLista()}}</p> }
      @if (listando() && !cuentas()) { <p class="hint" role="status">Cargando cuentas…</p> }
      @if (cuentas(); as resultado) {
        <div class="table-wrap"><table><thead><tr><th>Trabajador</th><th>Usuario</th><th>Rol</th><th>Estado</th><th><span class="sr-only">Acción</span></th></tr></thead>
        <tbody>@for (cuenta of resultado.items; track cuenta.id) { <tr><td><strong>{{cuenta.nombreCompleto}}</strong></td><td>{{cuenta.nombreUsuario}}</td><td>{{nombreRol(cuenta.rolCodigo)}}</td><td><span class="state" [class.inactive]="cuenta.estado !== 'ACTIVO'">{{cuenta.estado}}</span></td><td class="row-action"><button type="button" class="view-button" [attr.aria-label]="'Ver permisos de ' + cuenta.nombreCompleto" (click)="consultar(cuenta)">Ver</button></td></tr> }
        @empty { <tr><td colspan="5" class="no-results">No se encontraron cuentas.</td></tr> }</tbody></table></div>
        <div class="list-footer"><span>{{resultado.totalElementos}} {{resultado.totalElementos === 1 ? 'cuenta' : 'cuentas'}} · Página {{resultado.pagina + 1}} de {{totalPaginas(resultado) || 1}}</span>
          @if (totalPaginas(resultado) > 1) { <nav class="account-pages" aria-label="Páginas de cuentas"><button type="button" (click)="irPagina(resultado.pagina - 1)" [disabled]="listando() || resultado.pagina === 0">Anterior</button>
            @for (numero of paginasVisibles(totalPaginas(resultado), resultado.pagina); track numero) { <button type="button" [attr.aria-current]="numero === resultado.pagina ? 'page' : null" [attr.aria-label]="'Página ' + (numero + 1)" (click)="irPagina(numero)" [disabled]="listando()">{{numero + 1}}</button> }
            <button type="button" (click)="irPagina(resultado.pagina + 1)" [disabled]="listando() || resultado.pagina + 1 >= totalPaginas(resultado)">Siguiente</button></nav> }</div>
      }
    </section>
    @if (seleccionada()) { <div class="im-overlay" (click)="cerrar()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="acceso-titulo" (click)="$event.stopPropagation()">
      <header class="im-dialog-header"><div><span class="eyebrow">ACCESO DE CUENTA</span><h2 id="acceso-titulo">{{seleccionada()?.nombreCompleto}}</h2><p class="hint">&#64;{{seleccionada()?.nombreUsuario}}</p></div><button type="button" class="im-dialog-close" aria-label="Cerrar detalle" (click)="cerrar()">✕</button></header>
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (success()) { <p class="message success" role="status">{{success()}}</p> }
      @if (accesos(); as cuenta) {
        <div class="access-summary"><div><span>Rol actual</span><strong>{{nombreRol(cuenta.rolCodigo)}}</strong></div><div><span>Estado</span><strong>{{seleccionada()?.estado}}</strong></div></div>
        <label class="edit-toggle"><input type="checkbox" [checked]="editando()" [disabled]="busy()" (change)="alternarEdicion()" /><span><strong>Habilitar edición</strong><small>{{editando() ? 'Puedes cambiar el rol y las excepciones de esta cuenta.' : 'El acceso está en modo de consulta.'}}</small></span></label>
        @if (editando()) { <form class="role-form" (ngSubmit)="cambiarRol()"><label for="nuevoRol">Asignar rol</label><div class="inline-controls"><select id="nuevoRol" name="nuevoRol" [(ngModel)]="nuevoRol" [disabled]="busy()"><option value="ADMIN">Administración</option><option value="ALMACEN">Almacén</option><option value="INVENTARIOS">Inventarios</option><option value="COMERCIAL">Comercial</option><option value="ENSAMBLAJE">Ensamblaje</option></select><button type="submit" [disabled]="busy() || nuevoRol === cuenta.rolCodigo">Guardar rol</button></div></form> }
        <div class="permission-head"><h3>Permisos efectivos</h3><p class="hint">Los permisos del rol aparecen como heredados. Una excepción afecta solo a esta cuenta.</p></div>
        <div class="permission-list">@for (permiso of cuenta.permisos; track permiso.codigo) { <div class="permission-line"><div><strong>{{nombrePermiso(permiso.codigo)}}</strong><small>{{permiso.codigo}} · {{permiso.excepcion ? 'Excepción: ' + permiso.excepcion : permiso.porRol ? 'Heredado del rol' : 'No incluido en el rol'}}</small></div><span class="pill" [class.no]="!permiso.permitido">{{permiso.permitido ? 'Permitido' : 'Denegado'}}</span>
          @if (editando()) { <div class="permission-actions"><button type="button" class="tertiary" [disabled]="busy() || permiso.excepcion === 'PERMITIR' || (cuenta.rolCodigo !== 'ADMIN' && (permiso.codigo === 'USUARIOS_CREAR' || permiso.codigo === 'PERMISOS_ASIGNAR'))" (click)="guardarExcepcion(permiso, 'PERMITIR')">Permitir</button><button type="button" class="tertiary" [disabled]="busy() || permiso.excepcion === 'DENEGAR'" (click)="guardarExcepcion(permiso, 'DENEGAR')">Denegar</button>@if (permiso.excepcion) { <button type="button" class="text-button" [disabled]="busy()" (click)="retirarExcepcion(permiso)">Restablecer</button> }</div> }
        </div> }</div>
      } @else { <p class="hint" role="status">Cargando permisos…</p> }
    </section></div> }
  </div>`,
  styleUrl: './permisos.page.css'
})
export class PermisosPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busquedas = new Subject<{pagina: number; buscar: string}>();
  readonly busy = signal(false);
  readonly listando = signal(false);
  readonly errorLista = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly cuentas = signal<PaginaCuentas | null>(null);
  readonly seleccionada = signal<Cuenta | null>(null);
  readonly accesos = signal<Accesos | null>(null);
  readonly editando = signal(false);
  busqueda = '';
  nuevoRol = 'ALMACEN';

  ngOnInit(): void {
    this.busquedas.pipe(
      debounceTime(250),
      tap(() => { this.listando.set(true); this.errorLista.set(''); }),
      switchMap(({pagina, buscar}) => this.http.get<PaginaCuentas>('/api/v1/usuarios', {
        params: new HttpParams().set('pagina', pagina).set('tamano', 10).set('buscar', buscar)
      }).pipe(catchError(err => { this.errorLista.set(apiError(err)); this.listando.set(false); return EMPTY; }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(resultado => { this.cuentas.set(resultado); this.listando.set(false); });
    this.irPagina(0);
  }
  buscar(): void { this.irPagina(0); }
  totalPaginas(pagina: PaginaCuentas): number { return Math.ceil(pagina.totalElementos / 10); }
  paginasVisibles(total: number, actual: number): number[] {
    const inicio = Math.max(0, Math.min(actual - 2, total - 5));
    return Array.from({length: Math.min(5, total - inicio)}, (_, i) => inicio + i);
  }
  irPagina(pagina: number): void {
    const actual = this.cuentas();
    if (pagina < 0 || (pagina > 0 && actual && pagina >= this.totalPaginas(actual))) return;
    this.busquedas.next({pagina, buscar: this.busqueda.trim()});
  }
  consultar(cuenta: Cuenta): void {
    this.seleccionada.set(cuenta); this.accesos.set(null); this.editando.set(false);
    this.error.set(''); this.success.set('');
    this.http.get<Accesos>(`/api/v1/usuarios/${cuenta.id}/permisos`).subscribe({
      next: value => { if (this.seleccionada()?.id === cuenta.id) { this.accesos.set(value); this.nuevoRol = value.rolCodigo; } },
      error: err => { if (this.seleccionada()?.id === cuenta.id) this.error.set(apiError(err)); }
    });
  }
  @HostListener('document:keydown.escape') cerrar(): void {
    this.seleccionada.set(null); this.accesos.set(null); this.editando.set(false);
    this.error.set(''); this.success.set('');
  }
  alternarEdicion(): void { this.editando.update(value => !value); this.error.set(''); this.success.set(''); }
  nombreRol(codigo: string): string {
    return ({ADMIN:'Administración', ALMACEN:'Almacén', INVENTARIOS:'Inventarios', COMERCIAL:'Comercial', ENSAMBLAJE:'Ensamblaje'} as Record<string,string>)[codigo] ?? codigo;
  }
  nombrePermiso(codigo: string): string { return codigo.replaceAll('_', ' ').toLowerCase().replace(/^./, letra => letra.toUpperCase()); }
  cambiarRol(): void {
    const cuenta = this.accesos();
    if (!this.editando() || !cuenta || this.nuevoRol === cuenta.rolCodigo) return;
    if (!window.confirm(`¿Cambiar el rol de ${cuenta.nombreUsuario} a ${this.nombreRol(this.nuevoRol)}?`)) return;
    this.request(this.http.put<Accesos>(this.url('rol'), {rolCodigo: this.nuevoRol}), 'Rol actualizado.');
  }
  guardarExcepcion(permiso: Permiso, decision: 'PERMITIR' | 'DENEGAR'): void {
    const cuenta = this.accesos();
    if (!this.editando() || !cuenta) return;
    if (!window.confirm(`¿${decision === 'PERMITIR' ? 'Permitir' : 'Denegar'} ${permiso.codigo} solo para ${cuenta.nombreUsuario}?`)) return;
    this.request(this.http.put<Accesos>(this.url(`permisos/${permiso.codigo}`), {decision}), 'Excepción actualizada.');
  }
  retirarExcepcion(permiso: Permiso): void {
    if (!this.editando() || !this.accesos() || !permiso.excepcion) return;
    if (!window.confirm(`¿Restablecer ${permiso.codigo} a los permisos del rol?`)) return;
    this.request(this.http.delete<Accesos>(this.url(`permisos/${permiso.codigo}`)), 'Excepción retirada.');
  }
  private url(path: string): string { return `/api/v1/usuarios/${this.accesos()?.usuarioId}/${path}`; }
  private request(call: import('rxjs').Observable<Accesos>, message: string): void {
    this.busy.set(true); this.error.set(''); this.success.set('');
    call.subscribe({
      next: value => { this.accesos.set(value); this.nuevoRol = value.rolCodigo; this.success.set(message); this.busy.set(false); this.irPagina(this.cuentas()?.pagina ?? 0); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
