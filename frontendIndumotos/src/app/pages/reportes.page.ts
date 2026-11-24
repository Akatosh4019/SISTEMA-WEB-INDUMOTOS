import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { apiError } from '../core/api-error';

type Periodo = 'SEMANA' | 'MES' | 'ANIO';
interface Modelo { marca: string; modelo: string; cantidad: number; importe: number }
interface Tienda { tienda: string; cantidad: number; importe: number }
interface Punto { fecha: string; cantidad: number }
interface Stock { marca: string; modelo: string; total: number; enAlmacen: number; enTienda: number; enCamino: number }
interface Reporte { periodo: Periodo; desde: string; hasta: string; unidadesVendidas: number; importeTotal: number;
  masVendidos: Modelo[]; menosVendidos: Modelo[]; porTienda: Tienda[]; serie: Punto[]; stock: Stock[] }

const PERIODOS: { codigo: Periodo; nombre: string }[] = [
  { codigo: 'SEMANA', nombre: 'Últimos 7 días' }, { codigo: 'MES', nombre: 'Últimos 30 días' }, { codigo: 'ANIO', nombre: 'Últimos 12 meses' }
];

@Component({
  selector: 'app-reportes', imports: [CurrencyPipe, DatePipe, DecimalPipe],
  template: `<div class="im-page">
    <header class="page-heading"><div><span class="eyebrow">ADMINISTRACIÓN · REPORTES</span><h1>Reportes de ventas y stock</h1>
      <p>Qué modelos se venden más y menos, cuánto se vendió en cada tienda y cuántas motos quedan por modelo. Se calcula con las ventas registradas por Facturación.</p></div></header>
    <nav class="im-tabs" aria-label="Periodo del reporte">
      @for (p of periodos; track p.codigo) { <button type="button" [class.active]="periodo() === p.codigo" (click)="cambiar(p.codigo)">{{p.nombre}}</button> }
    </nav>
    @if (error()) { <p class="im-alert error" role="alert">{{error()}}</p> }
    @if (cargando() && !reporte()) { <p class="im-alert info">Calculando reporte…</p> }
    @if (reporte(); as r) {
      <p class="rango">Del {{r.desde | date:'dd/MM/yyyy'}} al {{r.hasta | date:'dd/MM/yyyy'}}</p>
      <div class="kpis">
        <div class="kpi"><span>Motos vendidas</span><strong>{{r.unidadesVendidas | number}}</strong></div>
        <div class="kpi"><span>Importe vendido</span><strong>{{r.importeTotal | currency:'PEN':'S/ ':'1.0-0'}}</strong></div>
        <div class="kpi"><span>Precio promedio</span><strong>{{(r.unidadesVendidas ? r.importeTotal / r.unidadesVendidas : 0) | currency:'PEN':'S/ ':'1.0-0'}}</strong></div>
        <div class="kpi"><span>Motos en stock</span><strong>{{stockTotal() | number}}</strong></div>
      </div>

      <section class="im-card"><h2>Ventas {{periodo() === 'ANIO' ? 'por mes' : 'por día'}}</h2>
        <div class="chart" role="img" [attr.aria-label]="'Gráfico de ventas: ' + r.unidadesVendidas + ' motos en el periodo'">
          @for (p of r.serie; track p.fecha) {
            <div class="bar-col" [title]="etiqueta(p.fecha) + ': ' + p.cantidad + ' moto(s)'">
              <span class="bar-value">{{p.cantidad || ''}}</span>
              <div class="bar" [style.height.%]="p.cantidad ? (p.cantidad / maximo()) * 100 : 0"></div>
              <span class="bar-label">{{etiquetaCorta(p.fecha, $index)}}</span>
            </div>
          }
        </div>
      </section>

      <div class="two-col">
        <section class="im-card"><h2>Modelos más vendidos</h2>
          <div class="im-table-wrap"><table class="im-table compact"><thead><tr><th>Modelo</th><th class="num">Motos</th><th class="num">Importe</th></tr></thead><tbody>
            @for (m of r.masVendidos; track m.marca + m.modelo) { <tr><td><strong>{{m.marca}}</strong> {{m.modelo}}</td><td class="num">{{m.cantidad}}</td><td class="num">{{m.importe | currency:'PEN':'S/ ':'1.0-0'}}</td></tr> }
            @empty { <tr><td colspan="3" class="im-empty">Sin ventas en este periodo.</td></tr> }
          </tbody></table></div></section>
        <section class="im-card"><h2>Modelos menos vendidos</h2><p class="hint">Incluye modelos activos o con stock que no vendieron.</p>
          <div class="im-table-wrap"><table class="im-table compact"><thead><tr><th>Modelo</th><th class="num">Motos</th><th class="num">Importe</th></tr></thead><tbody>
            @for (m of r.menosVendidos; track m.marca + m.modelo) { <tr><td><strong>{{m.marca}}</strong> {{m.modelo}}</td><td class="num">{{m.cantidad}}</td><td class="num">{{m.importe | currency:'PEN':'S/ ':'1.0-0'}}</td></tr> }
            @empty { <tr><td colspan="3" class="im-empty">Sin modelos registrados.</td></tr> }
          </tbody></table></div></section>
      </div>

      <section class="im-card"><h2>Ventas por tienda</h2>
        <div class="im-table-wrap"><table class="im-table compact"><thead><tr><th>Tienda</th><th class="num">Motos</th><th class="num">Importe</th></tr></thead><tbody>
          @for (t of r.porTienda; track t.tienda) { <tr><td>{{t.tienda}}</td><td class="num">{{t.cantidad}}</td><td class="num">{{t.importe | currency:'PEN':'S/ ':'1.0-0'}}</td></tr> }
          @empty { <tr><td colspan="3" class="im-empty">Sin ventas en este periodo.</td></tr> }
        </tbody></table></div></section>

      <section class="im-card"><h2>Stock por modelo</h2><p class="hint">Motos que aún no se venden, según su ubicación confirmada.</p>
        <div class="im-table-wrap"><table class="im-table compact"><thead><tr><th>Modelo</th><th class="num">Total</th><th class="num">En almacén</th><th class="num">En tienda</th><th class="num">En camino</th></tr></thead><tbody>
          @for (s of r.stock; track s.marca + s.modelo) { <tr><td><strong>{{s.marca}}</strong> {{s.modelo}}</td><td class="num"><strong>{{s.total}}</strong></td><td class="num">{{s.enAlmacen}}</td><td class="num">{{s.enTienda}}</td><td class="num">{{s.enCamino}}</td></tr> }
          @empty { <tr><td colspan="5" class="im-empty">No hay motos en stock.</td></tr> }
        </tbody></table></div></section>
    }
  </div>`,
  styles: [`.rango{color:#627893;margin:-6px 0 16px;font-size:13px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.kpi{background:#fff;border:1px solid #dfe7ef;border-radius:14px;padding:16px 18px;display:grid;gap:6px;box-shadow:0 10px 30px #1836560a;position:relative;overflow:hidden}.kpi::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;background:#dce039;border-radius:0 3px 3px 0}.kpi span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7d8fa3;font-weight:700}.kpi strong{font-size:26px;color:#102a49;letter-spacing:-.02em}h2{font-size:18px;margin:0 0 12px}.hint{font-size:12px;color:#7d8fa3;margin:-6px 0 12px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}.two-col .im-card{margin-bottom:20px}.compact{min-width:0}.chart{display:flex;align-items:flex-end;gap:4px;height:220px;padding:8px 0 0;border-bottom:1px solid #e3eaf1}.bar-col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}.bar{width:100%;max-width:42px;min-height:2px;background:#183d66;border-radius:5px 5px 0 0;transition:height .3s}.bar-col:hover .bar{background:#245684}.bar-value{font-size:11px;font-weight:700;color:#33475c;min-height:14px}.bar-label{font-size:10px;color:#7d8fa3;height:14px;white-space:nowrap}@media(max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.two-col{grid-template-columns:1fr;gap:0}}@media(max-width:420px){.kpi strong{font-size:21px}}`]
})
export class ReportesPage {
  private readonly http = inject(HttpClient);
  readonly periodos = PERIODOS;
  readonly periodo = signal<Periodo>('MES');
  readonly reporte = signal<Reporte | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly maximo = computed(() => Math.max(1, ...(this.reporte()?.serie.map(p => p.cantidad) ?? [1])));
  readonly stockTotal = computed(() => (this.reporte()?.stock ?? []).reduce((suma, s) => suma + s.total, 0));
  private consulta = 0;

  constructor() { this.cargar(); }

  cambiar(periodo: Periodo): void { if (periodo !== this.periodo()) { this.periodo.set(periodo); this.cargar(); } }
  cargar(): void {
    const consulta = ++this.consulta;
    this.cargando.set(true); this.error.set('');
    this.http.get<Reporte>('/api/v1/reportes/ventas', { params: { periodo: this.periodo() } }).subscribe({
      next: r => { if (consulta !== this.consulta) return; this.reporte.set(r); this.cargando.set(false); },
      error: err => { if (consulta !== this.consulta) return; this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }
  etiqueta(fecha: string): string {
    const [a, m, d] = fecha.split('-');
    return this.periodo() === 'ANIO' ? `${MESES[Number(m) - 1]} ${a}` : `${d}/${m}`;
  }
  /** En 30 días se rotula uno de cada cinco para que las fechas no se encimen. */
  etiquetaCorta(fecha: string, indice: number): string {
    if (this.periodo() === 'MES' && indice % 5 !== 0) return '';
    const [, m, d] = fecha.split('-');
    return this.periodo() === 'ANIO' ? MESES[Number(m) - 1] : `${d}/${m}`;
  }
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
