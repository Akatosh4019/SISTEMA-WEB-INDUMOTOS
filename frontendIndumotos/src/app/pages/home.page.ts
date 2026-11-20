import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `<div class="eyebrow">PANEL PRINCIPAL</div>
    <h1>Bienvenido, {{ roleName() }}</h1>
    <p class="lead">{{orientacion()}}</p>
    <div class="grid" aria-label="Accesos a módulos">
      @if (auth.can('LLEGADAS_REGISTRAR')) { <a class="action-card" routerLink="/app/llegadas"><span class="card-symbol">⇥</span><span class="card-kicker">RECEPCIÓN</span><strong>Registrar llegada</strong><span class="card-copy">Anota la guía y las cantidades recibidas para iniciar el registro.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('FICHAS_REGISTRAR')) { <a class="action-card" routerLink="/app/fichas"><span class="card-symbol muted">▤</span><span class="card-kicker">INVENTARIO</span><strong>Registrar ficha</strong><span class="card-copy">Asocia una motocicleta a la llegada que le corresponde.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('CATALOGO_GESTIONAR')) { <a class="action-card" routerLink="/app/catalogo"><span class="card-symbol muted">▤</span><span class="card-kicker">CATÁLOGO</span><strong>Agregar marca, modelo y color</strong><span class="card-copy">Prepara las opciones que usarán Inventarios y Comercial.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('SOLICITUDES_CREAR')) { <a class="action-card" routerLink="/app/solicitudes"><span class="card-symbol muted">☷</span><span class="card-kicker">COMERCIAL</span><strong>Solicitar motocicletas</strong><span class="card-copy">Elige modelos, cantidades y la sede que los recibirá.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('SOLICITUDES_AVANZAR')) { <a class="action-card" routerLink="/app/seguimiento"><span class="card-symbol muted">↗</span><span class="card-kicker">PREPARACIÓN</span><strong>Atender solicitudes</strong><span class="card-copy">Asigna los chasis y confirma cuando esté todo preparado.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('INVENTARIO_CONSULTAR')) { <a class="action-card" routerLink="/app/inventario"><span class="card-symbol muted">⌕</span><span class="card-kicker">CONSULTA</span><strong>Buscar motocicletas</strong><span class="card-copy">Busca por chasis o filtra el inventario por marca, modelo y color.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('USUARIOS_CREAR')) { <a class="action-card" routerLink="/app/usuarios"><span class="card-symbol muted">♙</span><span class="card-kicker">ADMINISTRACIÓN</span><strong>Crear cuenta</strong><span class="card-copy">Registra una cuenta individual para un trabajador autorizado.</span><span class="card-arrow">Abrir módulo →</span></a> }
      @if (auth.can('PERMISOS_ASIGNAR')) { <a class="action-card" routerLink="/app/permisos"><span class="card-symbol muted">◇</span><span class="card-kicker">ACCESO</span><strong>Roles y permisos</strong><span class="card-copy">Consulta y ajusta el acceso de una cuenta.</span><span class="card-arrow">Abrir módulo →</span></a> }
    </div>`,
  styles: [`:host{display:block}.eyebrow{font-size:11px;letter-spacing:.15em;color:#193d61;font-weight:800}h1{font-size:30px;letter-spacing:-.04em;margin:7px 0 5px;color:#1b293b}.lead{max-width:760px;color:#6a788b;line-height:1.45;margin:0 0 18px;font-size:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.action-card{min-height:116px;padding:13px 15px;border:1px solid #e2e8ee;background:#fff;border-radius:12px;display:grid;grid-template-columns:36px minmax(0,1fr) auto;grid-template-rows:auto auto 1fr;column-gap:12px;align-items:start;text-decoration:none;color:#1b293b;box-shadow:0 5px 18px rgba(30,50,70,.035);transition:border-color .18s,box-shadow .18s,transform .18s}.action-card:hover{border-color:#ed977f;box-shadow:0 9px 22px rgba(30,50,70,.09);transform:translateY(-2px)}.action-card:focus-visible{outline:3px solid #cbd51c;outline-offset:2px}.card-symbol{grid-column:1;grid-row:1/4;display:grid;place-items:center;width:36px;height:36px;background:#e8edf3;color:#193d61;border-radius:9px;font-size:20px}.card-symbol.muted{background:#eaf1f7;color:#728ba3}.card-kicker{grid-column:2;grid-row:1;font-size:9px;letter-spacing:.13em;color:#8c9aaa;font-weight:800;line-height:1.2}.action-card strong{grid-column:2;grid-row:2;font-size:16px;letter-spacing:-.02em;line-height:1.2;margin-top:3px}.card-copy{grid-column:2;grid-row:3;color:#708094;font-size:12px;line-height:1.35;margin-top:5px}.card-arrow{grid-column:3;grid-row:2;align-self:center;color:#dc5538;font-weight:700;font-size:0;white-space:nowrap}.card-arrow::after{content:'→';font-size:20px}@media(max-width:760px){.grid{grid-template-columns:1fr}.action-card{min-height:104px}}@media(max-width:420px){h1{font-size:26px}.action-card{padding:12px;column-gap:10px}}`]
})
export class HomePage {
  readonly auth = inject(AuthService);
  readonly orientacion = computed(() => {
    const role = this.auth.access()?.rolCodigo;
    return role === 'ALMACEN' ? 'Registra las guías recibidas, prepara las motos solicitadas y confirma los movimientos hacia su sede.'
      : role === 'INVENTARIOS' ? 'Mantén el catálogo, registra cada motocicleta de una llegada y consulta sus fichas.'
      : role === 'COMERCIAL' ? 'Solicita las motocicletas que necesita cada sede y consulta el estado de tus pedidos.'
      : role === 'ENSAMBLAJE' ? 'Consulta las solicitudes asignadas y registra su preparación.'
      : 'Consulta el inventario y administra las operaciones y accesos del equipo.';
  });
  readonly roleName = computed(() => {
    const role = this.auth.access()?.rolCodigo;
    return role === 'ADMIN' ? 'Administrador' : role === 'ALMACEN' ? 'Almacén'
      : role === 'INVENTARIOS' ? 'Inventarios' : role === 'COMERCIAL' ? 'Comercial'
      : role === 'ENSAMBLAJE' ? 'Ensamblaje' : role?.replaceAll('_', ' ') || 'Usuario';
  });
}
