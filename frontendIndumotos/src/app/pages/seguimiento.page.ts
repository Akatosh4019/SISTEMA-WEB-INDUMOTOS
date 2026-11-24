import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id: number; marca: string; modelo: string; color: string; cantidad: number }
interface Solicitud { id: number; estado: string; lineas: Linea[]; solicitante: string }
interface Evento { id: number; estado: string; fecha: string; registrador: string; motivo: string | null }
interface Unidad { asociacionId: number; chasis: string }
interface Candidata { motocicletaId: number; chasis: string; modelo: string; color: string }
interface Envio { motocicletaId: number; chasis: string; origen: string; destino: string;
  estado: string; despachadoEn: string; recibidoEn: string | null }

@Component({
  selector: 'app-seguimiento', imports: [FormsModule],
  template: `
    <header class="page-heading"><span class="eyebrow">OPERACIÓN DE ALMACÉN</span><h1>Preparación de solicitudes</h1>
    <p>Selecciona una solicitud, asigna las motos y confirma la preparación. Almacén registra la salida y la tienda confirma la recepción física.</p></header>
    <section class="panel"><div class="panel-heading"><span class="eyebrow">PASO 1</span><h2>Elegir solicitud</h2></div><label>Solicitud <select [(ngModel)]="solicitudId"><option [ngValue]="0">Selecciona una solicitud</option>
      @for (item of solicitudes(); track item.id) { <option [ngValue]="item.id">{{item.solicitante}} · {{item.estado}} · {{item.lineas[0]?.marca}} {{item.lineas[0]?.modelo}}</option> }
      </select></label>
      <button type="button" (click)="consultar()" [disabled]="solicitudId < 1 || ocupado()">Ver seguimiento</button>
      @if (hayMas()) { <button type="button" (click)="cargarSolicitudes()" [disabled]="ocupado()">Cargar más solicitudes</button> }
    </section>
    @if (solicitud(); as s) {
      <section class="panel"><div class="panel-heading"><span class="eyebrow">PASO 2 · SEGUIMIENTO</span><h2>Solicitud <span class="badge">{{s.estado}}</span></h2><p>Solicitada por {{s.solicitante}}</p></div>
        @if (access.can('SOLICITUDES_AVANZAR')) {
          @if (s.estado === 'PENDIENTE') { <button type="button" (click)="avanzar('EN_PREPARACION')">Iniciar preparación</button> }
          @if (s.estado === 'EN_PREPARACION') { <button type="button" (click)="avanzar('ATENDIDA')">Confirmar preparación</button> }
          @if (s.estado === 'PENDIENTE' || s.estado === 'EN_PREPARACION') {
            <button type="button" (click)="avanzar('RECHAZADA')">Rechazar</button>
          }
        }
        @if (access.can('SOLICITUDES_ANULAR') && s.estado === 'PENDIENTE') {
          <button type="button" (click)="anular()">Anular solicitud</button>
        }
        <h3>Historial de cambios</h3>
        @for (evento of eventos(); track evento.id) {
          <p>{{evento.estado}} · {{evento.fecha}} · {{evento.registrador}} {{evento.motivo || ''}}</p>
        }
      </section>
      @if (s.estado === 'ATENDIDA' || envios().length) {
        <section class="panel"><div class="panel-heading"><span class="eyebrow">ENTREGA FÍSICA</span><h2>Salida y recepción</h2>
          <p>La ubicación confirmada cambia únicamente cuando la tienda confirma que recibió las motos.</p></div>
          @if (access.can('TRASLADOS_REGISTRAR') && s.estado === 'ATENDIDA' && !envios().length) {
            <button type="button" (click)="despachar()" [disabled]="ocupado()">Registrar salida de almacén</button>
          }
          @if (!envios().length) { <p>La preparación está confirmada; aún no se registra la salida física.</p> }
          @for (envio of envios(); track envio.motocicletaId) {
            <p><strong>{{envio.chasis}}</strong> · {{envio.origen}} → {{envio.destino}} · {{envio.estado === 'EN_TRANSITO' ? 'En tránsito' : 'Recibida en tienda' }}
              @if (access.can('RECEPCIONES_CONFIRMAR') && envio.estado === 'EN_TRANSITO' &&
                (s.solicitante.toLowerCase() === access.username().toLowerCase() || access.access()?.rolCodigo === 'ADMIN')) {
                <button type="button" (click)="recibir(envio.motocicletaId)" [disabled]="ocupado()">Confirmar recepción</button>
              }</p>
          }
        </section>
      }
      @if (access.can('UNIDADES_ASIGNAR')) {
        <section class="panel"><div class="panel-heading"><span class="eyebrow">PASO 3 · ASIGNACIÓN</span><h2>Unidades solicitadas</h2><p>Asigna un chasis disponible por cada unidad pedida antes de confirmar.</p></div>
          @for (linea of s.lineas; track linea.id) {
            <article><h3>{{linea.marca}} {{linea.modelo}} · {{linea.color}} · {{linea.cantidad}}</h3>
              <button type="button" (click)="verUnidades(linea.id)">Ver asignadas</button>
              @for (unidad of unidades()[linea.id]; track unidad.asociacionId) {
                <p>{{unidad.chasis}}
                  @if (s.estado === 'EN_PREPARACION') {
                    <button type="button" (click)="retirar(linea.id,unidad.asociacionId)">Retirar</button>
                  }
                </p>
              }
              @if (s.estado === 'EN_PREPARACION') {
                <label>Buscar chasis <input [(ngModel)]="chasis"></label>
                <button type="button" (click)="buscar()">Buscar libres</button>
                @for (moto of candidatas(); track moto.motocicletaId) {
                  <button type="button" (click)="asignar(linea.id,moto.motocicletaId)">Asignar {{moto.chasis}} · {{moto.modelo}} · {{moto.color}}</button>
                }
              }
            </article>
          }
        </section>
      }
    }
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (mensaje()) { <p role="status">{{mensaje()}}</p> }
  `,
  styles: [`:host{display:block;max-width:1120px;margin:auto;color:#102a49}.page-heading{margin:8px 0 26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:#173c64}h1{font-size:clamp(28px,3vw,38px);margin:8px 0}h2{font-size:21px;margin:5px 0}h3{font-size:16px;margin:20px 0 10px}p{color:#627893;line-height:1.55}.page-heading p{max-width:760px;margin:0}.panel{background:#fff;border:1px solid #dfe7ef;border-radius:16px;padding:26px;margin:20px 0;box-shadow:0 10px 30px #1836560a}.panel-heading{padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid #e6edf3}.panel-heading p{margin:4px 0 0}.badge{display:inline-block;vertical-align:middle;padding:6px 10px;border-radius:999px;background:#eaf1f8;color:#173c64;font-size:11px;font-weight:800}article{border:1px solid #e5edf4;background:#f8fafc;border-radius:12px;padding:16px;margin:14px 0}article h3{margin:0 0 12px}article p{padding:8px 12px;background:#fff;border-radius:8px}label{display:grid;gap:7px;margin:10px 0 16px;font-size:13px;font-weight:700;max-width:720px}input,select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d4dfe9;border-radius:9px;background:#fff;color:#102a49;font:inherit}input:focus,select:focus{outline:2px solid #93b9db;outline-offset:1px}button{border:0;border-radius:9px;background:#183d66;color:white;font:inherit;font-weight:700;padding:11px 15px;cursor:pointer;margin:4px 8px 4px 0}button:hover:not(:disabled){background:#245684}button:disabled{opacity:.55;cursor:not-allowed}[role=alert],[role=status]{padding:12px 16px;border-radius:9px}[role=alert]{color:#9e332c;background:#fff0ee}[role=status]{color:#176744;background:#eaf8ee}@media(max-width:560px){.panel{padding:18px}button{width:100%;margin:5px 0}}`]
})
export class SeguimientoPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly solicitud = signal<Solicitud | null>(null);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly hayMas = signal(true);
  readonly eventos = signal<Evento[]>([]);
  readonly unidades = signal<Record<number,Unidad[]>>({});
  readonly candidatas = signal<Candidata[]>([]);
  readonly envios = signal<Envio[]>([]);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly ocupado = signal(false);
  solicitudId = 0;
  chasis = '';
  private paginaSolicitudes = 0;

  constructor() { this.cargarSolicitudes(); }

  cargarSolicitudes(): void {
    this.ocupado.set(true);
    this.http.get<Solicitud[]>('/api/v1/solicitudes', {params:{pagina:this.paginaSolicitudes,tamano:20}}).subscribe({
      next: lista => { this.solicitudes.update(actual => [...actual, ...lista]);
        this.paginaSolicitudes++; this.hayMas.set(lista.length === 20); this.ocupado.set(false); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }

  consultar(): void {
    this.ocupado.set(true); this.error.set(''); this.solicitud.set(null); this.envios.set([]);
    this.http.get<Solicitud>(`/api/v1/solicitudes/${this.solicitudId}`).subscribe({
      next: s => { this.solicitud.set(s); this.ocupado.set(false); this.historial(); this.cargarEnvios(); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  historial(): void {
    this.http.get<Evento[]>(`/api/v1/solicitudes/${this.solicitudId}/seguimiento`).subscribe({
      next: lista => this.eventos.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  cargarEnvios(): void {
    this.http.get<Envio[]>(`/api/v1/solicitudes/${this.solicitudId}/envios`).subscribe({
      next: lista => this.envios.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  despachar(): void {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.post<Envio[]>(`/api/v1/solicitudes/${this.solicitudId}/envios/despacho`,{}).subscribe({
      next: lista => { this.envios.set(lista); this.ocupado.set(false); this.mensaje.set('Salida registrada. Las motos figuran en tránsito.'); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }
  recibir(motocicletaId: number): void {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.post<Envio[]>(`/api/v1/solicitudes/${this.solicitudId}/envios/recepcion`,
      {motocicletaId}).subscribe({
      next: lista => { this.envios.set(lista); this.ocupado.set(false); this.mensaje.set('Recepción confirmada y ubicaciones actualizadas.'); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }
  avanzar(estado: string): void {
    const motivo = estado === 'RECHAZADA' ? window.prompt('Motivo del rechazo:') : null;
    if (estado === 'RECHAZADA' && !motivo?.trim()) return;
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/seguimiento`,{estado,motivo}).subscribe({
      next: () => { this.mensaje.set('Estado actualizado.'); this.consultar(); }, error: err => this.error.set(apiError(err))
    });
  }
  anular(): void {
    const motivo = window.prompt('Motivo de la anulación:');
    if (!motivo?.trim()) return;
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/anulacion`,{motivo}).subscribe({
      next: () => { this.mensaje.set('Solicitud anulada.'); this.consultar(); }, error: err => this.error.set(apiError(err))
    });
  }
  verUnidades(linea: number): void {
    this.http.get<Unidad[]>(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`).subscribe({
      next: lista => this.unidades.update(actual => ({...actual,[linea]:lista})), error: err => this.error.set(apiError(err))
    });
  }
  buscar(): void {
    this.http.get<Candidata[]>('/api/v1/motocicletas/elegibles',{params:{chasis:this.chasis}}).subscribe({
      next: lista => this.candidatas.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  asignar(linea: number,motocicletaId: number): void {
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`,{motocicletaId}).subscribe({
      next: () => { this.candidatas.set([]); this.verUnidades(linea); this.mensaje.set('Unidad asignada.'); },
      error: err => this.error.set(apiError(err))
    });
  }
  retirar(linea: number,asociacion: number): void {
    const motivo = window.prompt('Motivo del retiro:');
    if (!motivo?.trim()) return;
    this.http.request('DELETE',`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades/${asociacion}`,{body:{motivo}}).subscribe({
      next: () => { this.verUnidades(linea); this.mensaje.set('Unidad retirada.'); },
      error: err => this.error.set(apiError(err))
    });
  }
}
