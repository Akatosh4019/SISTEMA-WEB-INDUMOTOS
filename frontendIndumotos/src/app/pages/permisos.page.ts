import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface Permiso { codigo: string; porRol: boolean; excepcion: string | null; permitido: boolean; }
interface Accesos { usuarioId: number; nombreUsuario: string; rolCodigo: string; permisos: Permiso[]; }

@Component({
  selector: 'app-permisos-page',
  imports: [FormsModule],
  template: `<div class="form-page">
    <div class="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Roles y permisos</h1>
    <p class="lead">Consulta el acceso efectivo de una cuenta y ajusta su rol o sus excepciones individuales.</p>
    <div class="grid"><section class="panel"><h2>Consultar cuenta</h2><p class="hint">Ingresa el ID de usuario asignado al crear la cuenta.</p>
      <form (ngSubmit)="consultar()"><label for="usuarioId">ID de usuario</label><input id="usuarioId" name="usuarioId" type="number" min="1" [(ngModel)]="usuarioId" />
        <button type="submit" class="secondary" [disabled]="busy()">Consultar permisos</button></form>
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
  readonly codigos = ['USUARIOS_CREAR','PERMISOS_ASIGNAR','LLEGADAS_REGISTRAR','FICHAS_REGISTRAR','INVENTARIO_CONSULTAR'];
  usuarioId: number | null = null;
  nuevoRol = 'ALMACEN';
  codigo = 'LLEGADAS_REGISTRAR';
  decision = 'DENEGAR';

  consultar(): void {
    this.accesos.set(null); this.error.set(''); this.success.set('');
    if (!this.usuarioId || this.usuarioId < 1) { this.error.set('Ingresa un ID válido.'); return; }
    this.request(this.http.get<Accesos>(`/api/v1/usuarios/${this.usuarioId}/permisos`), 'Permisos consultados.');
  }

  cambiarRol(): void {
    if (!this.accesos()) return;
    this.request(this.http.put<Accesos>(this.url('rol'), { rolCodigo: this.nuevoRol }), 'Rol actualizado.');
  }

  guardarExcepcion(): void {
    if (!this.accesos()) return;
    this.request(this.http.put<Accesos>(this.url(`permisos/${this.codigo}`), { decision: this.decision }), 'Excepción guardada.');
  }

  retirarExcepcion(): void {
    if (!this.accesos()) return;
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
