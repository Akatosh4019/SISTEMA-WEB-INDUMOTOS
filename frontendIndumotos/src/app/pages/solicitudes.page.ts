import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id?: number; marca: string; modelo: string; color: string; cantidad: number }
interface Solicitud { id: number; estado: string; solicitante: string; destinoId: number; destinoNombre: string; lineas: Linea[] }

@Component({
  selector: 'app-solicitudes',
  imports: [FormsModule],
  template: `
    <header class="page-heading"><span class="eyebrow">OPERACIÓN COMERCIAL</span><h1>Solicitudes</h1><p>Comercial solicita modelos, colores y cantidades e indica la sede de destino. Almacén prepara las unidades, confirma la solicitud y registra el traslado a tienda o despacho cuando corresponde.</p></header>
    @if (access.can('SOLICITUDES_CREAR')) {
      <section class="panel"><div class="panel-heading"><span class="eyebrow">NUEVO PEDIDO</span><h2>Nueva solicitud</h2><p>Indica la sede que recibirá las motos y detalla cada modelo solicitado.</p></div><form (ngSubmit)="crear()">
        <label>Destino <select required name="destino" [(ngModel)]="destinoId">
          <option [ngValue]="0">Selecciona una sede</option>
          @for (sede of sedes(); track sede.id) { <option [ngValue]="sede.id">{{sede.nombre}}</option> }
        </select></label>
        @for (linea of lineas; track $index; let i = $index) {
          <div class="linea"><label>Marca <input required maxlength="120" [name]="'marca'+i" [(ngModel)]="linea.marca"></label>
            <label>Modelo <input required maxlength="120" [name]="'modelo'+i" [(ngModel)]="linea.modelo"></label>
            <label>Color <input required maxlength="120" [name]="'color'+i" [(ngModel)]="linea.color"></label>
            <label>Cantidad <input type="number" min="1" required [name]="'cantidad'+i" [(ngModel)]="linea.cantidad"></label>
            <button class="secondary" type="button" (click)="quitar(i)" [disabled]="lineas.length === 1">Quitar</button></div>
        }
        <button class="secondary add-line" type="button" (click)="agregar()">+ Agregar línea</button>
        <label>Observación <textarea name="observacion" maxlength="1000" [(ngModel)]="observacion"></textarea></label>
        <button type="submit" [disabled]="guardando() || !destinoId">{{guardando() ? 'Guardando...' : 'Enviar solicitud'}}</button>
      </form></section>
    }
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (confirmacion()) { <p role="status">{{confirmacion()}}</p> }
    <section class="panel"><div class="list-heading"><div><span class="eyebrow">CONSULTA</span><h2>Solicitudes registradas</h2></div>
      <button class="secondary" type="button" (click)="cargar()" [disabled]="cargando()">Actualizar</button></div>
      @if (cargando()) { <p>Cargando solicitudes...</p> }
      @for (solicitud of solicitudes(); track solicitud.id) {
        <details><summary><span class="request-title">{{solicitud.destinoNombre}}</span><span class="badge">{{solicitud.estado}}</span><span class="request-by">Solicitada por {{solicitud.solicitante}}</span></summary>
          <ul>
            @for (linea of solicitud.lineas; track linea.id) {
              <li>{{linea.marca}} {{linea.modelo}} · {{linea.color}} · {{linea.cantidad}} unidad(es)</li>
            }
          </ul></details>
      } @empty { @if (!cargando()) { <p>No hay solicitudes registradas.</p> } }
    </section>`,
  styles: [`:host{display:block;max-width:1120px;margin:auto;color:#102a49}.page-heading{margin:8px 0 26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:#173c64}h1{font-size:clamp(28px,3vw,38px);margin:8px 0}h2{font-size:21px;margin:5px 0}p{color:#627893;line-height:1.55}.page-heading p{max-width:760px;margin:0}.panel{background:#fff;border:1px solid #dfe7ef;border-radius:16px;padding:26px;margin:20px 0;box-shadow:0 10px 30px #1836560a}.panel-heading{padding-bottom:14px;border-bottom:1px solid #e6edf3}.panel-heading p{margin:4px 0 0}form{display:grid;gap:18px;margin-top:20px}label{display:grid;gap:7px;font-size:13px;font-weight:700}input,select,textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid #d4dfe9;border-radius:9px;background:#fff;color:#102a49;font:inherit}input:focus,select:focus,textarea:focus{outline:2px solid #93b9db;outline-offset:1px}textarea{min-height:86px;resize:vertical}.linea{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 110px auto;gap:12px;align-items:end;padding:16px;background:#f6f9fc;border:1px solid #e5edf4;border-radius:12px}button{border:0;border-radius:9px;background:#183d66;color:white;font:inherit;font-weight:700;padding:12px 16px;cursor:pointer}button:hover:not(:disabled){background:#245684}button:disabled{opacity:.55;cursor:not-allowed}.secondary{background:#eaf0f5;color:#173c64}.secondary:hover:not(:disabled){background:#dce7f0}.add-line{justify-self:start}.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}details{border-top:1px solid #e6edf3;padding:15px 4px}summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer}.request-title{font-weight:800}.request-by{margin-left:auto;color:#627893;font-size:13px}.badge{padding:5px 9px;background:#eaf1f8;color:#173c64;border-radius:999px;font-size:11px;font-weight:800}li{padding:5px 0}[role=alert],[role=status]{padding:12px 16px;border-radius:9px}[role=alert]{color:#9e332c;background:#fff0ee}[role=status]{color:#176744;background:#eaf8ee}@media(max-width:850px){.linea{grid-template-columns:repeat(2,minmax(0,1fr))}.request-by{margin-left:0}}@media(max-width:560px){.panel{padding:18px}.linea{grid-template-columns:1fr}.list-heading{align-items:flex-start}}`]
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
