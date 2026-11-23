import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Sede { id: number; codigo: string; nombre: string; tipo: string }
interface Movimiento { id: number; destinoId: number; destinoNombre: string; tipo: string; registrador: string; fecha: string }
interface Moto { id: number; marca: string; modelo: string; color: string; chasisVista: string }
interface Envio { origen: string; destino: string; estado: string }

@Component({
  selector: 'app-ubicaciones', imports: [FormsModule],
  template: `
    <header class="page-heading"><span class="eyebrow">CONTROL DE INVENTARIO</span><h1>Ubicaciones de motocicletas</h1>
    <p>Busca una motocicleta por chasis para ver dónde está. Registra su primera ubicación o el traslado a otra sede cuando se mueva físicamente.</p></header>
    @if (access.can('PERMISOS_ASIGNAR')) {
      <section class="panel"><div class="panel-heading"><span class="eyebrow">ADMINISTRACIÓN</span><h2>Sedes de la empresa</h2>
        <p>Registra almacenes y tiendas reales antes de cerrar guías o solicitar envíos.</p></div>
        <label>Código de sede<input [(ngModel)]="nuevaSede.codigo" maxlength="50" placeholder="Ej. ALM-CENTRAL"></label>
        <label>Nombre<input [(ngModel)]="nuevaSede.nombre" maxlength="120" placeholder="Ej. Almacén central"></label>
        <label>Tipo<select [(ngModel)]="nuevaSede.tipo"><option value="ALMACEN">Almacén</option><option value="TIENDA">Tienda</option><option value="TALLER">Taller</option><option value="DESPACHO">Despacho</option></select></label>
        <button type="button" (click)="crearSede()" [disabled]="ocupado() || !nuevaSede.codigo.trim() || !nuevaSede.nombre.trim()">Guardar sede</button>
        @for (sede of sedes(); track sede.id) { <p>{{sede.nombre}} · {{sede.tipo}} · {{sede.codigo}}</p> }
      </section>
    }
    <section class="panel"><div class="panel-heading"><span class="eyebrow">CONSULTA</span><h2>Buscar ubicación</h2></div><label>Chasis completo o últimos cuatro dígitos <input type="text" [(ngModel)]="chasis" maxlength="120"></label>
      <button type="button" (click)="buscarMotocicletas()" [disabled]="ocupado() || !chasis.trim()">Buscar motocicletas</button>
      @for (moto of coincidencias(); track moto.id) {
        <button type="button" (click)="seleccionar(moto)">{{moto.marca}} {{moto.modelo}} · {{moto.color}} · {{moto.chasisVista}}</button>
      }
      @if (seleccionada()) { <p>Motocicleta seleccionada: <strong>{{seleccionada()?.marca}} {{seleccionada()?.modelo}} · {{seleccionada()?.chasisVista}}</strong></p> }
      @if (actual()) { <p>Última ubicación confirmada: <strong>{{actual()?.destinoNombre}}</strong></p> }
      @if (envioActivo(); as envio) { <p><strong>En tránsito</strong> desde {{envio.origen}} hacia {{envio.destino}}. La ubicación cambiará cuando la tienda confirme la recepción.</p> }
      @for (movimiento of historial(); track movimiento.id) {
        <p>{{movimiento.tipo}} · {{movimiento.destinoNombre}} · {{movimiento.fecha}} · {{movimiento.registrador}}</p>
      }
      @if (historial().length === 0 && consultado()) { <p>Todavía no se ha registrado una ubicación.</p> }
    </section>
    @if ((access.can('UBICACIONES_REGISTRAR') || access.can('TRASLADOS_REGISTRAR')) && !envioActivo()) {
      <section class="panel"><div class="panel-heading"><span class="eyebrow">MOVIMIENTO FÍSICO</span><h2>Registrar movimiento</h2><p>Selecciona la sede que recibirá la motocicleta.</p></div>
        <label>Destino <select [(ngModel)]="destinoId"><option [ngValue]="0">Seleccione sede</option>
          @for (sede of sedes(); track sede.id) {
            <option [ngValue]="sede.id">{{sede.nombre}} ({{sede.tipo}})</option>
          }
        </select></label>
        @if (access.can('UBICACIONES_REGISTRAR') && !actual()) {
          <button type="button" (click)="guardar(false)" [disabled]="ocupado() || !destinoId || motocicletaId < 1">Primera ubicación</button>
        }
        @if (access.can('TRASLADOS_REGISTRAR') && actual()) {
          <button type="button" (click)="guardar(true)" [disabled]="ocupado() || !destinoId || motocicletaId < 1">Registrar traslado</button>
        }
      </section>
    }
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (mensaje()) { <p role="status">{{mensaje()}}</p> }
  `,
  styles: [`:host{display:block;max-width:1120px;margin:auto;color:#102a49}.page-heading{margin:8px 0 26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:#173c64}h1{font-size:clamp(28px,3vw,38px);margin:8px 0}h2{font-size:21px;margin:5px 0}p{color:#627893;line-height:1.55}.page-heading p{max-width:760px;margin:0}.panel{background:#fff;border:1px solid #dfe7ef;border-radius:16px;padding:26px;margin:20px 0;box-shadow:0 10px 30px #1836560a}.panel-heading{padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid #e6edf3}.panel-heading p{margin:4px 0 0}label{display:grid;gap:7px;margin:12px 0 16px;font-size:13px;font-weight:700;max-width:720px}input,select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d4dfe9;border-radius:9px;background:#fff;color:#102a49;font:inherit}input:focus,select:focus{outline:2px solid #93b9db;outline-offset:1px}button{border:0;border-radius:9px;background:#183d66;color:white;font:inherit;font-weight:700;padding:11px 15px;cursor:pointer;margin:4px 8px 4px 0}button:hover:not(:disabled){background:#245684}button:disabled{opacity:.55;cursor:not-allowed}.panel>p{padding:10px 12px;background:#f6f9fc;border-radius:9px}[role=alert],[role=status]{padding:12px 16px;border-radius:9px}[role=alert]{color:#9e332c;background:#fff0ee}[role=status]{color:#176744;background:#eaf8ee}@media(max-width:560px){.panel{padding:18px}button{width:100%;margin:5px 0}}`]
})
export class UbicacionesPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly sedes = signal<Sede[]>([]);
  readonly actual = signal<Movimiento | null>(null);
  readonly envioActivo = signal<Envio | null>(null);
  readonly historial = signal<Movimiento[]>([]);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly ocupado = signal(false);
  readonly consultado = signal(false);
  readonly coincidencias = signal<Moto[]>([]);
  readonly seleccionada = signal<Moto | null>(null);
  chasis = '';
  motocicletaId = 0;
  destinoId = 0;
  nuevaSede = {codigo:'',nombre:'',tipo:'ALMACEN'};

  constructor() {
    this.http.get<Sede[]>('/api/v1/ubicaciones').subscribe({next: sedes => this.sedes.set(sedes), error: err => this.error.set(apiError(err))});
  }
  crearSede(): void {
    const datos = {codigo:this.nuevaSede.codigo.trim(),nombre:this.nuevaSede.nombre.trim(),tipo:this.nuevaSede.tipo};
    if (!datos.codigo || !datos.nombre || this.ocupado()) return;
    this.ocupado.set(true); this.error.set(''); this.mensaje.set('');
    this.http.post<Sede>('/api/v1/ubicaciones',datos).subscribe({
      next: sede => { this.sedes.update(actual => [...actual,sede].sort((a,b) => a.nombre.localeCompare(b.nombre)));
        this.nuevaSede = {codigo:'',nombre:'',tipo:'ALMACEN'}; this.ocupado.set(false);
        this.mensaje.set('Sede registrada.'); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }
  buscarMotocicletas(): void {
    const chasis = this.chasis.trim();
    this.error.set(''); this.mensaje.set(''); this.seleccionada.set(null);
    this.motocicletaId = 0; this.actual.set(null); this.envioActivo.set(null); this.historial.set([]); this.consultado.set(false); this.coincidencias.set([]);
    if (chasis.length < 4) { this.error.set('Ingresa el chasis completo o sus últimos cuatro dígitos.'); return; }
    this.ocupado.set(true);
    this.http.get<{items:Moto[]}>('/api/v1/motocicletas', {params:{chasis, pagina:0, tamano:10}}).subscribe({
      next: page => { this.coincidencias.set(page.items); this.ocupado.set(false);
        if (!page.items.length) this.error.set('No se encontraron motocicletas.'); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  seleccionar(moto: Moto): void {
    this.motocicletaId = moto.id; this.destinoId = 0;
    this.seleccionada.set(moto); this.coincidencias.set([]); this.consultar();
  }
  consultar(): void {
    this.actual.set(null); this.envioActivo.set(null); this.historial.set([]); this.consultado.set(false); this.error.set('');
    if (this.motocicletaId < 1) return;
    const consultada = this.motocicletaId;
    this.http.get<Envio | null>(`/api/v1/motocicletas/${consultada}/envio-activo`).subscribe({
      next: envio => { if (this.motocicletaId === consultada) this.envioActivo.set(envio); },
      error: err => { if (this.motocicletaId === consultada) this.error.set(apiError(err)); }
    });
    this.ocupado.set(true);
    this.http.get<Movimiento[]>(`/api/v1/motocicletas/${this.motocicletaId}/ubicacion/historial`).subscribe({
      next: lista => { this.historial.set(lista); this.actual.set(lista.at(-1) ?? null); this.consultado.set(true); this.ocupado.set(false); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  guardar(traslado: boolean): void {
    this.ocupado.set(true); this.error.set(''); this.mensaje.set('');
    const ruta = traslado ? 'traslados' : 'ubicacion';
    this.http.post<Movimiento>(`/api/v1/motocicletas/${this.motocicletaId}/${ruta}`, {destinoId:this.destinoId}).subscribe({
      next: () => { this.ocupado.set(false); this.mensaje.set('Movimiento registrado.'); this.consultar(); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
}
