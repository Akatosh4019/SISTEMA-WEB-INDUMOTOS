import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `<div class="eyebrow">PANEL PRINCIPAL</div>
    <h1>Tu espacio de trabajo</h1>
    <p class="lead">Consulta y registra los movimientos de motocicletas con la información vinculada a cada llegada.</p>
    <div class="grid">
      <a class="action-card" routerLink="/app/llegadas"><span class="card-symbol">⇥</span><span class="card-kicker">RECEPCIÓN</span><strong>Registrar llegada</strong><span class="card-copy">Anota la guía y las cantidades recibidas para iniciar el registro.</span><span class="card-arrow">Abrir módulo →</span></a>
      <a class="action-card" routerLink="/app/fichas"><span class="card-symbol muted">▤</span><span class="card-kicker">INVENTARIO</span><strong>Registrar ficha</strong><span class="card-copy">Asocia una motocicleta a la llegada que le corresponde.</span><span class="card-arrow">Abrir módulo →</span></a>
      <a class="action-card" routerLink="/app/usuarios"><span class="card-symbol muted">♙</span><span class="card-kicker">ADMINISTRACIÓN</span><strong>Crear cuenta</strong><span class="card-copy">Registra una cuenta individual para un trabajador autorizado.</span><span class="card-arrow">Abrir módulo →</span></a>
      <a class="action-card" routerLink="/app/permisos"><span class="card-symbol muted">◇</span><span class="card-kicker">ACCESO</span><strong>Roles y permisos</strong><span class="card-copy">Consulta y ajusta el acceso de una cuenta.</span><span class="card-arrow">Abrir módulo →</span></a>
    </div>`,
  styles: [`:host{display:block}.eyebrow{font-size:11px;letter-spacing:.15em;color:#df5437;font-weight:800}h1{font-size:34px;letter-spacing:-.04em;margin:11px 0 8px;color:#1b293b}.lead{max-width:620px;color:#6a788b;line-height:1.6;margin:0 0 30px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.action-card,.info-card{min-height:250px;padding:26px;border:1px solid #e2e8ee;background:#fff;border-radius:13px;display:flex;flex-direction:column;align-items:flex-start;text-decoration:none;color:#1b293b;box-shadow:0 5px 24px rgba(30,50,70,.035)}.action-card:hover{border-color:#ed977f;transform:translateY(-2px)}.card-symbol{display:grid;place-items:center;width:43px;height:43px;background:#fff0ea;color:#e45738;border-radius:10px;font-size:24px}.card-symbol.muted{background:#eaf1f7;color:#728ba3}.card-kicker{font-size:10px;letter-spacing:.14em;color:#8c9aaa;font-weight:800;margin:25px 0 7px}strong{font-size:20px;letter-spacing:-.02em}.card-copy{color:#708094;font-size:14px;line-height:1.55;margin-top:9px}.card-arrow{margin-top:auto;padding-top:20px;color:#dc5538;font-weight:700;font-size:13px}@media(max-width:760px){.grid{grid-template-columns:1fr}}`]
})
export class HomePage {}
