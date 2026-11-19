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

@Component({
  selector: 'app-fichas-page',
  imports: [FormsModule, DatePipe, RouterLink],
  template: `<div class="form-page">
    <div class="eyebrow">INVENTARIO DE MOTOCICLETAS</div><h1>{{modoDetalle() ? 'Ficha de motocicleta' : 'Nueva ficha de motocicleta'}}</h1>
    <p class="lead">Consulta la ficha seleccionada desde el inventario o registra una nueva motocicleta.</p>
    <p><a routerLink="/app/inventario">Volver al inventario</a> @if (modoDetalle() && auth.can('FICHAS_REGISTRAR')) { <a class="new-link" routerLink="/app/fichas" [queryParams]="{nuevo:1}">+ Agregar motocicleta</a> }</p>
    <div class="grid">
      @if (!modoDetalle() && auth.can('FICHAS_REGISTRAR')) {
      <section class="panel"><h2>Nueva ficha</h2><p class="hint">Datos contrastados con la guía y la DUA</p>
        <form (ngSubmit)="guardar()">
          <label for="llegadaId">ID de llegada</label><input id="llegadaId" name="llegadaId" type="number" min="1" step="1" required [(ngModel)]="form.llegadaId" [attr.aria-invalid]="fieldErrors()['llegadaId'] ? true : null" />
          @if (fieldErrors()['llegadaId']) { <small class="field-error">{{fieldErrors()['llegadaId']}}</small> }
          <div class="row"><div><label for="marca">Marca</label><input id="marca" name="marca" required maxlength="120" [(ngModel)]="form.marca" [attr.aria-invalid]="fieldErrors()['marca'] ? true : null" />
            @if (fieldErrors()['marca']) { <small class="field-error">{{fieldErrors()['marca']}}</small> }</div>
          <div><label for="modelo">Modelo</label><input id="modelo" name="modelo" required maxlength="120" [(ngModel)]="form.modelo" [attr.aria-invalid]="fieldErrors()['modelo'] ? true : null" />
            @if (fieldErrors()['modelo']) { <small class="field-error">{{fieldErrors()['modelo']}}</small> }</div></div>
          <div class="row"><div><label for="color">Color</label><input id="color" name="color" required maxlength="120" [(ngModel)]="form.color" [attr.aria-invalid]="fieldErrors()['color'] ? true : null" />
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
            <div class="row"><div><label for="editMarca">Marca</label><input id="editMarca" name="editMarca" required maxlength="120" [(ngModel)]="edicion.marca" /></div><div><label for="editModelo">Modelo</label><input id="editModelo" name="editModelo" required maxlength="120" [(ngModel)]="edicion.modelo" /></div></div>
            <div class="row"><div><label for="editColor">Color</label><input id="editColor" name="editColor" required maxlength="120" [(ngModel)]="edicion.color" /></div><div><label for="editChasis">Chasis completo</label><input id="editChasis" name="editChasis" required maxlength="120" [(ngModel)]="edicion.chasisCompleto" /></div></div>
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
    input[aria-invalid="true"]{border-color:#ca4b32}.new-link{display:inline-block;margin-left:20px}.edit-form{margin-top:22px}`]
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
  edicion = { marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  form = { llegadaId: null as number | null, marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  searchId: number | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      const llegadaId = Number(params.get('llegadaId'));
      this.modoDetalle.set(!params.has('nuevo') && Number.isSafeInteger(id) && id > 0);
      this.editando.set(false); this.editSuccess.set(false);
      if (Number.isSafeInteger(llegadaId) && llegadaId > 0) this.form.llegadaId = llegadaId;
      if (this.modoDetalle()) { this.searchId = id; this.buscar(); }
      else { this.found.set(null); this.searchId = null; }
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
    this.buscar();
  }

  buscar(): void {
    this.found.set(null); this.searchError.set('');
    if (!this.searchId || this.searchId < 1) { this.searchError.set('Ingresa un ID válido.'); return; }
    this.searchBusy.set(true);
    this.http.get<Ficha>(`/api/v1/motocicletas/${this.searchId}`).subscribe({
      next: value => { this.found.set(value); this.searchBusy.set(false); },
      error: err => { this.searchError.set(apiError(err)); this.searchBusy.set(false); }
    });
  }
}
