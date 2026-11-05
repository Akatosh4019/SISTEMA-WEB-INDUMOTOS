import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface UsuarioCreado { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; }

@Component({
  selector: 'app-usuarios-page',
  imports: [FormsModule],
  template: `<div class="form-page">
    <div class="eyebrow">ADMINISTRACIÓN DE ACCESOS</div><h1>Crear cuenta</h1>
    <p class="lead">Cada trabajador debe tener una cuenta individual. Solo un administrador autorizado puede registrarla.</p>
    <div class="grid"><section class="panel"><h2>Datos del trabajador</h2><p class="hint">La contraseña se enviará al servidor para guardarla de forma segura.</p>
      <form (ngSubmit)="guardar()" #f="ngForm">
        <label for="nombreCompleto">Nombre completo</label><input id="nombreCompleto" name="nombreCompleto" required maxlength="180" autocomplete="name" [(ngModel)]="form.nombreCompleto" />
        <label for="nombreUsuario">Nombre de usuario</label><input id="nombreUsuario" name="nombreUsuario" required minlength="3" maxlength="80" pattern="[A-Za-z0-9._-]+" autocomplete="off" [(ngModel)]="form.nombreUsuario" />
        <div class="row"><div><label for="rol">Rol</label><select id="rol" name="rol" [(ngModel)]="form.rolCodigo"><option value="ALMACEN">ALMACEN</option><option value="INVENTARIOS">INVENTARIOS</option><option value="ADMIN">ADMIN</option></select></div>
        <div><label for="clave">Contraseña inicial</label><input id="clave" name="clave" type="password" required minlength="12" maxlength="100" autocomplete="new-password" [(ngModel)]="form.clave" /></div></div>
        @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
        <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Creando…' : 'Crear cuenta'}}</button>
      </form>
      @if (created(); as usuario) { <p class="message success" role="status">Cuenta {{usuario.nombreUsuario}} creada con ID #{{usuario.id}}.</p> }
    </section><section class="panel"><h2>Roles iniciales</h2><p class="hint">El servidor comprobará el rol y los permisos de quien crea la cuenta.</p>
      <div class="detail"><div class="detail-row"><span>ADMIN</span><strong>Administrar cuentas y accesos</strong></div>
      <div class="detail-row"><span>ALMACEN</span><strong>Registrar llegadas</strong></div>
      <div class="detail-row"><span>INVENTARIOS</span><strong>Registrar fichas</strong></div></div>
    </section></div></div>`
})
export class UsuariosPage {
  private readonly http = inject(HttpClient);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly created = signal<UsuarioCreado | null>(null);
  form = { nombreCompleto: '', nombreUsuario: '', rolCodigo: 'ALMACEN', clave: '' };

  guardar(): void {
    this.created.set(null); this.error.set('');
    if (!this.form.nombreCompleto.trim() || !this.form.nombreUsuario.trim() || this.form.clave.length < 12) {
      this.error.set('Completa los datos y usa una contraseña de al menos 12 caracteres.'); return;
    }
    this.busy.set(true);
    this.http.post<UsuarioCreado>('/api/v1/usuarios', this.form).subscribe({
      next: value => { this.created.set(value); this.form.clave = ''; this.busy.set(false); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
