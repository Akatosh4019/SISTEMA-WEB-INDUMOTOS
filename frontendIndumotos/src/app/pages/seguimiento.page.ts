import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id: number; marca: string; modelo: string; color: string; cantidad: number }
interface Solicitud { id: number; estado: string; lineas: Linea[]; solicitante: string; destinoNombre?: string }
interface Evento { id: number; estado: string; fecha: string; registrador: string; motivo: string | null }
interface Unidad { asociacionId: number; chasis: string }
interface Candidata { motocicletaId: number; chasis: string; modelo: string; color: string }
interface Envio { motocicletaId: number; chasis: string; origen: string; destino: string;
  estado: string; despachadoEn: string; recibidoEn: string | null }
interface Moto { id: number; marca: string; modelo: string; color: string; chasisVista: string }
interface Sede { id: number; nombre: string; tipo: string }
interface PasoRecorrido { tipo: string; titulo: string; detalle: string | null; origen: string | null;
  destino: string | null; responsable: string; fecha: string }
interface Recorrido { moto: { id: number; marca: string; modelo: string; color: string; chasis: string };
  ubicacionActual: string | null; enCamino: { origen: string; destino: string; desde: string } | null;
  vendida: boolean; eventos: PasoRecorrido[] }
type Motivo = { accion: 'RECHAZADA' | 'ANULAR' | 'RETIRAR'; titulo: string; linea?: number; asociacion?: number };

const ESTADOS: Record<string, string> = { PENDIENTE: 'Pendiente', EN_PREPARACION: 'En preparación', ATENDIDA: 'Atendida',
  RECHAZADA: 'Rechazada', ANULADA: 'Anulada' };

@Component({
  selector: 'app-seguimiento', imports: [FormsModule, DatePipe],
  template: `<div class="im-page">
    <header class="page-heading"><div><span class="eyebrow">TRAZABILIDAD</span><h1>Seguimiento</h1>
      <p>Revisa el recorrido completo de cada motocicleta, desde su llegada hasta su venta, y atiende la preparación de las solicitudes.</p></div></header>
    <nav class="im-tabs" aria-label="Vistas de seguimiento">
      @if (access.can('UBICACIONES_CONSULTAR')) { <button type="button" [class.active]="vistaActual() === 'recorrido'" (click)="vista.set('recorrido')">Recorrido de motocicletas</button> }
      @if (access.can('SOLICITUDES_CONSULTAR')) { <button type="button" [class.active]="vistaActual() === 'solicitudes'" (click)="vista.set('solicitudes')">Preparación de solicitudes</button> }
    </nav>
    @if (error() && !motivoAbierto() && !movimientoAbierto()) { <p class="im-alert error" role="alert">{{error()}}</p> }
    @if (mensaje()) { <p class="im-alert ok" role="status">{{mensaje()}}</p> }

    @if (vistaActual() === 'recorrido') {
      <section class="im-card"><h2 class="card-title">Buscar motocicleta</h2>
        <div class="im-toolbar"><div class="im-search"><input type="search" aria-label="Chasis de la motocicleta" placeholder="Escribe el chasis completo o sus últimos 4 dígitos" [(ngModel)]="chasis" (ngModelChange)="alEscribirChasis()" maxlength="120" /></div></div>
        @if (buscando()) { <p class="muted">Buscando…</p> }
        @if (coincidencias().length) {
          <div class="im-table-wrap"><table class="im-table"><thead><tr><th>Moto</th><th>Color</th><th>Chasis</th><th class="num"></th></tr></thead><tbody>
            @for (moto of coincidencias(); track moto.id) { <tr><td><strong>{{moto.marca}} {{moto.modelo}}</strong></td><td>{{moto.color}}</td><td>{{moto.chasisVista}}</td>
              <td><div class="actions"><button type="button" class="im-btn small" (click)="seleccionar(moto)">Ver recorrido</button></div></td></tr> }
          </tbody></table></div>
        }
      </section>
      @if (recorrido(); as r) {
        <section class="im-card"><div class="moto-head"><div><span class="eyebrow">RECORRIDO</span><h2>{{r.moto.marca}} {{r.moto.modelo}} · {{r.moto.color}}</h2><p class="muted">Chasis {{r.moto.chasis}}</p></div>
            @if (puedeMover(r)) { <button type="button" class="im-btn" (click)="abrirMovimiento()">Registrar movimiento</button> }</div>
          <div class="status-grid">
            <div><span>Estado</span><strong>@if (r.vendida) { <span class="im-badge bad">Vendida</span> } @else if (r.enCamino) { <span class="im-badge warn">En camino</span> } @else { <span class="im-badge ok">En sede</span> }</strong></div>
            <div><span>{{r.enCamino ? 'Ruta' : 'Ubicación actual'}}</span><strong>{{r.enCamino ? r.enCamino.origen + ' → ' + r.enCamino.destino : (r.ubicacionActual || 'Sin ubicación registrada')}}</strong></div>
            <div><span>Movimientos registrados</span><strong>{{r.eventos.length}}</strong></div>
          </div>
          <ol class="im-timeline">
            @for (paso of pasosRecientes(); track $index) {
              <li [class.ok]="paso.tipo === 'RECEPCION' || paso.tipo === 'VENTA'" [class.warn]="paso.tipo === 'SALIDA' || paso.tipo === 'ASIGNACION'" [class.bad]="paso.tipo === 'RETIRO' || paso.titulo.startsWith('Bloqueada')">
                <strong>{{paso.titulo}}</strong><span class="when">{{paso.fecha | date:'dd/MM/yyyy HH:mm'}} · {{paso.responsable}}</span>
                @if (paso.origen || paso.destino) { <p>{{paso.origen ? paso.origen + ' → ' : 'Destino: '}}{{paso.destino}}</p> }
                @if (paso.detalle) { <p>{{paso.detalle}}</p> }
              </li>
            } @empty { <li><strong>Sin movimientos registrados</strong></li> }
          </ol>
        </section>
      }
    }

    @if (vistaActual() === 'solicitudes') {
      <section class="im-card"><h2 class="card-title">Elegir solicitud</h2>
        <div class="im-toolbar"><select aria-label="Solicitud" class="grow" [(ngModel)]="solicitudId"><option [ngValue]="0">Selecciona una solicitud</option>
          @for (item of solicitudes(); track item.id) { <option [ngValue]="item.id">#{{item.id}} · {{item.solicitante}} · {{nombreEstado(item.estado)}} · {{item.lineas[0]?.marca}} {{item.lineas[0]?.modelo}}</option> }
          </select>
          <button type="button" class="im-btn" (click)="consultar()" [disabled]="solicitudId < 1 || ocupado()">Ver seguimiento</button>
          @if (hayMas()) { <button type="button" class="im-btn light" (click)="cargarSolicitudes()" [disabled]="ocupado()">Cargar más</button> }</div>
      </section>
      @if (solicitud(); as s) {
        <section class="im-card"><div class="moto-head"><div><span class="eyebrow">SOLICITUD #{{s.id}}</span><h2>{{s.destinoNombre || 'Solicitud'}} <span class="im-badge">{{nombreEstado(s.estado)}}</span></h2><p class="muted">Solicitada por {{s.solicitante}}</p></div>
          <div class="actions">
            @if (access.can('SOLICITUDES_AVANZAR')) {
              @if (s.estado === 'PENDIENTE') { <button type="button" class="im-btn" (click)="avanzar('EN_PREPARACION')">Iniciar preparación</button> }
              @if (s.estado === 'EN_PREPARACION') { <button type="button" class="im-btn" (click)="avanzar('ATENDIDA')">Confirmar preparación</button> }
              @if (s.estado === 'PENDIENTE' || s.estado === 'EN_PREPARACION') { <button type="button" class="im-btn light" (click)="avanzar('RECHAZADA')">Rechazar</button> }
            }
            @if (access.can('SOLICITUDES_ANULAR') && s.estado === 'PENDIENTE') { <button type="button" class="im-btn danger" (click)="anular()">Anular solicitud</button> }
          </div></div>
          <h3>Historial de estados</h3>
          <ol class="im-timeline">
            @for (evento of eventos(); track evento.id) {
              <li [class.ok]="evento.estado === 'ATENDIDA'" [class.bad]="evento.estado === 'RECHAZADA' || evento.estado === 'ANULADA'" [class.warn]="evento.estado === 'EN_PREPARACION'">
                <strong>{{nombreEstado(evento.estado)}}</strong><span class="when">{{evento.fecha | date:'dd/MM/yyyy HH:mm'}} · {{evento.registrador}}</span>
                @if (evento.motivo) { <p>{{evento.motivo}}</p> }</li>
            }
          </ol>
        </section>
        @if (s.estado === 'ATENDIDA' || envios().length) {
          <section class="im-card"><span class="eyebrow">ENTREGA FÍSICA</span><h2>Salida y recepción</h2>
            <p class="muted">La ubicación confirmada cambia únicamente cuando la tienda confirma que recibió las motos.</p>
            @if (access.can('TRASLADOS_REGISTRAR') && s.estado === 'ATENDIDA' && !envios().length) {
              <button type="button" class="im-btn" (click)="despachar()" [disabled]="ocupado()">Registrar salida de almacén</button>
            }
            @if (!envios().length) { <p class="muted">La preparación está confirmada; aún no se registra la salida física.</p> }
            @if (envios().length) {
              <div class="im-table-wrap"><table class="im-table"><thead><tr><th>Chasis</th><th>Ruta</th><th>Estado</th><th class="num"></th></tr></thead><tbody>
                @for (envio of envios(); track envio.motocicletaId) {
                  <tr><td><strong>{{envio.chasis}}</strong></td><td>{{envio.origen}} → {{envio.destino}}</td>
                    <td><span class="im-badge" [class.warn]="envio.estado === 'EN_TRANSITO'" [class.ok]="envio.estado !== 'EN_TRANSITO'">{{envio.estado === 'EN_TRANSITO' ? 'En camino' : 'Recibida en tienda'}}</span></td>
                    <td><div class="actions">@if (access.can('RECEPCIONES_CONFIRMAR') && envio.estado === 'EN_TRANSITO' &&
                      (s.solicitante.toLowerCase() === access.username().toLowerCase() || access.access()?.rolCodigo === 'ADMIN')) {
                      <button type="button" class="im-btn small" (click)="recibir(envio.motocicletaId)" [disabled]="ocupado()">Confirmar recepción</button> }</div></td></tr>
                }
              </tbody></table></div>
            }
          </section>
        }
        @if (access.can('UNIDADES_ASIGNAR')) {
          <section class="im-card"><span class="eyebrow">ASIGNACIÓN</span><h2>Unidades solicitadas</h2><p class="muted">Asigna un chasis disponible por cada unidad pedida antes de confirmar.</p>
            @for (linea of s.lineas; track linea.id) {
              <article class="linea"><div class="moto-head"><h3>{{linea.marca}} {{linea.modelo}} · {{linea.color}} · {{linea.cantidad}} unidad(es)</h3>
                <button type="button" class="im-btn small light" (click)="verUnidades(linea.id)">Ver asignadas</button></div>
                @for (unidad of unidades()[linea.id]; track unidad.asociacionId) {
                  <p class="unidad">{{unidad.chasis}}
                    @if (s.estado === 'EN_PREPARACION') { <button type="button" class="im-btn small light" (click)="retirar(linea.id,unidad.asociacionId)">Retirar</button> }</p>
                }
                @if (s.estado === 'EN_PREPARACION') {
                  <div class="im-toolbar"><div class="im-search"><input aria-label="Buscar chasis libre" placeholder="Buscar chasis libre" [(ngModel)]="chasisLibre"></div>
                    <button type="button" class="im-btn small" (click)="buscar()">Buscar libres</button></div>
                  @for (moto of candidatas(); track moto.motocicletaId) {
                    <button type="button" class="im-btn small light candidata" (click)="asignar(linea.id,moto.motocicletaId)">Asignar {{moto.chasis}} · {{moto.modelo}} · {{moto.color}}</button>
                  }
                }
              </article>
            }
          </section>
        }
      }
    }

    @if (motivoAbierto(); as m) {
      <div class="im-overlay" (click)="cerrarMotivo()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="motivo-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">MOTIVO OBLIGATORIO</span><h2 id="motivo-titulo">{{m.titulo}}</h2></div><button type="button" class="im-dialog-close" (click)="cerrarMotivo()">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="confirmarMotivo()">
          <label>Motivo<textarea name="motivo" maxlength="1000" required [(ngModel)]="motivo" placeholder="Explica brevemente por qué"></textarea></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="cerrarMotivo()">Cancelar</button><button type="submit" class="im-btn danger" [disabled]="ocupado() || !motivo.trim()">Confirmar</button></div>
        </form>
      </section></div>
    }

    @if (movimientoAbierto() && recorrido(); as r) {
      <div class="im-overlay" (click)="movimientoAbierto.set(false)"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="mov-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">MOVIMIENTO FÍSICO</span><h2 id="mov-titulo">{{r.ubicacionActual ? 'Registrar traslado' : 'Registrar primera ubicación'}}</h2><small>{{r.moto.marca}} {{r.moto.modelo}} · {{r.moto.chasis}}</small></div><button type="button" class="im-dialog-close" (click)="movimientoAbierto.set(false)">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="guardarMovimiento()">
          @if (r.ubicacionActual) { <p class="hint">Ubicación actual: <strong>{{r.ubicacionActual}}</strong></p> }
          <label>Sede que recibe la motocicleta<select name="destino" [(ngModel)]="destinoId"><option [ngValue]="0">Selecciona una sede</option>
            @for (sede of sedes(); track sede.id) { <option [ngValue]="sede.id">{{sede.nombre}} ({{sede.tipo}})</option> }</select></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="movimientoAbierto.set(false)">Cancelar</button><button type="submit" class="im-btn" [disabled]="ocupado() || !destinoId">Guardar movimiento</button></div>
        </form>
      </section></div>
    }
  </div>`,
  styles: [`.card-title{font-size:18px;margin:0 0 14px}h2{font-size:21px;margin:5px 0}h3{font-size:15px;margin:18px 0 10px}.muted{color:#7d8fa3;margin:4px 0 0}.moto-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}.actions{display:flex;gap:8px;flex-wrap:wrap}.status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 22px}.status-grid div{background:#f6f9fc;border:1px solid #e5edf4;border-radius:11px;padding:12px 14px;display:grid;gap:6px}.status-grid span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7d8fa3;font-weight:700}.status-grid strong{color:#102a49}.grow{flex:1 1 280px}.linea{border:1px solid #e5edf4;background:#f8fafc;border-radius:12px;padding:14px 16px;margin:12px 0}.linea h3{margin:0}.unidad{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:#fff;border-radius:8px;margin:6px 0}.candidata{margin:4px 6px 4px 0}@media(max-width:700px){.status-grid{grid-template-columns:1fr}}`]
})
export class SeguimientoPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly vista = signal<'recorrido' | 'solicitudes' | null>(null);
  readonly vistaActual = computed(() => this.vista() ??
    (this.access.can('UBICACIONES_CONSULTAR') ? 'recorrido' : 'solicitudes'));
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
  readonly motivoAbierto = signal<Motivo | null>(null);
  readonly coincidencias = signal<Moto[]>([]);
  readonly buscando = signal(false);
  readonly recorrido = signal<Recorrido | null>(null);
  readonly pasosRecientes = computed(() => [...(this.recorrido()?.eventos ?? [])].reverse());
  readonly sedes = signal<Sede[]>([]);
  readonly movimientoAbierto = signal(false);
  solicitudId = 0;
  chasis = '';
  chasisLibre = '';
  motivo = '';
  destinoId = 0;
  private paginaSolicitudes = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  private consultaMoto = 0;

  constructor() {
    if (!this.access.access() || this.access.can('SOLICITUDES_CONSULTAR')) this.cargarSolicitudes();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cerrarMotivo(); this.movimientoAbierto.set(false); }

  nombreEstado(estado: string): string { return ESTADOS[estado] ?? estado; }

  // ---------- Recorrido de una motocicleta ----------
  alEscribirChasis(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.buscarMotocicletas(), 350);
  }
  buscarMotocicletas(): void {
    const chasis = this.chasis.trim();
    this.coincidencias.set([]); this.error.set('');
    if (chasis.length < 4 || (chasis.length === 4 && !/^\d{4}$/.test(chasis))) return;
    const consulta = ++this.consultaMoto;
    this.buscando.set(true);
    this.http.get<{items:Moto[]}>('/api/v1/motocicletas', {params:{chasis, pagina:0, tamano:10}}).subscribe({
      next: page => { if (consulta !== this.consultaMoto) return; this.buscando.set(false); this.coincidencias.set(page.items);
        if (!page.items.length) this.error.set('No se encontraron motocicletas con ese chasis.'); },
      error: err => { if (consulta !== this.consultaMoto) return; this.buscando.set(false); this.error.set(apiError(err)); }
    });
  }
  seleccionar(moto: Moto): void { this.coincidencias.set([]); this.mensaje.set(''); this.cargarRecorrido(moto.id); }
  cargarRecorrido(id: number): void {
    this.error.set('');
    this.http.get<Recorrido>(`/api/v1/motocicletas/${id}/recorrido`).subscribe({
      next: r => this.recorrido.set(r), error: err => this.error.set(apiError(err))
    });
  }
  puedeMover(r: Recorrido): boolean {
    if (r.vendida || r.enCamino) return false;
    return r.ubicacionActual ? this.access.can('TRASLADOS_REGISTRAR') : this.access.can('UBICACIONES_REGISTRAR');
  }
  abrirMovimiento(): void {
    this.destinoId = 0; this.error.set(''); this.mensaje.set(''); this.movimientoAbierto.set(true);
    if (!this.sedes().length)
      this.http.get<Sede[]>('/api/v1/ubicaciones').subscribe({ next: s => this.sedes.set(s), error: err => this.error.set(apiError(err)) });
  }
  guardarMovimiento(): void {
    const r = this.recorrido();
    if (!r || !this.destinoId || this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    const ruta = r.ubicacionActual ? 'traslados' : 'ubicacion';
    this.http.post(`/api/v1/motocicletas/${r.moto.id}/${ruta}`, {destinoId: this.destinoId}).subscribe({
      next: () => { this.ocupado.set(false); this.movimientoAbierto.set(false); this.mensaje.set('Movimiento registrado.'); this.cargarRecorrido(r.moto.id); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }

  // ---------- Preparación de solicitudes ----------
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
      next: lista => { this.envios.set(lista); this.ocupado.set(false); this.mensaje.set('Salida registrada. Las motos figuran en camino.'); },
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
    if (estado === 'RECHAZADA') { this.pedirMotivo({accion:'RECHAZADA', titulo:'Rechazar solicitud'}); return; }
    this.enviarEstado(estado, null);
  }
  anular(): void { this.pedirMotivo({accion:'ANULAR', titulo:'Anular solicitud'}); }
  retirar(linea: number, asociacion: number): void {
    this.pedirMotivo({accion:'RETIRAR', titulo:'Retirar unidad de la solicitud', linea, asociacion});
  }
  cerrarMotivo(): void { if (!this.ocupado()) { this.motivoAbierto.set(null); this.error.set(''); } }
  confirmarMotivo(): void {
    const m = this.motivoAbierto();
    const motivo = this.motivo;
    if (!m || !motivo.trim() || this.ocupado()) return;
    if (m.accion === 'RECHAZADA') { this.enviarEstado('RECHAZADA', motivo); return; }
    this.ocupado.set(true); this.error.set('');
    if (m.accion === 'ANULAR') {
      this.http.post(`/api/v1/solicitudes/${this.solicitudId}/anulacion`,{motivo}).subscribe({
        next: () => { this.terminarMotivo('Solicitud anulada.'); this.consultar(); },
        error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
      });
      return;
    }
    this.http.request('DELETE',`/api/v1/solicitudes/${this.solicitudId}/lineas/${m.linea}/unidades/${m.asociacion}`,{body:{motivo}}).subscribe({
      next: () => { this.terminarMotivo('Unidad retirada.'); this.verUnidades(m.linea!); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }
  verUnidades(linea: number): void {
    this.http.get<Unidad[]>(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`).subscribe({
      next: lista => this.unidades.update(actual => ({...actual,[linea]:lista})), error: err => this.error.set(apiError(err))
    });
  }
  buscar(): void {
    this.http.get<Candidata[]>('/api/v1/motocicletas/elegibles',{params:{chasis:this.chasisLibre}}).subscribe({
      next: lista => this.candidatas.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  asignar(linea: number,motocicletaId: number): void {
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`,{motocicletaId}).subscribe({
      next: () => { this.candidatas.set([]); this.verUnidades(linea); this.mensaje.set('Unidad asignada.'); },
      error: err => this.error.set(apiError(err))
    });
  }

  private pedirMotivo(m: Motivo): void { this.motivo = ''; this.error.set(''); this.mensaje.set(''); this.motivoAbierto.set(m); }
  private terminarMotivo(texto: string): void { this.ocupado.set(false); this.motivoAbierto.set(null); this.mensaje.set(texto); }
  private enviarEstado(estado: string, motivo: string | null): void {
    this.ocupado.set(true); this.error.set('');
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/seguimiento`,{estado,motivo}).subscribe({
      next: () => { this.terminarMotivo('Estado actualizado.'); this.consultar(); },
      error: err => { this.ocupado.set(false); this.error.set(apiError(err)); }
    });
  }
}
