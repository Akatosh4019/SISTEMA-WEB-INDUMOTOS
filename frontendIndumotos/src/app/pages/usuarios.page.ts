import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';

interface UsuarioCreado { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; }
interface Cuenta { id: number; nombreCompleto: string; nombreUsuario: string; rolCodigo: string; estado: string; }
interface PaginaCuentas { items: Cuenta[]; pagina: number; tamano: number; totalElementos: number; }

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
    </section></div>
    <section class="panel" style="margin-top:20px"><h2>Cuentas creadas</h2><p class="hint">Consulta por nombre o usuario. Cada página muestra hasta 10 cuentas.</p>
      <form (ngSubmit)="buscar()" class="row"><div><label for="buscarCuenta">Buscar cuenta</label><input id="buscarCuenta" name="buscarCuenta" [(ngModel)]="busqueda" placeholder="Nombre o usuario" maxlength="180" /></div><button type="submit" [disabled]="listando()">Buscar</button></form>
      @if (errorLista()) { <p class="message error" role="alert">{{errorLista()}}</p> }
      @if (cuentas(); as resultado) {
        <div class="detail">@for (cuenta of resultado.items; track cuenta.id) { <div class="detail-row"><span>{{cuenta.nombreCompleto}} ({{cuenta.nombreUsuario}})</span><strong>{{cuenta.rolCodigo}} · {{cuenta.estado}}</strong></div> } @empty { <p>No se encontraron cuentas.</p> }</div>
        @if (totalPaginas(resultado) > 1) { <nav class="account-pages" aria-label="Páginas de cuentas"><button type="button" (click)="irPagina(resultado.pagina - 1)" [disabled]="listando() || resultado.pagina === 0">Anterior</button>
          @for (numero of paginasVisibles(totalPaginas(resultado), resultado.pagina); track numero) { <button type="button" [attr.aria-current]="numero === resultado.pagina ? 'page' : null" [attr.aria-label]="'Página ' + (numero + 1)" (click)="irPagina(numero)" [disabled]="listando()">{{numero + 1}}</button> }
          <button type="button" (click)="irPagina(resultado.pagina + 1)" [disabled]="listando() || resultado.pagina + 1 >= totalPaginas(resultado)">Siguiente</button></nav> }
      }
    </section></div>`,
  styles: [`.account-pages{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:18px}.account-pages button{min-width:38px}.account-pages button[aria-current=page]{background:#193d61;color:white}.account-pages button:focus-visible{outline:3px solid #cbd51c;outline-offset:2px}`]
})
export class UsuariosPage implements OnInit {
  private readonly http = inject(HttpClient);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly created = signal<UsuarioCreado | null>(null);
  readonly cuentas = signal<PaginaCuentas | null>(null);
  readonly listando = signal(false);
  readonly errorLista = signal('');
  busqueda = '';
  private filtro = '';
  form = { nombreCompleto: '', nombreUsuario: '', rolCodigo: 'ALMACEN', clave: '' };

  ngOnInit(): void { this.irPagina(0); }
  buscar(): void { this.filtro = this.busqueda.trim(); this.irPagina(0); }
  totalPaginas(resultado: PaginaCuentas): number { return Math.ceil(resultado.totalElementos / 10); }
  paginasVisibles(total: number, actual: number): number[] {
    const inicio = Math.max(0, Math.min(actual - 2, total - 5));
    return Array.from({ length: Math.min(5, total - inicio) }, (_, indice) => inicio + indice);
  }
  irPagina(pagina: number): void {
    if (this.listando() || pagina < 0 || (this.cuentas() && pagina >= this.totalPaginas(this.cuentas()!))) return;
    this.listando.set(true); this.errorLista.set('');
    const params = new HttpParams().set('pagina', pagina).set('tamano', 10).set('buscar', this.filtro);
    this.http.get<PaginaCuentas>('/api/v1/usuarios', { params }).subscribe({
      next: resultado => { this.cuentas.set(resultado); this.listando.set(false); },
      error: err => { this.errorLista.set(apiError(err)); this.listando.set(false); }
    });
  }

  guardar(): void {
    this.created.set(null); this.error.set('');
    if (!this.form.nombreCompleto.trim() || !this.form.nombreUsuario.trim() || this.form.clave.length < 12) {
      this.error.set('Completa los datos y usa una contraseña de al menos 12 caracteres.'); return;
    }
    this.busy.set(true);
    this.http.post<UsuarioCreado>('/api/v1/usuarios', this.form).subscribe({
      next: value => { this.created.set(value); this.form.clave = ''; this.busy.set(false); this.cuentas.set(null); this.filtro = ''; this.busqueda = ''; this.irPagina(0); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
