import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Ficha {
  id: number; llegadaId: number; marca: string; modelo: string; color: string;
  chasisCompleto: string; numeroMotor: string; dua: string; itemDua: string;
  creadorUsuario: string; creadoEn: string;
}
interface LlegadaOpcion { id: number; numeroGuia: string; fechaLlegada: string; receptorUsuario: string; cantidadDeclarada: number; cantidadRecibida: number }
interface PaginaLlegadas { items: LlegadaOpcion[]; pagina: number; totalPaginas: number; totalElementos: number }
interface DetalleLlegada { llegada: LlegadaOpcion; cantidadFichas: number; diferenciaInformativa: number }
interface OpcionMotocicleta { marca: string; modelo: string; color: string }

@Component({
  selector: 'app-fichas-page',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `<div class="form-page">
    <div class="eyebrow">INVENTARIO DE MOTOCICLETAS</div><h1>{{modoDetalle() ? 'Ficha de motocicleta' : 'Nueva ficha de motocicleta'}}</h1>
    <p class="lead">Registra cada motocicleta indicada en la guía de la llegada, con su chasis, motor y datos de la DUA. Desde inventario puedes abrir y editar una ficha existente.</p>
    <p><a routerLink="/app/inventario">Volver al inventario</a> @if (modoDetalle() && auth.can('FICHAS_REGISTRAR')) { <a class="new-link" routerLink="/app/fichas" [queryParams]="{nuevo:1}">+ Agregar motocicleta</a> }</p>
    <div class="grid">
      @if (!modoDetalle() && auth.can('FICHAS_REGISTRAR')) {
      <section class="panel"><h2>Registrar desde una guía</h2><p class="hint">Selecciona la guía registrada por Almacén. Revisa cada moto y guarda su ficha por separado.</p>
        <form (ngSubmit)="guardar()">
          <div class="guide-picker"><label for="guiaBusqueda">Guías de llegada</label><div class="guide-search"><input id="guiaBusqueda" name="guiaBusqueda" type="search" maxlength="120" [(ngModel)]="guiaBusqueda" (ngModelChange)="alCambiarGuia()" placeholder="Buscar por número de guía" /><button type="button" class="secondary" (click)="buscarLlegadas()">Buscar</button></div>
          @if (guiasBusy()) { <p class="hint">Cargando guías…</p> }
          @if (paginaLlegadas(); as pagina) { <div class="guide-list">
            @for (llegada of llegadas(); track llegada.id) { <button type="button" class="guide-option" [class.selected]="llegadaSeleccionada()?.id === llegada.id" (click)="seleccionarLlegada(llegada)"><span><strong>{{llegada.numeroGuia}}</strong><small>{{llegada.fechaLlegada | date:'dd/MM/yyyy'}} · {{llegada.receptorUsuario}}</small></span><span>{{llegada.cantidadRecibida}} motos · Elegir →</span></button> }
            @empty { <p class="hint">No hay guías para esta búsqueda.</p> }
          </div><div class="guide-pages"><span>{{pagina.totalElementos}} guías · Página {{pagina.pagina + 1}} de {{pagina.totalPaginas || 1}}</span>@if (pagina.totalPaginas > 1) { <button type="button" class="secondary" [disabled]="pagina.pagina === 0 || guiasBusy()" (click)="buscarLlegadas(pagina.pagina - 1)">Anterior</button><button type="button" class="secondary" [disabled]="pagina.pagina + 1 >= pagina.totalPaginas || guiasBusy()" (click)="buscarLlegadas(pagina.pagina + 1)">Siguiente</button> }</div> }
          @if (llegadaSeleccionada(); as llegada) { <div class="guide-summary"><strong>Guía {{llegada.numeroGuia}}</strong><span>{{llegada.cantidadDeclarada}} declaradas · {{llegada.cantidadRecibida}} recibidas · {{detalleLlegada()?.cantidadFichas ?? '…'}} fichas registradas</span><a routerLink="/app/llegadas" [queryParams]="{id:llegada.id}">Ver guía y sus fotos →</a></div> }
          </div>
          @if (fieldErrors()['llegadaId']) { <small class="field-error">{{fieldErrors()['llegadaId']}}</small> }
          <div class="row"><div><label for="marca">Marca</label><select id="marca" name="marca" required [(ngModel)]="form.marca" (ngModelChange)="form.modelo=''; form.color=''" [attr.aria-invalid]="fieldErrors()['marca'] ? true : null"><option value="">Selecciona marca</option>@for (marca of marcas(); track marca) { <option [value]="marca">{{marca}}</option> }</select>
            @if (fieldErrors()['marca']) { <small class="field-error">{{fieldErrors()['marca']}}</small> }</div>
          <div><label for="modelo">Modelo</label><select id="modelo" name="modelo" required [(ngModel)]="form.modelo" (ngModelChange)="form.color=''" [disabled]="!form.marca" [attr.aria-invalid]="fieldErrors()['modelo'] ? true : null"><option value="">Selecciona modelo</option>@for (modelo of modelos(form.marca); track modelo) { <option [value]="modelo">{{modelo}}</option> }</select>
            @if (fieldErrors()['modelo']) { <small class="field-error">{{fieldErrors()['modelo']}}</small> }</div></div>
          <div class="row"><div><label for="color">Color</label><select id="color" name="color" required [(ngModel)]="form.color" [disabled]="!form.modelo" [attr.aria-invalid]="fieldErrors()['color'] ? true : null"><option value="">Selecciona color</option>@for (color of colores(form.marca,form.modelo); track color) { <option [value]="color">{{color}}</option> }</select>
            @if (fieldErrors()['color']) { <small class="field-error">{{fieldErrors()['color']}}</small> }</div>
          <div><label for="chasis">Chasis completo</label><input id="chasis" name="chasis" required maxlength="120" [(ngModel)]="form.chasisCompleto" [attr.aria-invalid]="fieldErrors()['chasisCompleto'] ? true : null" />
            @if (fieldErrors()['chasisCompleto']) { <small class="field-error">{{fieldErrors()['chasisCompleto']}}</small> }</div></div>
          <label for="motor">Número de motor</label><input id="motor" name="motor" required maxlength="120" [(ngModel)]="form.numeroMotor" [attr.aria-invalid]="fieldErrors()['numeroMotor'] ? true : null" />
          @if (fieldErrors()['numeroMotor']) { <small class="field-error">{{fieldErrors()['numeroMotor']}}</small> }
          <div class="row"><div><label for="dua">DUA</label><input id="dua" name="dua" required maxlength="120" [(ngModel)]="form.dua" [attr.aria-invalid]="fieldErrors()['dua'] ? true : null" />
            @if (fieldErrors()['dua']) { <small class="field-error">{{fieldErrors()['dua']}}</small> }</div>
          <div><label for="itemDua">Ítem DUA</label><input id="itemDua" name="itemDua" required maxlength="120" [(ngModel)]="form.itemDua" [attr.aria-invalid]="fieldErrors()['itemDua'] ? true : null" />
            @if (fieldErrors()['itemDua']) { <small class="field-error">{{fieldErrors()['itemDua']}}</small> }</div></div>
          @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
          @if (existingId(); as id) { <button class="secondary" type="button" (click)="verExistente(id)">Ver ficha existente #{{id}}</button> }
          <button [disabled]="busy()" type="submit">{{busy() ? 'Guardando…' : 'Registrar ficha'}}</button>
        </form>
        @if (created(); as ficha) { <p class="message success" role="status">Ficha #{{ficha.id}} registrada para el chasis {{ficha.chasisCompleto}}.</p> }
      </section>
      }
      @if (modoDetalle() && auth.can('INVENTARIO_CONSULTAR')) {
      <section class="panel"><h2>Datos de la motocicleta</h2>
        @if (searchError()) { <p class="message error" role="alert">{{searchError()}}</p> }
        @if (found(); as ficha) { <div class="detail">
          <div class="detail-row"><span>Ficha</span><strong>#{{ficha.id}}</strong></div>
          <div class="detail-row"><span>Llegada</span><strong>#{{ficha.llegadaId}}</strong></div>
          <div class="detail-row"><span>Motocicleta</span><strong>{{ficha.marca}} {{ficha.modelo}} · {{ficha.color}}</strong></div>
          <div class="detail-row"><span>Chasis</span><strong>{{ficha.chasisCompleto}}</strong></div>
          <div class="detail-row"><span>Motor</span><strong>{{ficha.numeroMotor}}</strong></div>
          <div class="detail-row"><span>DUA / Ítem</span><strong>{{ficha.dua}} / {{ficha.itemDua}}</strong></div>
          <div class="detail-row"><span>Registró</span><strong>{{ficha.creadorUsuario}}</strong></div>
          <div class="detail-row"><span>Fecha</span><strong>{{ficha.creadoEn | date:'dd/MM/yyyy, HH:mm'}}</strong></div>
        </div>
        @if (auth.can('FICHAS_EDITAR')) {
          @if (!editando()) { <button type="button" (click)="iniciarEdicion(ficha)">Editar ficha</button> }
          @else { <form (ngSubmit)="actualizar()" class="edit-form">
            <p class="hint">La llegada y la fecha de registro permanecen vinculadas a esta ficha.</p>
            <div class="row"><div><label for="editMarca">Marca</label><select id="editMarca" name="editMarca" required [(ngModel)]="edicion.marca" (ngModelChange)="edicion.modelo=''; edicion.color=''"><option value="">Selecciona marca</option>@for (marca of marcas(); track marca) { <option [value]="marca">{{marca}}</option> }</select></div><div><label for="editModelo">Modelo</label><select id="editModelo" name="editModelo" required [(ngModel)]="edicion.modelo" (ngModelChange)="edicion.color=''" [disabled]="!edicion.marca"><option value="">Selecciona modelo</option>@for (modelo of modelos(edicion.marca); track modelo) { <option [value]="modelo">{{modelo}}</option> }</select></div></div>
            <div class="row"><div><label for="editColor">Color</label><select id="editColor" name="editColor" required [(ngModel)]="edicion.color" [disabled]="!edicion.modelo"><option value="">Selecciona color</option>@for (color of colores(edicion.marca,edicion.modelo); track color) { <option [value]="color">{{color}}</option> }</select></div><div><label for="editChasis">Chasis completo</label><input id="editChasis" name="editChasis" required maxlength="120" [(ngModel)]="edicion.chasisCompleto" /></div></div>
            <label for="editMotor">Número de motor</label><input id="editMotor" name="editMotor" required maxlength="120" [(ngModel)]="edicion.numeroMotor" />
            <div class="row"><div><label for="editDua">DUA</label><input id="editDua" name="editDua" required maxlength="120" [(ngModel)]="edicion.dua" /></div><div><label for="editItem">Ítem DUA</label><input id="editItem" name="editItem" required maxlength="120" [(ngModel)]="edicion.itemDua" /></div></div>
            @if (editError()) { <p class="message error" role="alert">{{editError()}}</p> }
            <button type="submit" [disabled]="busy()">{{busy() ? 'Guardando...' : 'Guardar cambios'}}</button> <button type="button" class="secondary" (click)="editando.set(false)">Cancelar</button>
          </form> }
        }
        @if (editSuccess()) { <p class="message success" role="status">Cambios guardados.</p> }
        } @else { <div class="empty">{{searchBusy() ? 'Cargando ficha...' : 'No se pudo cargar la ficha.'}}</div> }
      </section>
      }
    </div></div>`,
  styles: [`.field-error{display:block;color:#aa3721;font-size:12px;margin:-12px 0 16px}
    input[aria-invalid="true"],select[aria-invalid="true"]{border-color:#ca4b32}.new-link{display:inline-block;margin-left:20px}.edit-form{margin-top:22px}
    .guide-picker{border:1px solid #dfe8f0;border-radius:12px;padding:16px;background:#f8fafc;margin-bottom:20px}.guide-search{display:flex;gap:8px}.guide-search input{flex:1;min-width:0}.guide-list{max-height:250px;overflow:auto;margin:12px 0}.guide-option{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:11px 12px;border:1px solid #e0e8ef;background:#fff;border-radius:8px;margin:5px 0;text-align:left;color:#193d61;cursor:pointer}.guide-option.selected{border-color:#193d61;background:#edf4fa}.guide-option span:first-child{display:grid;gap:3px}.guide-option small{font-size:11px;color:#718197}.guide-option span:last-child{font-size:12px;white-space:nowrap}.guide-pages{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:#718197}.guide-pages span{margin-right:auto}.guide-summary{display:grid;gap:5px;margin-top:12px;padding:13px;border-radius:9px;background:#eaf2f8;color:#193d61;font-size:13px}.guide-summary a{color:#193d61;font-weight:700}.guide-summary span{color:#536a80}@media(max-width:600px){.guide-option{align-items:start;flex-direction:column}.guide-search{flex-wrap:wrap}}`]
})
export class FichasPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly searchError = signal('');
  readonly created = signal<Ficha | null>(null);
  readonly existingId = signal<number | null>(null);
  readonly found = signal<Ficha | null>(null);
  readonly modoDetalle = signal(false);
  readonly editando = signal(false);
  readonly editError = signal('');
  readonly editSuccess = signal(false);
  readonly llegadas = signal<LlegadaOpcion[]>([]);
  readonly paginaLlegadas = signal<PaginaLlegadas | null>(null);
  readonly detalleLlegada = signal<DetalleLlegada | null>(null);
  readonly guiasBusy = signal(false);
  readonly llegadaSeleccionada = signal<LlegadaOpcion | null>(null);
  readonly opciones = signal<OpcionMotocicleta[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly catalogoError = signal('');
  guiaBusqueda = '';
  private temporizadorGuia?: ReturnType<typeof setTimeout>;
  private consultaGuias = 0;
  edicion = { marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  form = { llegadaId: null as number | null, marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  searchId: number | null = null;

  ngOnInit(): void {
    if (this.auth.can('FICHAS_REGISTRAR') || this.auth.can('FICHAS_EDITAR')) this.cargarCatalogo();
    if (this.auth.can('FICHAS_REGISTRAR') && this.auth.can('INVENTARIO_CONSULTAR')) this.buscarLlegadas();
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      const llegadaId = Number(params.get('llegadaId'));
      this.modoDetalle.set(!params.has('nuevo') && Number.isSafeInteger(id) && id > 0);
      this.editando.set(false); this.editSuccess.set(false);
      if (Number.isSafeInteger(llegadaId) && llegadaId > 0) {
        this.form.llegadaId = llegadaId;
        this.http.get<LlegadaOpcion>(`/api/v1/llegadas/${llegadaId}`).subscribe({
          next: llegada => this.seleccionarLlegada(llegada),
          error: err => this.error.set(apiError(err))
        });
      }
      if (this.modoDetalle()) { this.searchId = id; this.buscar(); }
      else { this.found.set(null); this.searchId = null; }
    });
  }

  cargarCatalogo(): void {
    this.http.get<OpcionMotocicleta[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => this.catalogoError.set(apiError(err))
    });
  }

  modelos(marca: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca).map(o => o.modelo))];
  }

  colores(marca: string, modelo: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca && o.modelo === modelo).map(o => o.color))];
  }

  alCambiarGuia(): void {
    clearTimeout(this.temporizadorGuia);
    this.llegadaSeleccionada.set(null);
    this.detalleLlegada.set(null);
    this.form.llegadaId = null;
    this.temporizadorGuia = setTimeout(() => this.buscarLlegadas(), 300);
  }

  buscarLlegadas(pagina = 0): void {
    clearTimeout(this.temporizadorGuia);
    const consulta = ++this.consultaGuias;
    this.guiasBusy.set(true);
    this.http.get<PaginaLlegadas>('/api/v1/llegadas/pagina',
      {params:{numeroGuia:this.guiaBusqueda.trim(),pagina}}).subscribe({
      next: resultado => { if (consulta !== this.consultaGuias) return;
        this.paginaLlegadas.set(resultado); this.llegadas.set(resultado.items); this.guiasBusy.set(false); },
      error: err => { if (consulta !== this.consultaGuias) return;
        this.error.set(apiError(err)); this.guiasBusy.set(false); }
    });
  }

  seleccionarLlegada(llegada: LlegadaOpcion): void {
    this.form.llegadaId = llegada.id; this.llegadaSeleccionada.set(llegada);
    this.guiaBusqueda = llegada.numeroGuia;
    this.detalleLlegada.set(null); this.error.set('');
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (this.form.llegadaId === llegada.id) this.detalleLlegada.set(detalle); },
      error: err => this.error.set(apiError(err))
    });
  }

  iniciarEdicion(ficha: Ficha): void {
    this.edicion = { marca: ficha.marca, modelo: ficha.modelo, color: ficha.color,
      chasisCompleto: ficha.chasisCompleto, numeroMotor: ficha.numeroMotor,
      dua: ficha.dua, itemDua: ficha.itemDua };
    this.editError.set(''); this.editSuccess.set(false); this.editando.set(true);
  }

  actualizar(): void {
    const ficha = this.found();
    if (!ficha || this.busy()) return;
    this.editError.set(''); this.editSuccess.set(false); this.busy.set(true);
    this.http.put<Ficha>(`/api/v1/motocicletas/${ficha.id}`, this.edicion).subscribe({
      next: actualizada => { this.found.set(actualizada); this.busy.set(false); this.editando.set(false); this.editSuccess.set(true); },
      error: err => { this.editError.set(apiError(err)); this.busy.set(false); }
    });
  }
  guardar(): void {
    this.created.set(null); this.error.set('');
    this.existingId.set(null);
    this.fieldErrors.set({});
    const mensajes: Record<string, string> = {
      marca: 'Ingresa la marca.', modelo: 'Ingresa el modelo.', color: 'Ingresa el color.',
      chasisCompleto: 'Ingresa el chasis completo.', numeroMotor: 'Ingresa el número de motor.',
      dua: 'Ingresa la DUA.', itemDua: 'Ingresa el ítem de DUA.'
    };
    const errores: Record<string, string> = {};
    if (!Number.isSafeInteger(this.form.llegadaId) || (this.form.llegadaId ?? 0) <= 0)
      errores['llegadaId'] = 'Selecciona una llegada válida.';
    for (const [campo, mensaje] of Object.entries(mensajes)) {
      if (!String(this.form[campo as keyof typeof this.form] ?? '').trim()) errores[campo] = mensaje;
    }
    if (Object.keys(errores).length) {
      this.fieldErrors.set(errores); this.error.set('Corrige los campos marcados.'); return;
    }
    this.busy.set(true);
    this.http.post<Ficha>('/api/v1/motocicletas', this.form).subscribe({
      next: value => { this.created.set(value); this.busy.set(false);
        this.form = {llegadaId:this.form.llegadaId, marca:'', modelo:'', color:'',
          chasisCompleto:'', numeroMotor:'', dua:'', itemDua:''};
        const llegada = this.llegadaSeleccionada();
        if (llegada) this.seleccionarLlegada(llegada);
      },
      error: err => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          const body = err.error as { fichaExistenteId?: number } | null;
          this.existingId.set(body?.fichaExistenteId ?? null);
          this.error.set('El chasis completo ya está registrado.');
        } else if (err instanceof HttpErrorResponse && err.status === 400) {
          const body = err.error as { errores?: Record<string, string> } | null;
          this.fieldErrors.set(body?.errores ?? {});
          this.error.set(body?.errores && Object.keys(body.errores).length
            ? 'Corrige los campos marcados.' : 'Revisa el formato de la ficha.');
        } else this.error.set(apiError(err));
        this.busy.set(false);
      }
    });
  }

  verExistente(id: number): void {
    this.searchId = id;
    this.modoDetalle.set(true);
    this.buscar();
  }

  buscar(): void {
    this.found.set(null); this.searchError.set('');
    if (!this.searchId || this.searchId < 1) { this.searchError.set('No se pudo identificar la ficha seleccionada.'); return; }
    this.searchBusy.set(true);
    this.http.get<Ficha>(`/api/v1/motocicletas/${this.searchId}`).subscribe({
      next: value => { this.found.set(value); this.searchBusy.set(false); },
      error: err => { this.searchError.set(apiError(err)); this.searchBusy.set(false); }
    });
  }
}
