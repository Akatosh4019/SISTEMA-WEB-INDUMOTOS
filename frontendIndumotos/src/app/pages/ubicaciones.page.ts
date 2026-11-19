import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Sede { id: number; codigo: string; nombre: string; tipo: string }
interface Movimiento { id: number; destinoId: number; destinoNombre: string; tipo: string; registrador: string; fecha: string }
interface Moto { id: number; marca: string; modelo: string; color: string; chasisVista: string }

@Component({
  selector: 'app-ubicaciones', imports: [FormsModule],
  template: `
    <h1>Ubicaciones de motocicletas</h1>
    <p>Busca una motocicleta por chasis para ver dónde está. Registra su primera ubicación o el traslado a otra sede cuando se mueva físicamente.</p>
    <section class="panel"><label>Chasis completo o últimos cuatro dígitos <input type="text" [(ngModel)]="chasis" maxlength="120"></label>
      <button type="button" (click)="buscarMotocicletas()" [disabled]="ocupado() || !chasis.trim()">Buscar motocicletas</button>
      @for (moto of coincidencias(); track moto.id) {
        <button type="button" (click)="seleccionar(moto)">{{moto.marca}} {{moto.modelo}} · {{moto.color}} · {{moto.chasisVista}}</button>
      }
      @if (seleccionada()) { <p>Motocicleta seleccionada: <strong>{{seleccionada()?.marca}} {{seleccionada()?.modelo}} · {{seleccionada()?.chasisVista}}</strong></p> }
      @if (actual()) { <p>Última ubicación: <strong>{{actual()?.destinoNombre}}</strong></p> }
      @for (movimiento of historial(); track movimiento.id) {
        <p>{{movimiento.tipo}} · {{movimiento.destinoNombre}} · {{movimiento.fecha}} · {{movimiento.registrador}}</p>
      }
      @if (historial().length === 0 && consultado()) { <p>Todavía no se ha registrado una ubicación.</p> }
    </section>
    @if (access.can('UBICACIONES_REGISTRAR') || access.can('TRASLADOS_REGISTRAR')) {
      <section class="panel"><h2>Registrar movimiento</h2>
        <label>Destino <select [(ngModel)]="destinoId"><option [ngValue]="0">Seleccione sede</option>
          @for (sede of sedes(); track sede.id) {
            @if (!actual() || sede.tipo === 'TIENDA' || sede.tipo === 'DESPACHO') {
              <option [ngValue]="sede.id">{{sede.nombre}} ({{sede.tipo}})</option>
            }
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
  styles: [`h1{color:#243347}.panel{background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:20px;margin:20px 0}label{display:grid;gap:8px;margin:12px 0}input,select{padding:9px;border:1px solid #ccd5df;border-radius:5px}button{padding:9px 12px;cursor:pointer;margin-right:10px}[role=alert]{color:#aa311e}[role=status]{color:#176744}`]
})
export class UbicacionesPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly sedes = signal<Sede[]>([]);
  readonly actual = signal<Movimiento | null>(null);
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

  constructor() {
    this.http.get<Sede[]>('/api/v1/ubicaciones').subscribe({next: sedes => this.sedes.set(sedes), error: err => this.error.set(apiError(err))});
  }
  buscarMotocicletas(): void {
    const chasis = this.chasis.trim();
    this.error.set(''); this.mensaje.set(''); this.seleccionada.set(null);
    this.motocicletaId = 0; this.actual.set(null); this.historial.set([]); this.consultado.set(false); this.coincidencias.set([]);
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
    this.actual.set(null); this.historial.set([]); this.consultado.set(false); this.error.set('');
    if (this.motocicletaId < 1) return;
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
