import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Ficha { id: number; llegadaId: number; marca: string; modelo: string; color: string;
  chasisCompleto: string; numeroMotor: string; dua: string; itemDua: string; creadorUsuario: string; creadoEn: string }
interface Opcion { marca: string; modelo: string; color: string }
interface Guia { id: number; numeroGuia: string }

@Component({
  selector: 'app-ficha-dialog', imports: [DatePipe, FormsModule, RouterLink],
  template: `<div class="im-overlay" (click)="cerrar.emit()"><section class="im-dialog" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo" (click)="$event.stopPropagation()">
    <header class="im-dialog-header"><div><span class="eyebrow">FICHA DE MOTOCICLETA</span><h2 id="ficha-titulo">{{ficha()?.marca}} {{ficha()?.modelo}}</h2></div><button type="button" class="im-dialog-close" aria-label="Cerrar ficha" (click)="cerrar.emit()">✕</button></header>
    @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
    @if (ficha(); as f) {
      @if (!editando()) { <div class="details">
        <div><span>Marca y modelo</span><strong>{{f.marca}} {{f.modelo}}</strong></div><div><span>Color</span><strong>{{f.color}}</strong></div>
        <div><span>Chasis</span><strong>{{f.chasisCompleto}}</strong></div><div><span>Motor</span><strong>{{f.numeroMotor}}</strong></div>
        <div><span>DUA / Ítem</span><strong>{{f.dua}} / {{f.itemDua}}</strong></div><div><span>Registró</span><strong>{{f.creadorUsuario}}</strong></div>
        <div><span>Fecha</span><strong>{{f.creadoEn | date:'dd/MM/yyyy, HH:mm'}}</strong></div>
        <div class="guide-detail"><span>Guía de llegada</span><strong>{{guia()?.numeroGuia || 'Consultando guía…'}}</strong>@if (guia()) { <a routerLink="/app/llegadas" [queryParams]="{id:f.llegadaId}" (click)="cerrar.emit()">Ver llegada y foto de la guía →</a> }</div>
      </div>
      @if (auth.can('FICHAS_EDITAR')) { <button type="button" (click)="editar()">Editar ficha</button> }
      } @else { <form (ngSubmit)="guardar()" #formulario="ngForm">
        <div class="fields"><label>Marca<select name="marca" required [(ngModel)]="cambios.marca" (ngModelChange)="cambios.modelo='';cambios.color=''"><option value="">Selecciona marca</option>@for (marca of marcas(); track marca) { <option [value]="marca">{{marca}}</option> }</select></label>
        <label>Modelo<select name="modelo" required [(ngModel)]="cambios.modelo" (ngModelChange)="cambios.color=''" [disabled]="!cambios.marca"><option value="">Selecciona modelo</option>@for (modelo of modelos(cambios.marca); track modelo) { <option [value]="modelo">{{modelo}}</option> }</select></label>
        <label>Color<select name="color" required [(ngModel)]="cambios.color" [disabled]="!cambios.modelo"><option value="">Selecciona color</option>@for (color of colores(cambios.marca,cambios.modelo); track color) { <option [value]="color">{{color}}</option> }</select></label>
        <label>Chasis completo<input name="chasis" required maxlength="120" [(ngModel)]="cambios.chasisCompleto" /></label>
        <label>Número de motor<input name="motor" required maxlength="120" [(ngModel)]="cambios.numeroMotor" /></label>
        <label>DUA<input name="dua" required maxlength="120" [(ngModel)]="cambios.dua" /></label>
        <label>Ítem DUA<input name="item" required maxlength="120" [(ngModel)]="cambios.itemDua" /></label></div>
        <div class="actions"><button type="submit" [disabled]="busy() || !formulario.valid">{{busy() ? 'Guardando...' : 'Guardar cambios'}}</button><button class="secondary" type="button" (click)="editando.set(false)">Cancelar</button></div>
      </form> }
    } @else { <p>Cargando ficha...</p> }
  </section></div>`,
  styles: [`.overlay{position:fixed;inset:0;z-index:1000;background:rgba(10,24,40,.7);backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px}.dialog{background:var(--im-panel);border-radius:18px;width:min(760px,100%);max-height:90vh;overflow:auto;padding:28px;box-shadow:0 28px 80px #0005;color:var(--im-ink)}.dialog header{display:flex;justify-content:space-between;align-items:start;gap:16px;border-bottom:1px solid var(--im-border);padding-bottom:18px;margin-bottom:18px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;color:var(--im-accent)}h2{margin:6px 0 0}.close{background:var(--im-soft);color:var(--im-accent)}.details{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}.details div{display:grid;gap:5px;background:var(--im-soft);padding:13px;border-radius:9px;min-width:0}.details span{color:var(--im-muted);font-size:12px}.details strong{overflow-wrap:anywhere}.guide-detail a{color:var(--im-accent);font-size:12px;font-weight:800;text-decoration:none}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{display:grid;gap:6px;font-size:13px;font-weight:700}input,select{padding:11px;border:1px solid var(--im-border);border-radius:8px;font:inherit;min-width:0}.actions{display:flex;gap:10px;margin-top:18px}button{border:0;border-radius:8px;background:var(--im-primary);color:#fff;padding:11px 16px;font:inherit;font-weight:700;cursor:pointer}.secondary{background:var(--im-soft);color:var(--im-accent)}@media(max-width:600px){.dialog{padding:18px}.details,.fields{grid-template-columns:1fr}}`]
})
export class FichaDialogComponent implements OnChanges {
  @Input({required:true}) id!: number;
  @Output() cerrar = new EventEmitter<void>();
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly ficha = signal<Ficha | null>(null);
  readonly guia = signal<Guia | null>(null);
  readonly opciones = signal<Opcion[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly editando = signal(false);
  cambios = {marca:'',modelo:'',color:'',chasisCompleto:'',numeroMotor:'',dua:'',itemDua:''};
  ngOnChanges(): void {
    this.editando.set(false); this.ficha.set(null); this.guia.set(null); this.error.set('');
    this.http.get<Ficha>(`/api/v1/motocicletas/${this.id}`).subscribe({
      next: ficha => { this.ficha.set(ficha);
        this.http.get<Guia>(`/api/v1/llegadas/${ficha.llegadaId}`).subscribe({
          next: guia => this.guia.set(guia), error: err => this.error.set(apiError(err))
        });
      }, error: err => this.error.set(apiError(err))
    });
    if (this.auth.can('FICHAS_EDITAR')) this.http.get<Opcion[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => this.error.set(apiError(err))
    });
  }
  modelos(marca:string): string[] { return [...new Set(this.opciones().filter(o => o.marca===marca).map(o => o.modelo))]; }
  colores(marca:string,modelo:string): string[] { return [...new Set(this.opciones().filter(o => o.marca===marca && o.modelo===modelo).map(o => o.color))]; }
  editar(): void { const f=this.ficha(); if (!f) return; this.cambios={marca:f.marca,modelo:f.modelo,color:f.color,chasisCompleto:f.chasisCompleto,numeroMotor:f.numeroMotor,dua:f.dua,itemDua:f.itemDua}; this.editando.set(true); }
  guardar(): void { this.busy.set(true); this.error.set('');
    this.http.put<Ficha>(`/api/v1/motocicletas/${this.id}`,this.cambios).subscribe({
      next: ficha => { this.ficha.set(ficha); this.editando.set(false); this.busy.set(false); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
