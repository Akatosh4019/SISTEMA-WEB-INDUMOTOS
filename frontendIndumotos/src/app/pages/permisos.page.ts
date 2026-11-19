import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Permiso { codigo: string; porRol: boolean; excepcion: string | null; permitido: boolean; }
interface Accesos { usuarioId: number; nombreUsuario: string; rolCodigo: string; permisos: Permiso[]; }
interface Cuenta { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string }

@Component({
  selector: 'app-permisos-page',
  imports: [FormsModule],
  template: `<div class="form-page">
    <div class="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Roles y permisos</h1>
    <p class="lead">Busca una cuenta por nombre para revisar qué puede hacer en el sistema. Cambia su rol o ajusta un permiso individual cuando corresponda.</p>
    <div class="grid"><section class="panel"><h2>Consultar cuenta</h2><p class="hint">Busca por nombre o usuario.</p>
      <form (ngSubmit)="buscarCuenta()"><label for="cuentaBusqueda">Nombre o usuario</label><input id="cuentaBusqueda" name="cuentaBusqueda" type="text" maxlength="180" [(ngModel)]="busqueda" />
        <button type="submit" class="secondary" [disabled]="busy()">Buscar cuenta</button></form>
      @for (cuenta of cuentas(); track cuenta.id) {
        <button type="button" class="secondary" (click)="consultar(cuenta.id)">{{cuenta.nombreCompleto}} · {{cuenta.nombreUsuario}}</button>
      }
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (success()) { <p class="message success" role="status">{{success()}}</p> }
      @if (accesos(); as cuenta) { <div class="detail">
        <div class="detail-row"><span>Cuenta</span><strong>{{cuenta.nombreUsuario}} · #{{cuenta.usuarioId}}</strong></div>
        <div class="detail-row"><span>Rol</span><strong>{{cuenta.rolCodigo}}</strong></div>
        @for (permiso of cuenta.permisos; track permiso.codigo) {
          <div class="permission"><div><strong>{{permiso.codigo}}</strong><small>Rol: {{permiso.porRol ? 'sí' : 'no'}} · Excepción: {{permiso.excepcion ?? 'ninguna'}}</small></div>
            <span class="pill" [class.no]="!permiso.permitido">{{permiso.permitido ? 'Permitido' : 'Denegado'}}</span></div>
        }
      </div> } @else { <div class="empty">Consulta una cuenta para ver sus permisos.</div> }
    </section>
    <section class="panel"><h2>Modificar acceso</h2><p class="hint">Los cambios se aplican a las próximas solicitudes de la cuenta.</p>
      <form (ngSubmit)="cambiarRol()"><label for="nuevoRol">Cambiar rol</label><select id="nuevoRol" name="nuevoRol" [(ngModel)]="nuevoRol">
        <option value="ADMIN">ADMIN</option><option value="ALMACEN">ALMACEN</option><option value="INVENTARIOS">INVENTARIOS</option></select>
        <button class="secondary" type="submit" [disabled]="busy() || !accesos()">Guardar rol</button></form>
      <div class="divider"></div>
      <form (ngSubmit)="guardarExcepcion()"><label for="codigo">Permiso</label><select id="codigo" name="codigo" [(ngModel)]="codigo">
        @for (item of codigos; track item) { <option [value]="item">{{item}}</option> }
      </select><label for="decision">Excepción individual</label><select id="decision" name="decision" [(ngModel)]="decision">
        <option value="PERMITIR">PERMITIR</option><option value="DENEGAR">DENEGAR</option></select>
      <div class="actions"><button type="submit" [disabled]="busy() || !accesos()">Guardar excepción</button>
        <button type="button" class="tertiary" (click)="retirarExcepcion()" [disabled]="busy() || !accesos()">Retirar</button></div></form>
    </section></div></div>`,
  styles: [`.divider{border-top:1px solid #e9eef3;margin:27px 0}`]
})
export class PermisosPage {
  private readonly http = inject(HttpClient);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly accesos = signal<Accesos | null>(null);
  readonly cuentas = signal<Cuenta[]>([]);
  readonly codigos = ['USUARIOS_CREAR','PERMISOS_ASIGNAR','LLEGADAS_REGISTRAR','FICHAS_REGISTRAR','INVENTARIO_CONSULTAR'];
  busqueda = '';
  nuevoRol = 'ALMACEN';
  codigo = 'LLEGADAS_REGISTRAR';
  decision = 'DENEGAR';

  buscarCuenta(): void {
    const buscar = this.busqueda.trim();
    this.error.set(''); this.cuentas.set([]); this.accesos.set(null);
    if (!buscar) { this.error.set('Ingresa un nombre o usuario.'); return; }
    this.busy.set(true);
    this.http.get<{items:Cuenta[]}>('/api/v1/usuarios', {params:{buscar, pagina:0, tamano:10}}).subscribe({
      next: pagina => { this.cuentas.set(pagina.items); this.busy.set(false);
        if (!pagina.items.length) this.error.set('No se encontraron cuentas.'); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }

  consultar(usuarioId: number): void {
    this.accesos.set(null); this.error.set(''); this.success.set('');
    this.cuentas.set([]);
    this.request(this.http.get<Accesos>(`/api/v1/usuarios/${usuarioId}/permisos`), 'Permisos consultados.');
  }

  cambiarRol(): void {
    if (!this.accesos()) return;
    if (this.nuevoRol === this.accesos()?.rolCodigo) { this.error.set('Selecciona un rol distinto.'); return; }
    if (!window.confirm(`¿Cambiar el rol de ${this.accesos()?.nombreUsuario} a ${this.nuevoRol}?`)) return;
    this.request(this.http.put<Accesos>(this.url('rol'), { rolCodigo: this.nuevoRol }), 'Rol actualizado.');
  }

  guardarExcepcion(): void {
    if (!this.accesos()) return;
    if (!window.confirm(`¿Aplicar ${this.decision} al permiso ${this.codigo} de ${this.accesos()?.nombreUsuario}?`)) return;
    this.request(this.http.put<Accesos>(this.url(`permisos/${this.codigo}`), { decision: this.decision }), 'Excepción guardada.');
  }

  retirarExcepcion(): void {
    if (!this.accesos()) return;
    const actual = this.accesos()?.permisos.find(p => p.codigo === this.codigo);
    if (!actual?.excepcion) { this.error.set('Este permiso no tiene excepción individual.'); return; }
    if (!window.confirm(`¿Retirar la excepción de ${this.codigo} para ${this.accesos()?.nombreUsuario}?`)) return;
    this.request(this.http.delete<Accesos>(this.url(`permisos/${this.codigo}`)), 'Excepción retirada.');
  }

  private url(path: string): string { return `/api/v1/usuarios/${this.accesos()?.usuarioId}/${path}`; }

  private request(call: import('rxjs').Observable<Accesos>, message: string): void {
    this.busy.set(true); this.error.set(''); this.success.set('');
    call.subscribe({
      next: value => { this.accesos.set(value); this.nuevoRol = value.rolCodigo; this.success.set(message); this.busy.set(false); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
