import { HttpClient, HttpParams } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, debounceTime, switchMap, tap } from 'rxjs';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { apiError } from '../core/api-error';
import { ROLES, nombreRol } from '../core/roles';
import { AuthService } from '../core/auth.service';

interface UsuarioCreado { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; }
interface Tienda { id: number; nombre: string; tipo: string; }
interface Cuenta { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; estado: string; }
interface PaginaCuentas { items: Cuenta[]; pagina: number; tamano: number; totalElementos: number; }
export interface EventoEstado { estadoAnterior: string; estadoNuevo: string; motivo: string; actor: string; fecha: string; }
interface Excepcion { codigo: string; porRol: boolean; excepcion: string; permitido: boolean; }
export interface DetalleCuenta {
  id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; rolNombre: string; estado: string;
  tiendaNombre: string | null; creadoEn: string; actualizadoEn: string; permisosEfectivos: string[];
  excepciones: Excepcion[]; ultimoCambioEstado: EventoEstado | null;
}

@Component({
  selector: 'app-usuarios-page',
  imports: [FormsModule, DatePipe],
  template: `<div class="form-page">
    <div class="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Cuentas del equipo</h1>
    <p class="lead">Crea una cuenta individual para cada trabajador, consulta su estado y permisos vigentes, y desactívala o reactívala sin perder su historial.</p>
    @if (puedeCrear()) { <div class="grid"><section class="panel"><h2>Datos del trabajador</h2><p class="hint">La contraseña se enviará al servidor para guardarla de forma segura.</p>
      <form (ngSubmit)="guardar()" #f="ngForm">
        <label for="nombreCompleto">Nombre completo</label><input id="nombreCompleto" name="nombreCompleto" required maxlength="180" autocomplete="name" [(ngModel)]="form.nombreCompleto" />
        <label for="nombreUsuario">Nombre de usuario</label><input id="nombreUsuario" name="nombreUsuario" required minlength="3" maxlength="80" pattern="[A-Za-z0-9._-]+" autocomplete="off" [(ngModel)]="form.nombreUsuario" />
        <div class="row"><div><label for="rol">Rol</label><select id="rol" name="rol" [(ngModel)]="form.rolCodigo">@for (rol of roles; track rol.codigo) { <option [value]="rol.codigo">{{rol.nombre}}</option> }</select></div>
        <div><label for="clave">Contraseña inicial</label><div class="password-field"><input id="clave" name="clave" [type]="verClave() ? 'text' : 'password'" required minlength="12" maxlength="100" autocomplete="new-password" [(ngModel)]="form.clave" /><button type="button" class="password-toggle" (click)="verClave.set(!verClave())" [attr.aria-label]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="verClave()" [title]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'">@if (verClave()) { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.3M6.2 6.2A12.4 12.4 0 0 0 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.3-1"/></svg> } @else { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg> }</button></div></div></div>
        @if (form.rolCodigo === 'COMERCIAL' || form.rolCodigo === 'FACTURACION') { <label for="tiendaNueva">Sede de trabajo</label><select id="tiendaNueva" name="tiendaId" [(ngModel)]="form.tiendaId" required><option [ngValue]="null">Selecciona una tienda</option>@for (tienda of tiendas(); track tienda.id) { <option [ngValue]="tienda.id">{{tienda.nombre}}</option> }</select><p class="hint">La cuenta quedará vinculada a esta tienda.</p> }
        @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
        <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Creando…' : 'Crear cuenta'}}</button>
      </form>
      @if (created(); as usuario) { <p class="message success" role="status">Cuenta {{usuario.nombreUsuario}} creada con ID #{{usuario.id}}.</p> }
    </section><section class="panel"><h2>Roles iniciales</h2><p class="hint">El servidor comprobará el rol y los permisos de quien crea la cuenta.</p>
      <div class="detail"><div class="detail-row"><span>ADMIN</span><strong>Administrar cuentas y accesos</strong></div>
      <div class="detail-row"><span>ALMACEN</span><strong>Registrar llegadas y preparar solicitudes</strong></div>
      <div class="detail-row"><span>INVENTARIOS</span><strong>Registrar fichas y gestionar catálogo</strong></div>
      <div class="detail-row"><span>COMERCIAL</span><strong>Crear solicitudes para sedes</strong></div>
      <div class="detail-row"><span>FACTURACION</span><strong>Consultar disponibilidad y reportar diferencias de datos</strong></div>
      <div class="detail-row"><span>ENSAMBLAJE</span><strong>Consultar y preparar solicitudes</strong></div></div>
    </section></div> }
    <section class="panel accounts-panel"><div class="accounts-head"><div><h2>Cuentas creadas</h2><p class="hint">Consulta las cuentas del equipo. Se muestran hasta 10 por página.</p></div>
      <div class="account-search"><label for="buscarCuenta">Buscar cuenta</label><div class="search-controls"><input id="buscarCuenta" name="buscarCuenta" type="text" [(ngModel)]="busqueda" (ngModelChange)="buscar()" placeholder="Nombre o usuario" maxlength="180" /><button type="button" class="clear-search" (click)="limpiarBusqueda()" [disabled]="!busqueda" aria-label="Limpiar búsqueda" title="Limpiar búsqueda">✕</button></div></div></div>
      @if (errorLista()) { <p class="message error" role="alert">{{errorLista()}}</p> }
      @if (cuentas(); as resultado) {
        <div class="table-wrap"><table><thead><tr><th>Trabajador</th><th>Usuario</th><th>Rol</th><th>Estado</th>@if (puedeConsultar()) { <th><span class="sr-only">Acciones</span></th> }</tr></thead><tbody>
          @for (cuenta of resultado.items; track cuenta.id) { <tr><td><strong>{{cuenta.nombreCompleto}}</strong></td><td>{{cuenta.nombreUsuario}}</td><td>{{nombreRol(cuenta.rolCodigo)}}</td><td><span class="account-state" [class.inactive]="cuenta.estado !== 'ACTIVO'">{{cuenta.estado}}</span></td>@if (puedeConsultar()) { <td class="row-action"><button type="button" class="link-button" (click)="verDetalle(cuenta.id)" [attr.aria-label]="'Ver cuenta ' + cuenta.nombreUsuario">Ver detalle</button></td> }</tr> }
          @empty { <tr><td [attr.colspan]="puedeConsultar() ? 5 : 4" class="no-results">No se encontraron cuentas.</td></tr> }
        </tbody></table></div>
        <div class="accounts-footer"><span>{{resultado.totalElementos}} {{resultado.totalElementos === 1 ? 'cuenta' : 'cuentas'}} · Página {{resultado.pagina + 1}} de {{totalPaginas(resultado) || 1}}</span>
        @if (totalPaginas(resultado) > 1) { <nav class="account-pages" aria-label="Páginas de cuentas"><button type="button" (click)="irPagina(resultado.pagina - 1)" [disabled]="listando() || resultado.pagina === 0">Anterior</button>
          @for (numero of paginasVisibles(totalPaginas(resultado), resultado.pagina); track numero) { <button type="button" [attr.aria-current]="numero === resultado.pagina ? 'page' : null" [attr.aria-label]="'Página ' + (numero + 1)" (click)="irPagina(numero)" [disabled]="listando()">{{numero + 1}}</button> }
          <button type="button" (click)="irPagina(resultado.pagina + 1)" [disabled]="listando() || resultado.pagina + 1 >= totalPaginas(resultado)">Siguiente</button></nav> }</div>
      }
    </section>
    @if (seleccionId() !== null) { <div class="account-overlay" (click)="cerrarDetalle()">
      <section class="panel account-detail" role="dialog" aria-modal="true" aria-labelledby="detalleTitulo" (click)="$event.stopPropagation()">
      @if (detalleCargando()) { <p role="status">Cargando detalle de la cuenta…</p> }
      @if (errorDetalle()) { <p class="message error" role="alert">{{errorDetalle()}}</p><button type="button" class="secondary" (click)="cerrarDetalle()">Cerrar</button> }
      @if (detalle(); as cuenta) {
        <div class="accounts-head"><div><h2 id="detalleTitulo">{{cuenta.nombreCompleto}}</h2><p class="hint">Usuario {{cuenta.nombreUsuario}} · ID #{{cuenta.id}}</p></div>
          <button type="button" class="clear-search" (click)="cerrarDetalle()" aria-label="Cerrar detalle" title="Cerrar detalle">✕</button></div>
        <div class="detail">
          <div class="detail-row"><span>Estado</span><strong><span class="account-state" [class.inactive]="cuenta.estado !== 'ACTIVO'">{{cuenta.estado}}</span></strong></div>
          <div class="detail-row"><span>Rol</span><strong>{{cuenta.rolNombre || nombreRol(cuenta.rolCodigo)}}</strong></div>
          <div class="detail-row"><span>Tienda</span><strong>{{cuenta.tiendaNombre || 'Sin tienda asignada'}}</strong></div>
          @if (auth.can('COMPANIA_CONSULTAR') && cuenta.estado === 'ACTIVO' && (cuenta.rolCodigo === 'COMERCIAL' || cuenta.rolCodigo === 'FACTURACION')) { <div class="store-assignment"><label for="tiendaCuenta">Cambiar sede de trabajo</label><select id="tiendaCuenta" [(ngModel)]="tiendaDetalle"><option [ngValue]="0">Seleccionar tienda</option>@for (tienda of tiendas(); track tienda.id) { <option [ngValue]="tienda.id">{{tienda.nombre}}</option> }</select><button type="button" class="secondary" (click)="asignarTienda(cuenta.id)" [disabled]="!tiendaDetalle || asignandoTienda()">{{asignandoTienda() ? 'Guardando…' : 'Guardar sede'}}</button></div> }
          <div class="detail-row"><span>Creada</span><strong>{{cuenta.creadoEn | date:'dd/MM/yyyy HH:mm'}}</strong></div>
          @if (cuenta.ultimoCambioEstado; as ultimo) {
            <div class="detail-row"><span>Último cambio</span><strong>{{ultimo.estadoNuevo === 'ACTIVO' ? 'Reactivada' : 'Desactivada'}} por {{ultimo.actor}} el {{ultimo.fecha | date:'dd/MM/yyyy HH:mm'}}: {{ultimo.motivo}}</strong></div>
          }
        </div>
        <h3>Permisos vigentes</h3>
        @if (cuenta.estado !== 'ACTIVO') { <p class="hint">La cuenta está inactiva: no puede ingresar ni usar estos permisos hasta que se reactive.</p> }
        <ul class="permission-list">@for (permiso of cuenta.permisosEfectivos; track permiso) { <li>{{permiso}}</li> } @empty { <li class="muted">Sin permisos vigentes</li> }</ul>
        @if (cuenta.excepciones.length) {
          <h3>Excepciones de la cuenta</h3>
          <ul class="permission-list">@for (ex of cuenta.excepciones; track ex.codigo) { <li [class.denied]="ex.excepcion === 'DENEGAR'">{{ex.excepcion === 'DENEGAR' ? 'Denegado' : 'Permitido'}}: {{ex.codigo}}</li> }</ul>
        }
        @if (puedeCambiarEstado()) {
          <form class="state-form" (ngSubmit)="confirmando() ? cambiarEstado() : pedirConfirmacion()">
            <h3>{{cuenta.estado === 'ACTIVO' ? 'Desactivar cuenta' : 'Reactivar cuenta'}}</h3>
            <p class="hint">{{cuenta.estado === 'ACTIVO' ? 'La persona no podrá ingresar y sus sesiones abiertas se cerrarán. Sus registros y su historial se conservan.' : 'La persona podrá ingresar de nuevo con su rol y permisos vigentes.'}}</p>
            <label for="motivoEstado">Motivo</label>
            <textarea id="motivoEstado" name="motivoEstado" required maxlength="500" rows="2" [(ngModel)]="motivo" (ngModelChange)="confirmando.set(false)"></textarea>
            @if (errorEstado()) { <p class="message error" role="alert">{{errorEstado()}}</p> }
            @if (confirmando()) { <p class="message warning" role="status">¿Confirmas {{cuenta.estado === 'ACTIVO' ? 'desactivar' : 'reactivar'}} la cuenta {{cuenta.nombreUsuario}}?</p> }
            <div class="state-actions">
              @if (confirmando()) { <button type="button" class="secondary" (click)="confirmando.set(false)" [disabled]="cambiando()">Cancelar</button> }
              <button type="submit" [class.danger]="cuenta.estado === 'ACTIVO'" [disabled]="cambiando() || !motivo.trim()">{{cambiando() ? 'Guardando…' : confirmando() ? 'Sí, confirmar' : (cuenta.estado === 'ACTIVO' ? 'Desactivar' : 'Reactivar')}}</button>
            </div>
          </form>
        }
        @if (mensajeEstado()) { <p class="message success" role="status">{{mensajeEstado()}}</p> }
        <h3>Historial de estado</h3>
        <ol class="state-history">
          @for (evento of historial(); track $index) { <li><strong>{{evento.estadoAnterior}} → {{evento.estadoNuevo}}</strong><span>{{evento.fecha | date:'dd/MM/yyyy HH:mm'}} · {{evento.actor}}</span><p>{{evento.motivo}}</p></li> }
          @empty { <li class="muted">Sin cambios de estado registrados.</li> }
        </ol>
      }
      </section>
    </div> }
    </div>`,
  styleUrl: './usuarios.page.css'
})
export class UsuariosPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  private readonly busquedas = new Subject<{pagina:number; buscar:string}>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly created = signal<UsuarioCreado | null>(null);
  readonly cuentas = signal<PaginaCuentas | null>(null);
  readonly listando = signal(false);
  readonly errorLista = signal('');
  readonly detalle = signal<DetalleCuenta | null>(null);
  readonly seleccionId = signal<number | null>(null);
  readonly detalleCargando = signal(false);
  readonly historial = signal<EventoEstado[]>([]);
  readonly errorDetalle = signal('');
  readonly errorEstado = signal('');
  readonly mensajeEstado = signal('');
  readonly confirmando = signal(false);
  readonly cambiando = signal(false);
  readonly verClave = signal(false);
  readonly tiendas = signal<Tienda[]>([]);
  readonly asignandoTienda = signal(false);
  tiendaDetalle = 0;
  busqueda = '';
  motivo = '';
  form = { nombreCompleto: '', nombreUsuario: '', rolCodigo: 'ALMACEN', clave: '', tiendaId: null as number | null };

  ngOnInit(): void {
    if (this.auth.can('USUARIOS_CREAR') || this.auth.can('COMPANIA_CONSULTAR'))
      this.http.get<Tienda[]>('/api/v1/ubicaciones').subscribe({next: v => this.tiendas.set(v.filter(t => t.tipo === 'TIENDA'))});
    this.busquedas.pipe(
      debounceTime(250),
      tap(() => { this.listando.set(true); this.errorLista.set(''); }),
      switchMap(({pagina,buscar}) => {
        const params = new HttpParams().set('pagina', pagina).set('tamano', 10).set('buscar', buscar);
        return this.http.get<PaginaCuentas>('/api/v1/usuarios', { params }).pipe(catchError(err => {
          this.errorLista.set(apiError(err)); this.listando.set(false); return EMPTY;
        }));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(resultado => { this.cuentas.set(resultado); this.listando.set(false); });
    this.irPagina(0);
  }
  puedeCrear(): boolean { return this.auth.can('USUARIOS_CREAR'); }
  puedeConsultar(): boolean { return this.auth.can('USUARIOS_CONSULTAR'); }
  puedeCambiarEstado(): boolean { return this.auth.can('USUARIOS_DESACTIVAR'); }
  buscar(): void { this.irPagina(0); }

  verDetalle(id: number): void {
    this.seleccionId.set(id); this.detalle.set(null); this.historial.set([]); this.detalleCargando.set(true);
    this.errorDetalle.set(''); this.errorEstado.set(''); this.mensajeEstado.set('');
    this.motivo = ''; this.confirmando.set(false);
    this.http.get<DetalleCuenta>(`/api/v1/usuarios/${id}`).subscribe({
      next: cuenta => { if (this.seleccionId() !== id) return; this.detalleCargando.set(false); this.detalle.set(cuenta); this.tiendaDetalle = 0; this.cargarHistorial(id); },
      error: err => { if (this.seleccionId() !== id) return; this.detalleCargando.set(false); this.errorDetalle.set(apiError(err)); }
    });
  }
  @HostListener('document:keydown.escape') cerrarDetalle(): void { this.seleccionId.set(null); this.detalle.set(null); this.historial.set([]); this.confirmando.set(false); }
  pedirConfirmacion(): void {
    this.errorEstado.set('');
    if (!this.motivo.trim()) { this.errorEstado.set('Escribe el motivo del cambio.'); return; }
    this.confirmando.set(true);
  }
  cambiarEstado(): void {
    const cuenta = this.detalle();
    if (!cuenta || !this.motivo.trim()) return;
    const estado = cuenta.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.cambiando.set(true); this.errorEstado.set(''); this.mensajeEstado.set('');
    this.http.put<DetalleCuenta>(`/api/v1/usuarios/${cuenta.id}/estado`, { estado, motivo: this.motivo.trim() }).subscribe({
      next: actualizada => {
        this.detalle.set(actualizada); this.cambiando.set(false); this.confirmando.set(false); this.motivo = '';
        this.mensajeEstado.set(estado === 'INACTIVO' ? `Cuenta ${actualizada.nombreUsuario} desactivada.` : `Cuenta ${actualizada.nombreUsuario} reactivada.`);
        this.cargarHistorial(actualizada.id);
        this.irPagina(this.cuentas()?.pagina ?? 0);
      },
      error: err => { this.errorEstado.set(apiError(err)); this.cambiando.set(false); this.confirmando.set(false); }
    });
  }
  private cargarHistorial(id: number): void {
    this.http.get<EventoEstado[]>(`/api/v1/usuarios/${id}/estado/historial`).subscribe({
      next: eventos => this.historial.set(eventos),
      error: err => this.errorDetalle.set(apiError(err))
    });
  }
  asignarTienda(id: number): void {
    if (!this.tiendaDetalle || this.asignandoTienda()) return;
    this.asignandoTienda.set(true); this.errorDetalle.set('');
    this.http.put(`/api/v1/usuarios/${id}/tienda`, {tiendaId: this.tiendaDetalle}).subscribe({
      next: () => { this.asignandoTienda.set(false); this.verDetalle(id); this.irPagina(this.cuentas()?.pagina ?? 0); },
      error: err => { this.asignandoTienda.set(false); this.errorDetalle.set(apiError(err)); }
    });
  }
  limpiarBusqueda(): void { this.busqueda = ''; this.buscar(); }
  readonly roles = ROLES;
  nombreRol(codigo: string): string { return nombreRol(codigo); }
  totalPaginas(resultado: PaginaCuentas): number { return Math.ceil(resultado.totalElementos / 10); }
  paginasVisibles(total: number, actual: number): number[] {
    const inicio = Math.max(0, Math.min(actual - 2, total - 5));
    return Array.from({ length: Math.min(5, total - inicio) }, (_, indice) => inicio + indice);
  }
  irPagina(pagina: number): void {
    if (pagina < 0 || (pagina > 0 && this.cuentas() && pagina >= this.totalPaginas(this.cuentas()!))) return;
    this.busquedas.next({pagina, buscar:this.busqueda.trim()});
  }

  guardar(): void {
    this.created.set(null); this.error.set('');
    if (!this.form.nombreCompleto.trim() || !this.form.nombreUsuario.trim() || this.form.clave.length < 12) {
      this.error.set('Completa los datos y usa una contraseña de al menos 12 caracteres.'); return;
    }
    if ((this.form.rolCodigo === 'COMERCIAL' || this.form.rolCodigo === 'FACTURACION') && !this.form.tiendaId) {
      this.error.set('Selecciona la sede de trabajo.'); return;
    }
    this.busy.set(true);
    const tiendaId = this.form.rolCodigo === 'COMERCIAL' || this.form.rolCodigo === 'FACTURACION' ? this.form.tiendaId : null;
    this.http.post<UsuarioCreado>('/api/v1/usuarios', {...this.form, tiendaId}).subscribe({
      next: value => { this.created.set(value); this.form.clave = ''; this.busy.set(false); this.busqueda = ''; this.irPagina(0); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
