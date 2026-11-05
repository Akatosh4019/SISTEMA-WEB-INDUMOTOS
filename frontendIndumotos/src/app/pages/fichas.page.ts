import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { apiError } from '../core/api-error';

interface Ficha {
  id: number; llegadaId: number; marca: string; modelo: string; color: string;
  chasisCompleto: string; numeroMotor: string; dua: string; itemDua: string;
  creadorUsuario: string; creadoEn: string;
}

@Component({
  selector: 'app-fichas-page',
  imports: [FormsModule, DatePipe],
  template: `<div class="form-page">
    <div class="eyebrow">INVENTARIO DE MOTOCICLETAS</div><h1>Fichas</h1>
    <p class="lead">Registra cada unidad vinculada a una llegada y consulta su ficha por ID.</p>
    <div class="grid">
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
          <button [disabled]="busy()" type="submit">{{busy() ? 'Guardando…' : 'Registrar ficha'}}</button>
        </form>
        @if (created(); as ficha) { <p class="message success" role="status">Ficha #{{ficha.id}} registrada para el chasis {{ficha.chasisCompleto}}.</p> }
      </section>
      <section class="panel"><h2>Consultar ficha</h2><p class="hint">Busca una unidad por el ID de su ficha</p>
        <form (ngSubmit)="buscar()"><label for="fichaId">ID de ficha</label><input id="fichaId" name="fichaId" type="number" min="1" [(ngModel)]="searchId" />
          <button class="secondary" type="submit" [disabled]="searchBusy()">{{searchBusy() ? 'Buscando…' : 'Buscar ficha'}}</button></form>
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
        </div> } @else { <div class="empty">Ingresa un ID para consultar la ficha.</div> }
      </section>
    </div></div>`,
  styles: [`.field-error{display:block;color:#aa3721;font-size:12px;margin:-12px 0 16px}
    input[aria-invalid="true"]{border-color:#ca4b32}`]
})
export class FichasPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly searchError = signal('');
  readonly created = signal<Ficha | null>(null);
  readonly found = signal<Ficha | null>(null);
  form = { llegadaId: null as number | null, marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  searchId: number | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    const llegadaId = Number(this.route.snapshot.queryParamMap.get('llegadaId'));
    if (Number.isSafeInteger(llegadaId) && llegadaId > 0) this.form.llegadaId = llegadaId;
    if (Number.isSafeInteger(id) && id > 0) {
      this.searchId = id;
      this.buscar();
    }
  }

  guardar(): void {
    this.created.set(null); this.error.set('');
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
        if (err instanceof HttpErrorResponse && err.status === 400) {
          const body = err.error as { errores?: Record<string, string> } | null;
          this.fieldErrors.set(body?.errores ?? {});
          this.error.set(body?.errores && Object.keys(body.errores).length
            ? 'Corrige los campos marcados.' : 'Revisa el formato de la ficha.');
        } else this.error.set(apiError(err));
        this.busy.set(false);
      }
    });
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
