import { HttpClient, HttpParams } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, debounceTime, switchMap, tap } from 'rxjs';
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
    <p class="lead">Crea una cuenta individual para cada trabajador y asígnale el rol de su área. También puedes buscar cuentas existentes por nombre o usuario.</p>
    <div class="grid"><section class="panel"><h2>Datos del trabajador</h2><p class="hint">La contraseña se enviará al servidor para guardarla de forma segura.</p>
      <form (ngSubmit)="guardar()" #f="ngForm">
        <label for="nombreCompleto">Nombre completo</label><input id="nombreCompleto" name="nombreCompleto" required maxlength="180" autocomplete="name" [(ngModel)]="form.nombreCompleto" />
        <label for="nombreUsuario">Nombre de usuario</label><input id="nombreUsuario" name="nombreUsuario" required minlength="3" maxlength="80" pattern="[A-Za-z0-9._-]+" autocomplete="off" [(ngModel)]="form.nombreUsuario" />
        <div class="row"><div><label for="rol">Rol</label><select id="rol" name="rol" [(ngModel)]="form.rolCodigo"><option value="ALMACEN">Almacén</option><option value="INVENTARIOS">Inventarios</option><option value="COMERCIAL">Comercial</option><option value="ENSAMBLAJE">Ensamblaje</option><option value="ADMIN">Administración</option></select></div>
        <div><label for="clave">Contraseña inicial</label><input id="clave" name="clave" type="password" required minlength="12" maxlength="100" autocomplete="new-password" [(ngModel)]="form.clave" /></div></div>
        @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
        <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Creando…' : 'Crear cuenta'}}</button>
      </form>
      @if (created(); as usuario) { <p class="message success" role="status">Cuenta {{usuario.nombreUsuario}} creada con ID #{{usuario.id}}.</p> }
    </section><section class="panel"><h2>Roles iniciales</h2><p class="hint">El servidor comprobará el rol y los permisos de quien crea la cuenta.</p>
      <div class="detail"><div class="detail-row"><span>ADMIN</span><strong>Administrar cuentas y accesos</strong></div>
      <div class="detail-row"><span>ALMACEN</span><strong>Registrar llegadas y preparar solicitudes</strong></div>
      <div class="detail-row"><span>INVENTARIOS</span><strong>Registrar fichas y gestionar catálogo</strong></div>
      <div class="detail-row"><span>COMERCIAL</span><strong>Crear solicitudes para sedes</strong></div>
      <div class="detail-row"><span>ENSAMBLAJE</span><strong>Consultar y preparar solicitudes</strong></div></div>
    </section></div>
    <section class="panel accounts-panel"><div class="accounts-head"><div><h2>Cuentas creadas</h2><p class="hint">Consulta las cuentas del equipo. Se muestran hasta 10 por página.</p></div>
      <div class="account-search"><label for="buscarCuenta">Buscar cuenta</label><div class="search-controls"><input id="buscarCuenta" name="buscarCuenta" type="text" [(ngModel)]="busqueda" (ngModelChange)="buscar()" placeholder="Nombre o usuario" maxlength="180" /><button type="button" class="clear-search" (click)="limpiarBusqueda()" [disabled]="!busqueda" aria-label="Limpiar búsqueda" title="Limpiar búsqueda">✕</button></div></div></div>
      @if (errorLista()) { <p class="message error" role="alert">{{errorLista()}}</p> }
      @if (cuentas(); as resultado) {
        <div class="table-wrap"><table><thead><tr><th>Trabajador</th><th>Usuario</th><th>Rol</th><th>Estado</th></tr></thead><tbody>
          @for (cuenta of resultado.items; track cuenta.id) { <tr><td><strong>{{cuenta.nombreCompleto}}</strong></td><td>{{cuenta.nombreUsuario}}</td><td>{{nombreRol(cuenta.rolCodigo)}}</td><td><span class="account-state" [class.inactive]="cuenta.estado !== 'ACTIVO'">{{cuenta.estado}}</span></td></tr> }
          @empty { <tr><td colspan="4" class="no-results">No se encontraron cuentas.</td></tr> }
        </tbody></table></div>
        <div class="accounts-footer"><span>{{resultado.totalElementos}} {{resultado.totalElementos === 1 ? 'cuenta' : 'cuentas'}} · Página {{resultado.pagina + 1}} de {{totalPaginas(resultado) || 1}}</span>
        @if (totalPaginas(resultado) > 1) { <nav class="account-pages" aria-label="Páginas de cuentas"><button type="button" (click)="irPagina(resultado.pagina - 1)" [disabled]="listando() || resultado.pagina === 0">Anterior</button>
          @for (numero of paginasVisibles(totalPaginas(resultado), resultado.pagina); track numero) { <button type="button" [attr.aria-current]="numero === resultado.pagina ? 'page' : null" [attr.aria-label]="'Página ' + (numero + 1)" (click)="irPagina(numero)" [disabled]="listando()">{{numero + 1}}</button> }
          <button type="button" (click)="irPagina(resultado.pagina + 1)" [disabled]="listando() || resultado.pagina + 1 >= totalPaginas(resultado)">Siguiente</button></nav> }</div>
      }
    </section></div>`,
  styleUrl: './usuarios.page.css'
})
export class UsuariosPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busquedas = new Subject<{pagina:number; buscar:string}>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly created = signal<UsuarioCreado | null>(null);
  readonly cuentas = signal<PaginaCuentas | null>(null);
  readonly listando = signal(false);
  readonly errorLista = signal('');
  busqueda = '';
  form = { nombreCompleto: '', nombreUsuario: '', rolCodigo: 'ALMACEN', clave: '' };

  ngOnInit(): void {
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
  buscar(): void { this.irPagina(0); }
  limpiarBusqueda(): void { this.busqueda = ''; this.buscar(); }
  nombreRol(codigo: string): string {
    return ({ADMIN:'Administración', ALMACEN:'Almacén', INVENTARIOS:'Inventarios', COMERCIAL:'Comercial', ENSAMBLAJE:'Ensamblaje'} as Record<string,string>)[codigo] ?? codigo;
  }
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
    this.busy.set(true);
    this.http.post<UsuarioCreado>('/api/v1/usuarios', this.form).subscribe({
      next: value => { this.created.set(value); this.form.clave = ''; this.busy.set(false); this.busqueda = ''; this.irPagina(0); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
