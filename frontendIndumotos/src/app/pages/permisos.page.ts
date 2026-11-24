import { HttpClient } from '@angular/common/http';
import { Component, HostListener, inject, signal } from '@angular/core';
import { apiError } from '../core/api-error';

interface Rol { id: number; codigo: string; nombre: string; descripcion: string; estado: string; trabajadores: number; permisos: number }
interface Permiso { codigo: string; nombre: string; descripcion: string; asignado: boolean }
interface Detalle { rol: Rol; permisos: Permiso[] }

@Component({
  selector: 'app-permisos-page',
  template: `<div class="form-page access-page">
    <span class="eyebrow">ADMINISTRACIÓN DE ACCESOS</span><h1>Roles y permisos</h1>
    <p class="lead">Cada rol agrupa los permisos de un área. Los trabajadores heredan los permisos del rol asignado en Trabajadores.</p>
    <section class="panel"><div class="list-head"><div><h2>Roles del sistema</h2><p class="hint">Los roles iniciales ya vienen configurados. Puedes revisar y ajustar sus permisos.</p></div></div>
      @if (errorLista()) { <p class="message error" role="alert">{{errorLista()}}</p> }
      @if (cargando()) { <p class="hint" role="status">Cargando roles…</p> }
      <div class="table-wrap"><table><thead><tr><th>Rol</th><th>Descripción</th><th>Trabajadores</th><th>Permisos</th><th>Estado</th><th><span class="sr-only">Acción</span></th></tr></thead>
        <tbody>@for (rol of roles(); track rol.id) { <tr><td><strong>{{rol.nombre}}</strong><small class="role-code">{{rol.codigo}}</small></td><td>{{rol.descripcion || 'Sin descripción'}}</td><td>{{rol.trabajadores}}</td><td>{{rol.permisos}}</td><td><span class="state" [class.inactive]="rol.estado !== 'ACTIVO'">{{rol.estado}}</span></td><td class="row-action"><button type="button" class="view-button" [attr.aria-label]="'Ver rol ' + rol.nombre" (click)="abrir(rol)">Ver permisos</button></td></tr> }
        @empty { @if (!cargando()) { <tr><td colspan="6" class="no-results">No hay roles registrados.</td></tr> } }</tbody></table></div>
      <p class="hint role-note">Administración conserva todos los permisos. Los cambios en otros roles afectan a sus trabajadores.</p>
    </section>
    @if (seleccionado(); as detalle) { <div class="im-overlay" (click)="cerrar()"><section class="im-dialog role-dialog" role="dialog" aria-modal="true" aria-labelledby="rol-titulo" (click)="$event.stopPropagation()">
      <header class="im-dialog-header"><div><span class="eyebrow">PERMISOS DEL ROL</span><h2 id="rol-titulo">{{detalle.rol.nombre}}</h2><p class="hint">{{detalle.rol.descripcion}} · {{detalle.rol.trabajadores}} trabajador(es)</p></div><button type="button" class="im-dialog-close" aria-label="Cerrar detalle" (click)="cerrar()">✕</button></header>
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (success()) { <p class="message success" role="status">{{success()}}</p> }
      <label class="edit-toggle"><input type="checkbox" [checked]="editando()" [disabled]="busy() || detalle.rol.codigo === 'ADMIN' || detalle.rol.estado !== 'ACTIVO'" (change)="alternarEdicion()" /><span><strong>Habilitar edición</strong><small>{{detalle.rol.codigo === 'ADMIN' ? 'Administración siempre conserva todos los permisos.' : editando() ? 'Marca los permisos que tendrá este rol.' : 'Los permisos están en modo de consulta.'}}</small></span></label>
      <div class="permission-list">@for (permiso of detalle.permisos; track permiso.codigo) { <label class="permission-line"><input type="checkbox" [checked]="seleccionados().has(permiso.codigo)" [disabled]="!editando() || busy() || reservado(permiso.codigo, detalle.rol.codigo)" (change)="cambiarPermiso(permiso.codigo)" /><span><strong>{{permiso.nombre || nombrePermiso(permiso.codigo)}}</strong><small>{{permiso.descripcion || permiso.codigo}}{{reservado(permiso.codigo, detalle.rol.codigo) ? ' · Reservado' : ''}}</small></span><em [class.no]="!seleccionados().has(permiso.codigo)">{{seleccionados().has(permiso.codigo) ? 'Asignado' : 'Sin asignar'}}</em></label> }</div>
      <div class="role-actions"><button type="button" class="secondary" (click)="cerrar()">Cerrar</button>@if (editando()) { <button type="button" (click)="guardar()" [disabled]="busy() || !cambios()">{{busy() ? 'Guardando…' : 'Guardar permisos'}}</button> }</div>
    </section></div> }
  </div>`,
  styleUrl: './permisos.page.css'
})
export class PermisosPage {
  private readonly http = inject(HttpClient);
  readonly roles = signal<Rol[]>([]);
  readonly seleccionado = signal<Detalle | null>(null);
  readonly seleccionados = signal<Set<string>>(new Set());
  readonly cargando = signal(false);
  readonly busy = signal(false);
  readonly editando = signal(false);
  readonly errorLista = signal('');
  readonly error = signal('');
  readonly success = signal('');

  constructor() { this.cargar(); }
  cargar(): void {
    this.cargando.set(true); this.errorLista.set('');
    this.http.get<Rol[]>('/api/v1/roles').subscribe({
      next: roles => { this.roles.set(roles); this.cargando.set(false); },
      error: err => { this.errorLista.set(apiError(err)); this.cargando.set(false); }
    });
  }
  abrir(rol: Rol): void {
    this.seleccionado.set(null); this.editando.set(false); this.error.set(''); this.success.set('');
    this.http.get<Detalle>(`/api/v1/roles/${rol.codigo}`).subscribe({
      next: detalle => { this.seleccionado.set(detalle);
        this.seleccionados.set(new Set(detalle.permisos.filter(p => p.asignado).map(p => p.codigo))); },
      error: err => this.errorLista.set(apiError(err))
    });
  }
  @HostListener('document:keydown.escape') cerrar(): void {
    if (this.busy()) return;
    this.seleccionado.set(null); this.editando.set(false); this.error.set(''); this.success.set('');
  }
  alternarEdicion(): void {
    const detalle = this.seleccionado();
    if (!detalle || detalle.rol.codigo === 'ADMIN' || detalle.rol.estado !== 'ACTIVO') return;
    this.editando.update(valor => !valor);
    if (!this.editando()) this.seleccionados.set(new Set(detalle.permisos.filter(p => p.asignado).map(p => p.codigo)));
  }
  cambiarPermiso(codigo: string): void {
    if (!this.editando() || this.reservado(codigo, this.seleccionado()?.rol.codigo ?? '')) return;
    const nuevos = new Set(this.seleccionados());
    if (nuevos.has(codigo)) nuevos.delete(codigo); else nuevos.add(codigo);
    this.seleccionados.set(nuevos); this.error.set('');
  }
  cambios(): boolean {
    const detalle = this.seleccionado();
    return !!detalle && detalle.permisos.some(p => p.asignado !== this.seleccionados().has(p.codigo));
  }
  guardar(): void {
    const detalle = this.seleccionado();
    if (!detalle || !this.editando() || !this.cambios() || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.put<Detalle>(`/api/v1/roles/${detalle.rol.codigo}/permisos`,
      {codigos:[...this.seleccionados()]}).subscribe({
      next: nuevo => { this.seleccionado.set(nuevo); this.seleccionados.set(new Set(nuevo.permisos.filter(p => p.asignado).map(p => p.codigo)));
        this.editando.set(false); this.busy.set(false); this.success.set('Permisos del rol actualizados.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
  nombrePermiso(codigo: string): string { return codigo.replaceAll('_', ' ').toLowerCase().replace(/^./, l => l.toUpperCase()); }
  reservado(codigo: string, rol: string): boolean {
    return rol !== 'ADMIN' && (['USUARIOS_CREAR','USUARIOS_CONSULTAR','USUARIOS_DESACTIVAR',
      'PERMISOS_ASIGNAR','CATALOGO_GESTIONAR','COMPANIA_CONSULTAR'].includes(codigo)
      || codigo === 'VENTAS_REGISTRAR' && rol !== 'FACTURACION');
  }
}
