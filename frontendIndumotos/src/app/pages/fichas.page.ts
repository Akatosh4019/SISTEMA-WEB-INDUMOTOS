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
interface LlegadaOpcion { id: number; numeroGuia: string; fechaLlegada: string; receptorUsuario: string }
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
      <section class="panel"><h2>Nueva ficha</h2><p class="hint">Datos contrastados con la guía y la DUA</p>
        <form (ngSubmit)="guardar()">
          <label for="guiaBusqueda">Número de guía</label><input id="guiaBusqueda" name="guiaBusqueda" type="text" maxlength="120" [(ngModel)]="guiaBusqueda" />
          <button type="button" class="secondary" (click)="buscarLlegadas()">Buscar llegada</button>
          @for (llegada of llegadas(); track llegada.id) {
            <button type="button" class="secondary" (click)="seleccionarLlegada(llegada)">{{llegada.numeroGuia}} · {{llegada.fechaLlegada | date:'dd/MM/yyyy'}} · {{llegada.receptorUsuario}}</button>
          }
          @if (llegadaSeleccionada(); as llegada) { <p>Guía seleccionada: {{llegada.numeroGuia}}</p> }
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
      @if (auth.can('CATALOGO_GESTIONAR')) {
      <section class="panel"><h2>Catálogo de motocicletas</h2><p class="hint">¿Llegó una marca, modelo o color nuevo? Agrégalo aquí para que Inventarios pueda registrarlo y Comercial pueda solicitarlo.</p>
        <form (ngSubmit)="agregarOpcion()" class="edit-form">
          <div class="row"><div><label for="catalogoMarca">Marca</label><input id="catalogoMarca" name="catalogoMarca" required maxlength="120" [(ngModel)]="nuevaOpcion.marca" list="marcasExistentes" /><datalist id="marcasExistentes">@for (marca of marcas(); track marca) { <option [value]="marca"></option> }</datalist></div>
          <div><label for="catalogoModelo">Modelo</label><input id="catalogoModelo" name="catalogoModelo" required maxlength="120" [(ngModel)]="nuevaOpcion.modelo" /></div></div>
          <label for="catalogoColor">Color</label><input id="catalogoColor" name="catalogoColor" required maxlength="120" [(ngModel)]="nuevaOpcion.color" />
          @if (catalogoError()) { <p class="message error" role="alert">{{catalogoError()}}</p> }
          @if (catalogoMensaje()) { <p class="message success" role="status">{{catalogoMensaje()}}</p> }
          <button type="submit" [disabled]="catalogoBusy()">{{catalogoBusy() ? 'Guardando...' : 'Agregar al catálogo'}}</button>
        </form>
      </section>
      }
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
    input[aria-invalid="true"],select[aria-invalid="true"]{border-color:#ca4b32}.new-link{display:inline-block;margin-left:20px}.edit-form{margin-top:22px}`]
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
  readonly llegadaSeleccionada = signal<LlegadaOpcion | null>(null);
  readonly opciones = signal<OpcionMotocicleta[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly catalogoBusy = signal(false);
  readonly catalogoError = signal('');
  readonly catalogoMensaje = signal('');
  nuevaOpcion = {marca:'',modelo:'',color:''};
  guiaBusqueda = '';
  edicion = { marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  form = { llegadaId: null as number | null, marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  searchId: number | null = null;

  ngOnInit(): void {
    if (this.auth.can('FICHAS_REGISTRAR') || this.auth.can('FICHAS_EDITAR')) this.cargarCatalogo();
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      const llegadaId = Number(params.get('llegadaId'));
      this.modoDetalle.set(!params.has('nuevo') && Number.isSafeInteger(id) && id > 0);
      this.editando.set(false); this.editSuccess.set(false);
      if (Number.isSafeInteger(llegadaId) && llegadaId > 0) {
        this.form.llegadaId = llegadaId;
        this.http.get<LlegadaOpcion>(`/api/v1/llegadas/${llegadaId}`).subscribe({
          next: llegada => { this.llegadaSeleccionada.set(llegada); this.guiaBusqueda = llegada.numeroGuia; },
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

  agregarOpcion(): void {
    const marca=this.nuevaOpcion.marca.trim(), modelo=this.nuevaOpcion.modelo.trim(), color=this.nuevaOpcion.color.trim();
    if (!marca || !modelo || !color) { this.catalogoError.set('Completa marca, modelo y color.'); return; }
    this.catalogoBusy.set(true); this.catalogoError.set(''); this.catalogoMensaje.set('');
    this.http.post<OpcionMotocicleta>('/api/v1/catalogo-motocicletas',{marca,modelo,color}).subscribe({
      next: opcion => { this.opciones.update(actual => [...actual,opcion]);
        this.marcas.set([...new Set(this.opciones().map(o => o.marca))]);
        this.form.marca=opcion.marca; this.form.modelo=opcion.modelo; this.form.color=opcion.color;
        this.nuevaOpcion={marca:'',modelo:'',color:''}; this.catalogoBusy.set(false);
        this.catalogoMensaje.set('Combinación agregada. Ya puedes usarla en la ficha.'); },
      error: err => { this.catalogoError.set(apiError(err)); this.catalogoBusy.set(false); }
    });
  }

  buscarLlegadas(): void {
    const numeroGuia = this.guiaBusqueda.trim();
    this.llegadas.set([]); this.llegadaSeleccionada.set(null); this.form.llegadaId = null;
    if (!numeroGuia) { this.error.set('Ingresa el número de guía.'); return; }
    this.error.set('');
    this.http.get<LlegadaOpcion[]>('/api/v1/llegadas', {params:{numeroGuia}}).subscribe({
      next: llegadas => { this.llegadas.set(llegadas);
        if (!llegadas.length) this.error.set('No se encontraron llegadas para esa guía.'); },
      error: err => this.error.set(apiError(err))
    });
  }

  seleccionarLlegada(llegada: LlegadaOpcion): void {
    this.form.llegadaId = llegada.id; this.llegadaSeleccionada.set(llegada);
    this.guiaBusqueda = llegada.numeroGuia; this.llegadas.set([]); this.error.set('');
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
      next: value => { this.created.set(value); this.busy.set(false); },
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
