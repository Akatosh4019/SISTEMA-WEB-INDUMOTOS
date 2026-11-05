import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
        <form (ngSubmit)="guardar()" #f="ngForm">
          <label for="llegadaId">ID de llegada</label><input id="llegadaId" name="llegadaId" type="number" min="1" required [(ngModel)]="form.llegadaId" />
          <div class="row"><div><label for="marca">Marca</label><input id="marca" name="marca" required maxlength="120" [(ngModel)]="form.marca" /></div>
          <div><label for="modelo">Modelo</label><input id="modelo" name="modelo" required maxlength="120" [(ngModel)]="form.modelo" /></div></div>
          <div class="row"><div><label for="color">Color</label><input id="color" name="color" required maxlength="120" [(ngModel)]="form.color" /></div>
          <div><label for="chasis">Chasis completo</label><input id="chasis" name="chasis" required maxlength="120" [(ngModel)]="form.chasisCompleto" /></div></div>
          <label for="motor">Número de motor</label><input id="motor" name="motor" required maxlength="120" [(ngModel)]="form.numeroMotor" />
          <div class="row"><div><label for="dua">DUA</label><input id="dua" name="dua" required maxlength="120" [(ngModel)]="form.dua" /></div>
          <div><label for="itemDua">Ítem DUA</label><input id="itemDua" name="itemDua" required maxlength="120" [(ngModel)]="form.itemDua" /></div></div>
          @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
          <button [disabled]="busy() || !f.valid" type="submit">{{busy() ? 'Guardando…' : 'Registrar ficha'}}</button>
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
    </div></div>`
})
export class FichasPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
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
    if (!this.form.llegadaId || Object.entries(this.form).some(([k,v]) => k !== 'llegadaId' && !String(v).trim())) {
      this.error.set('Completa todos los campos de la ficha.'); return;
    }
    this.busy.set(true);
    this.http.post<Ficha>('/api/v1/motocicletas', this.form).subscribe({
      next: value => { this.created.set(value); this.busy.set(false); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
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
