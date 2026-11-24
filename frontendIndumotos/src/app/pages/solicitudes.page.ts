import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id?: number; marca: string; modelo: string; color: string; cantidad: number }
interface OpcionMotocicleta { marca: string; modelo: string; color: string }
interface Solicitud { id: number; estado: string; solicitante: string; destinoId: number; destinoNombre: string;
  creadaEn?: string; observacion?: string | null; lineas: Linea[] }
interface Evento { id: number; estado: string; fecha: string; registrador: string; motivo: string | null }
interface Edicion { id: number; editor: string; fecha: string; destinoAnterior: string;
  observacionAnterior: string | null; lineasAnteriores: string }
interface Sede { id: number; codigo: string; nombre: string; tipo: string }

const ESTADOS: Record<string, string> = { PENDIENTE: 'Pendiente', EN_PREPARACION: 'En preparación', ATENDIDA: 'Atendida',
  RECHAZADA: 'Rechazada', ANULADA: 'Anulada' };
const POR_PAGINA = 10;

@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule, DatePipe],
  template: `<div class="im-page">
    <header class="page-heading"><div><span class="eyebrow">OPERACIÓN COMERCIAL</span><h1>Solicitudes</h1>
      <p>Comercial pide modelos, colores y cantidades para su tienda. Almacén prepara las unidades y registra la salida; la tienda confirma la recepción en Seguimiento.</p></div>
      @if (access.can('SOLICITUDES_CREAR')) { <button type="button" class="im-btn" (click)="abrirFormulario(null)">+ Nueva solicitud</button> }</header>
    @if (confirmacion()) { <p class="im-alert ok" role="status">{{confirmacion()}}</p> }
    @if (error() && !formAbierto() && !anulando()) { <p class="im-alert error" role="alert">{{error()}}</p> }
    <section class="im-card">
      <div class="im-toolbar">
        <div class="im-search"><input type="search" aria-label="Buscar solicitudes" placeholder="Buscar por número, tienda, solicitante, marca, modelo o color" [(ngModel)]="busqueda" (ngModelChange)="alEscribir()" maxlength="120" /></div>
        <select aria-label="Filtrar por estado" [(ngModel)]="estado" (ngModelChange)="irPagina(0)">
          <option value="">Todos los estados</option>@for (e of estados; track e[0]) { <option [value]="e[0]">{{e[1]}}</option> }
        </select>
      </div>
      <div class="im-table-wrap"><table class="im-table">
        <thead><tr><th>N.°</th><th>Fecha</th><th>Tienda destino</th><th>Solicitante</th><th>Motos pedidas</th><th>Estado</th><th class="num">Acciones</th></tr></thead>
        <tbody>
          @for (s of solicitudes(); track s.id) {
            <tr><td><strong>#{{s.id}}</strong></td><td><span class="muted">{{s.creadaEn | date:'dd/MM/yyyy HH:mm'}}</span></td><td>{{s.destinoNombre}}</td><td>{{s.solicitante}}</td>
              <td>{{resumenLineas(s)}}</td>
              <td><span class="im-badge" [class.warn]="s.estado === 'PENDIENTE' || s.estado === 'EN_PREPARACION'" [class.ok]="s.estado === 'ATENDIDA'" [class.bad]="s.estado === 'RECHAZADA' || s.estado === 'ANULADA'">{{nombreEstado(s.estado)}}</span></td>
              <td><div class="actions"><button type="button" class="im-btn small light" (click)="ver(s)">Ver</button>
                @if (puedeEditar(s)) { <button type="button" class="im-btn small light" (click)="abrirFormulario(s)">Editar</button> }
                @if (access.can('SOLICITUDES_ANULAR') && s.estado === 'PENDIENTE') { <button type="button" class="im-btn small danger" (click)="pedirAnulacion(s)">Anular</button> }</div></td></tr>
          } @empty { <tr><td colspan="7" class="im-empty">{{cargando() ? 'Cargando solicitudes…' : 'No hay solicitudes que coincidan con la búsqueda.'}}</td></tr> }
        </tbody>
      </table></div>
      <div class="im-pager"><span>{{resumen()}}</span>
        @if (totalPaginas() > 1) { <div class="pages"><button type="button" class="im-btn small light" (click)="irPagina(pagina() - 1)" [disabled]="cargando() || pagina() === 0">Anterior</button><span>Página {{pagina() + 1}} de {{totalPaginas()}}</span><button type="button" class="im-btn small light" (click)="irPagina(pagina() + 1)" [disabled]="cargando() || pagina() + 1 >= totalPaginas()">Siguiente</button></div> }
      </div>
    </section>

    @if (formAbierto()) {
      <div class="im-overlay" (click)="cerrarFormulario()"><section class="im-dialog wide" role="dialog" aria-modal="true" aria-labelledby="form-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">{{editando() ? 'EDITAR SOLICITUD #' + editando()!.id : 'NUEVO PEDIDO'}}</span><h2 id="form-titulo">{{editando() ? 'Corregir solicitud pendiente' : 'Nueva solicitud'}}</h2></div><button type="button" class="im-dialog-close" (click)="cerrarFormulario()">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="guardar()">
          <p class="hint">Elige marca, modelo y color entre las combinaciones activas del catálogo.{{editando() ? ' Lo que se pidió antes quedará guardado en el historial.' : ''}}</p>
          <label>Tienda que recibe las motos<select required name="destino" [(ngModel)]="destinoId">
            <option [ngValue]="0">Selecciona una tienda</option>@for (sede of sedes(); track sede.id) { <option [ngValue]="sede.id">{{sede.nombre}}</option> }</select></label>
          @for (linea of lineas; track $index; let i = $index) {
            <div class="linea"><label>Marca<select required [name]="'marca'+i" [(ngModel)]="linea.marca" (ngModelChange)="linea.modelo=''; linea.color=''"><option value="">Marca</option>@for (marca of marcas(); track marca) { <option [value]="marca">{{marca}}</option> }</select></label>
              <label>Modelo<select required [name]="'modelo'+i" [(ngModel)]="linea.modelo" (ngModelChange)="linea.color=''" [disabled]="!linea.marca"><option value="">Modelo</option>@for (modelo of modelos(linea.marca); track modelo) { <option [value]="modelo">{{modelo}}</option> }</select></label>
              <label>Color<select required [name]="'color'+i" [(ngModel)]="linea.color" [disabled]="!linea.modelo"><option value="">Color</option>@for (color of colores(linea.marca,linea.modelo); track color) { <option [value]="color">{{color}}</option> }</select></label>
              <label>Cantidad<input type="number" min="1" required [name]="'cantidad'+i" [(ngModel)]="linea.cantidad"></label>
              <button class="im-btn light quitar" type="button" (click)="quitar(i)" [disabled]="lineas.length === 1" aria-label="Quitar línea">Quitar</button></div>
          }
          <button class="im-btn light add-line" type="button" (click)="agregar()">+ Agregar línea</button>
          <label>Observación <span class="hint">(opcional)</span><textarea name="observacion" maxlength="1000" [(ngModel)]="observacion"></textarea></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="cerrarFormulario()">Cancelar</button>
            <button type="submit" class="im-btn" [disabled]="guardando() || !destinoId">{{guardando() ? 'Guardando…' : editando() ? 'Guardar cambios' : 'Enviar solicitud'}}</button></div>
        </form>
      </section></div>
    }

    @if (detalle(); as d) {
      <div class="im-overlay" (click)="detalle.set(null)"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="det-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">SOLICITUD #{{d.id}}</span><h2 id="det-titulo">{{d.destinoNombre}} <span class="im-badge">{{nombreEstado(d.estado)}}</span></h2><small>Solicitada por {{d.solicitante}} · {{d.creadaEn | date:'dd/MM/yyyy HH:mm'}}</small></div><button type="button" class="im-dialog-close" (click)="detalle.set(null)">Cerrar</button></div>
        <div class="im-table-wrap"><table class="im-table"><thead><tr><th>Marca</th><th>Modelo</th><th>Color</th><th class="num">Cantidad</th></tr></thead><tbody>
          @for (l of d.lineas; track $index) { <tr><td>{{l.marca}}</td><td>{{l.modelo}}</td><td>{{l.color}}</td><td class="num">{{l.cantidad}}</td></tr> }
        </tbody></table></div>
        @if (d.observacion) { <p class="obs"><strong>Observación:</strong> {{d.observacion}}</p> }
        <h3>Historial de estados</h3>
        <ol class="im-timeline">
          @for (e of eventos(); track e.id) { <li [class.ok]="e.estado === 'ATENDIDA'" [class.bad]="e.estado === 'RECHAZADA' || e.estado === 'ANULADA'" [class.warn]="e.estado === 'EN_PREPARACION'">
            <strong>{{nombreEstado(e.estado)}}</strong><span class="when">{{e.fecha | date:'dd/MM/yyyy HH:mm'}} · {{e.registrador}}</span>@if (e.motivo) { <p>{{e.motivo}}</p> }</li> }
        </ol>
        @if (ediciones().length) {
          <h3>Ediciones</h3>
          <ol class="im-timeline">@for (x of ediciones(); track x.id) { <li><strong>Editada por {{x.editor}}</strong><span class="when">{{x.fecha | date:'dd/MM/yyyy HH:mm'}}</span>
            <p>Antes: {{x.lineasAnteriores}} → {{x.destinoAnterior}}@if (x.observacionAnterior) { · “{{x.observacionAnterior}}” }</p></li> }</ol>
        }
      </section></div>
    }

    @if (anulando(); as s) {
      <div class="im-overlay" (click)="cerrarAnulacion()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="anular-titulo" (click)="$event.stopPropagation()">
        <div class="im-dialog-header"><div><span class="eyebrow">MOTIVO OBLIGATORIO</span><h2 id="anular-titulo">Anular solicitud #{{s.id}}</h2></div><button type="button" class="im-dialog-close" (click)="cerrarAnulacion()">Cerrar</button></div>
        <form class="im-form" (ngSubmit)="anular()">
          <p class="hint">La solicitud no se borra: queda registrada como anulada, con su motivo, para conservar el historial.</p>
          <label>Motivo<textarea name="motivo" maxlength="1000" required [(ngModel)]="motivo"></textarea></label>
          @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
          <div class="im-dialog-actions"><button type="button" class="im-btn light" (click)="cerrarAnulacion()">Cancelar</button><button type="submit" class="im-btn danger" [disabled]="guardando() || !motivo.trim()">Anular solicitud</button></div>
        </form>
      </section></div>
    }
  </div>`,
  styles: [`.muted{color:#7d8fa3;font-size:12px}.wide{width:min(940px,100%)}.linea{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 100px auto;gap:10px;align-items:end;padding:14px;background:#f6f9fc;border:1px solid #e5edf4;border-radius:12px}.add-line{justify-self:start}h3{font-size:15px;margin:20px 0 10px}.obs{background:#f6f9fc;border-radius:9px;padding:10px 12px;margin:14px 0 0;color:#33475c}@media(max-width:850px){.linea{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.linea{grid-template-columns:1fr}}`]
})
export class SolicitudesPage implements OnInit {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly estados = Object.entries(ESTADOS);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly sedes = signal<Sede[]>([]);
  readonly opciones = signal<OpcionMotocicleta[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly confirmacion = signal('');
  readonly formAbierto = signal(false);
  readonly editando = signal<Solicitud | null>(null);
  readonly detalle = signal<Solicitud | null>(null);
  readonly eventos = signal<Evento[]>([]);
  readonly ediciones = signal<Edicion[]>([]);
  readonly anulando = signal<Solicitud | null>(null);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  readonly resumen = computed(() => {
    if (!this.total()) return 'Sin resultados';
    const desde = this.pagina() * POR_PAGINA + 1;
    return `Mostrando ${desde}–${Math.min(desde + POR_PAGINA - 1, this.total())} de ${this.total()} solicitudes`;
  });
  busqueda = '';
  estado = '';
  destinoId = 0;
  observacion = '';
  motivo = '';
  lineas: Linea[] = [{marca:'',modelo:'',color:'',cantidad:1}];
  private temporizador?: ReturnType<typeof setTimeout>;
  private consulta = 0;
  private opcionesCargadas = false;

  ngOnInit(): void { this.cargar(); }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cerrarFormulario(); this.detalle.set(null); this.cerrarAnulacion(); }

  nombreEstado(estado: string): string { return ESTADOS[estado] ?? estado; }
  resumenLineas(s: Solicitud): string {
    const unidades = s.lineas.reduce((suma, l) => suma + l.cantidad, 0);
    const primera = s.lineas[0];
    if (!primera) return '—';
    return `${primera.marca} ${primera.modelo}${s.lineas.length > 1 ? ` y ${s.lineas.length - 1} más` : ''} · ${unidades} unid.`;
  }
  puedeEditar(s: Solicitud): boolean {
    return s.estado === 'PENDIENTE' && this.access.can('SOLICITUDES_CREAR') &&
      (s.solicitante.toLowerCase() === this.access.username().toLowerCase() || this.access.access()?.rolCodigo === 'ADMIN');
  }
  modelos(marca: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca).map(o => o.modelo))];
  }
  colores(marca: string, modelo: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca && o.modelo === modelo).map(o => o.color))];
  }
  agregar(): void { this.lineas.push({marca:'',modelo:'',color:'',cantidad:1}); }
  quitar(i: number): void { if (this.lineas.length > 1) this.lineas.splice(i,1); }

  alEscribir(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.irPagina(0), 300);
  }
  irPagina(pagina: number): void { if (pagina >= 0) { this.pagina.set(pagina); this.cargar(); } }
  cargar(): void {
    const consulta = ++this.consulta;
    this.cargando.set(true);
    let params = new HttpParams().set('pagina', this.pagina()).set('tamano', POR_PAGINA);
    if (this.busqueda.trim()) params = params.set('buscar', this.busqueda.trim());
    if (this.estado) params = params.set('estado', this.estado);
    this.http.get<Solicitud[]>('/api/v1/solicitudes', { params, observe: 'response' }).subscribe({
      next: respuesta => { if (consulta !== this.consulta) return;
        const datos = respuesta.body ?? [];
        this.solicitudes.set(datos);
        this.total.set(Number(respuesta.headers.get('X-Total-Count') ?? datos.length));
        this.cargando.set(false); },
      error: err => { if (consulta !== this.consulta) return; this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }

  abrirFormulario(s: Solicitud | null): void {
    this.error.set(''); this.confirmacion.set('');
    this.editando.set(s);
    this.destinoId = s?.destinoId ?? 0;
    this.observacion = s?.observacion ?? '';
    this.lineas = s ? s.lineas.map(l => ({marca:l.marca, modelo:l.modelo, color:l.color, cantidad:l.cantidad}))
      : [{marca:'',modelo:'',color:'',cantidad:1}];
    this.cargarOpciones();
    this.formAbierto.set(true);
  }
  cerrarFormulario(): void { if (!this.guardando()) { this.formAbierto.set(false); this.error.set(''); } }
  guardar(): void {
    if (!this.destinoId || this.lineas.some(l => !this.opciones().some(o => o.marca === l.marca && o.modelo === l.modelo && o.color === l.color) || !Number.isSafeInteger(l.cantidad) || l.cantidad < 1)) {
      this.error.set('Selecciona una tienda y una combinación válida de marca, modelo y color para cada línea.'); return;
    }
    if (this.guardando()) return;
    this.error.set(''); this.guardando.set(true);
    const datos = { destinoId:this.destinoId, observacion:this.observacion, lineas:this.lineas };
    const editada = this.editando();
    const peticion = editada ? this.http.put<Solicitud>(`/api/v1/solicitudes/${editada.id}`, datos)
      : this.http.post<Solicitud>('/api/v1/solicitudes', datos);
    peticion.subscribe({
      next: s => { this.guardando.set(false); this.formAbierto.set(false);
        this.confirmacion.set(editada ? `Solicitud #${s.id} actualizada.` : `Solicitud #${s.id} registrada.`);
        this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.guardando.set(false); }
    });
  }

  ver(s: Solicitud): void {
    this.detalle.set(s); this.eventos.set([]); this.ediciones.set([]);
    this.http.get<Evento[]>(`/api/v1/solicitudes/${s.id}/seguimiento`).subscribe({ next: e => this.eventos.set(e), error: () => {} });
    this.http.get<Edicion[]>(`/api/v1/solicitudes/${s.id}/ediciones`).subscribe({ next: e => this.ediciones.set(e), error: () => {} });
  }

  pedirAnulacion(s: Solicitud): void { this.motivo = ''; this.error.set(''); this.confirmacion.set(''); this.anulando.set(s); }
  cerrarAnulacion(): void { if (!this.guardando()) { this.anulando.set(null); this.error.set(''); } }
  anular(): void {
    const s = this.anulando();
    if (!s || !this.motivo.trim() || this.guardando()) return;
    this.guardando.set(true); this.error.set('');
    this.http.post(`/api/v1/solicitudes/${s.id}/anulacion`, { motivo: this.motivo.trim() }).subscribe({
      next: () => { this.guardando.set(false); this.anulando.set(null); this.confirmacion.set(`Solicitud #${s.id} anulada.`); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.guardando.set(false); }
    });
  }

  private cargarOpciones(): void {
    if (this.opcionesCargadas) return;
    this.opcionesCargadas = true;
    this.http.get<OpcionMotocicleta[]>('/api/v1/solicitudes/opciones-motocicleta').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => { this.opcionesCargadas = false; this.error.set(apiError(err)); }
    });
    this.http.get<Sede[]>('/api/v1/ubicaciones').subscribe({
      next: sedes => this.sedes.set(sedes.filter(sede => sede.tipo === 'TIENDA' && !sede.codigo?.startsWith('DEMO_'))),
      error: err => this.error.set(apiError(err))
    });
  }
}
