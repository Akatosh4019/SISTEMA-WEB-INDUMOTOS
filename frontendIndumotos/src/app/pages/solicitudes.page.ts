import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id?: number; marca: string; modelo: string; color: string; cantidad: number }
interface Solicitud { id: number; estado: string; solicitante: string; destinoId: number; lineas: Linea[] }

@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule],
  template: `
    <h1>Solicitudes</h1><p>Comercial solicita modelos, colores y cantidades para una sede. Logística prepara las unidades y registra el avance. Almacén registra el traslado a tienda o despacho cuando corresponde.</p>
    @if (access.can('SOLICITUDES_CREAR')) {
      <section class="panel"><h2>Nueva solicitud</h2><form (ngSubmit)="crear()">
        <label>Destino <select required name="destino" [(ngModel)]="destinoId">
          <option [ngValue]="0">Selecciona una sede</option>
          @for (sede of sedes(); track sede.id) { <option [ngValue]="sede.id">{{sede.nombre}}</option> }
        </select></label>
        @for (linea of lineas; track $index; let i = $index) {
          <div class="linea"><label>Marca <input required maxlength="120" [name]="'marca'+i" [(ngModel)]="linea.marca"></label>
            <label>Modelo <input required maxlength="120" [name]="'modelo'+i" [(ngModel)]="linea.modelo"></label>
            <label>Color <input required maxlength="120" [name]="'color'+i" [(ngModel)]="linea.color"></label>
            <label>Cantidad <input type="number" min="1" required [name]="'cantidad'+i" [(ngModel)]="linea.cantidad"></label>
            <button type="button" (click)="quitar(i)" [disabled]="lineas.length === 1">Quitar</button></div>
        }
        <button type="button" (click)="agregar()">Agregar línea</button>
        <label>Observación <textarea name="observacion" maxlength="1000" [(ngModel)]="observacion"></textarea></label>
        <button type="submit" [disabled]="guardando() || !destinoId">{{guardando() ? 'Guardando...' : 'Enviar solicitud'}}</button>
      </form></section>
    }
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (confirmacion()) { <p role="status">{{confirmacion()}}</p> }
    <section class="panel"><h2>Solicitudes registradas</h2>
      <button type="button" (click)="cargar()" [disabled]="cargando()">Actualizar</button>
      @if (cargando()) { <p>Cargando solicitudes...</p> }
      @for (solicitud of solicitudes(); track solicitud.id) {
        <details><summary>#{{solicitud.id}} — {{solicitud.estado}} — {{solicitud.solicitante}}</summary>
          <p>Destino #{{solicitud.destinoId}}</p><ul>
            @for (linea of solicitud.lineas; track linea.id) {
              <li>{{linea.marca}} {{linea.modelo}} · {{linea.color}} · {{linea.cantidad}} unidad(es)</li>
            }
          </ul></details>
      } @empty { @if (!cargando()) { <p>No hay solicitudes registradas.</p> } }
    </section>`,
  styles: [`h1{color:#243347}.panel{background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:20px;margin:20px 0}
    form{display:grid;gap:14px}label{display:grid;gap:5px}input,select,textarea{padding:9px;border:1px solid #ccd5df;border-radius:5px}
    .linea{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr)) auto;gap:8px;align-items:end}
    button{padding:9px 12px;cursor:pointer}details{padding:12px;border-bottom:1px solid #e5e9ee}
    [role=alert]{color:#aa311e}[role=status]{color:#176744}@media(max-width:760px){.linea{grid-template-columns:1fr 1fr}}`]
})
export class SolicitudesPage implements OnInit {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly solicitudes = signal<Solicitud[]>([]);
  readonly sedes = signal<{id:number; nombre:string}[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly confirmacion = signal('');
  destinoId = 0;
  observacion = '';
  lineas: Linea[] = [{marca:'',modelo:'',color:'',cantidad:1}];

  ngOnInit(): void {
    this.cargar();
    if (this.access.can('SOLICITUDES_CREAR')) {
      this.http.get<{id:number; nombre:string}[]>('/api/v1/ubicaciones').subscribe({
        next: sedes => this.sedes.set(sedes), error: err => this.error.set(apiError(err))
      });
    }
  }
  agregar(): void { this.lineas.push({marca:'',modelo:'',color:'',cantidad:1}); }
  quitar(i: number): void { if (this.lineas.length > 1) this.lineas.splice(i,1); }
  cargar(): void {
    this.cargando.set(true);
    this.http.get<Solicitud[]>('/api/v1/solicitudes').subscribe({
      next: datos => { this.solicitudes.set(datos); this.cargando.set(false); },
      error: err => { this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }
  crear(): void {
    if (!this.destinoId || this.lineas.some(l => !l.marca.trim() || !l.modelo.trim() || !l.color.trim() || l.cantidad < 1)) {
      this.error.set('Selecciona una sede y completa todas las líneas con cantidad positiva.'); return;
    }
    this.error.set(''); this.confirmacion.set(''); this.guardando.set(true);
    this.http.post<Solicitud>('/api/v1/solicitudes', { destinoId:this.destinoId, observacion:this.observacion, lineas:this.lineas })
      .subscribe({next: creada => {
        this.confirmacion.set(`Solicitud #${creada.id} registrada.`);
        this.lineas = [{marca:'',modelo:'',color:'',cantidad:1}]; this.observacion='';
        this.guardando.set(false); this.cargar();
      }, error: err => { this.error.set(apiError(err)); this.guardando.set(false); }});
  }
}
