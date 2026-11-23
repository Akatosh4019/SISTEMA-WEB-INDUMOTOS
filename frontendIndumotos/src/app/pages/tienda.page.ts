import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/api-error';

interface Tienda {id:number;nombre:string;disponibles:number;vendidas:number;}
interface Moto {id:number;chasis:string;marca:string;modelo:string;color:string;}
interface Venta {id:number;chasis:string;referenciaPago:string;referencia:string;importe:number;registrador:string;fecha:string;}
interface Pagina<T> {items:T[];pagina:number;totalElementos:number;}

@Component({selector:'app-tienda-page',imports:[FormsModule,DatePipe],
  template:`<div class="form-page mode-page"><span class="eyebrow">OPERACIÓN DE SEDE</span><h1>Modo tienda</h1>
    <p class="lead">Comercial consulta las motos y solicita reposición; Facturación registra la venta cuando comprueba el pago y la boleta o factura. El sistema no procesa el cobro.</p>
    @if(error()){<p class="message error" role="alert">{{error()}}</p>}
    @if(tienda();as t){<div class="store-hero"><div><small>TIENDA ASIGNADA</small><strong>{{t.nombre}}</strong></div><div><b>{{t.disponibles}}</b><small>Disponibles</small></div><div><b>{{t.vendidas}}</b><small>Vendidas</small></div></div>
      <section class="panel"><h2>Stock de esta tienda</h2><p class="hint">Solo incluye unidades confirmadas aquí, sin venta y fuera de tránsito.</p>
        <div class="table-wrap"><table><thead><tr><th>Moto</th><th>Color</th><th>Chasis</th><th></th></tr></thead><tbody>
          @for(m of stock()?.items ?? [];track m.id){<tr><td><strong>{{m.marca}} {{m.modelo}}</strong></td><td>{{m.color}}</td><td>{{m.chasis}}</td><td>@if(auth.can('VENTAS_REGISTRAR')){<button type="button" (click)="seleccionar(m)">Registrar venta</button>}</td></tr>}
          @empty{<tr><td colspan="4">No hay unidades disponibles en esta página.</td></tr>}</tbody></table></div>
        <div class="pager"><button type="button" class="tertiary" (click)="cargarStock(stockPagina()-1)" [disabled]="stockPagina()===0">Anterior</button><span>{{stock()?.totalElementos ?? 0}} unidades · Página {{stockPagina()+1}}</span><button type="button" class="tertiary" (click)="cargarStock(stockPagina()+1)" [disabled]="(stockPagina()+1)*10 >= (stock()?.totalElementos ?? 0)">Siguiente</button></div>
      </section><section class="panel"><h2>Ventas registradas</h2><p class="hint">Registro interno de ventas confirmadas por trabajadores de esta sede.</p>
        <div class="table-wrap"><table><thead><tr><th>Chasis</th><th>Pago</th><th>Comprobante</th><th>Importe</th><th>Registró</th><th>Fecha</th></tr></thead><tbody>
          @for(v of ventas()?.items ?? [];track v.id){<tr><td>{{v.chasis}}</td><td>{{v.referenciaPago || 'Sin referencia histórica'}}</td><td>{{v.referencia}}</td><td>S/ {{v.importe}}</td><td>{{v.registrador}}</td><td>{{v.fecha | date:'short'}}</td></tr>}
          @empty{<tr><td colspan="6">Todavía no hay ventas.</td></tr>}</tbody></table></div>
        <div class="pager"><button type="button" class="tertiary" (click)="cargarVentas(ventaPagina()-1)" [disabled]="ventaPagina()===0">Anterior</button><span>{{ventas()?.totalElementos ?? 0}} ventas · Página {{ventaPagina()+1}}</span><button type="button" class="tertiary" (click)="cargarVentas(ventaPagina()+1)" [disabled]="(ventaPagina()+1)*10 >= (ventas()?.totalElementos ?? 0)">Siguiente</button></div>
      </section>}
    @if(moto();as m){<div class="im-overlay" (click)="cerrar()"><section class="im-dialog sale-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-title" (click)="$event.stopPropagation()"><div class="im-dialog-header"><div><span class="eyebrow">CONFIRMAR VENTA</span><h2 id="sale-title">{{m.marca}} {{m.modelo}}</h2><small>Chasis {{m.chasis}}</small></div><button class="im-dialog-close" type="button" (click)="cerrar()">Cerrar</button></div>
      <p class="hint">Verifica que el pago se completó y que se emitió la boleta o factura. Una venta registrada no podrá volver a venderse.</p>
      <label for="pago">Referencia del pago confirmado</label><input id="pago" [(ngModel)]="referenciaPago" maxlength="100" />
      <label for="ref">Serie y número del comprobante</label><input id="ref" [(ngModel)]="referencia" maxlength="100" />
      <label for="importe">Importe (S/)</label><input id="importe" type="number" min="0.01" step="0.01" [(ngModel)]="importe" />
      @if(errorVenta()){<p class="message error" role="alert">{{errorVenta()}}</p>}
      <div class="dialog-actions"><button type="button" class="tertiary" (click)="cerrar()">Cancelar</button><button type="button" (click)="guardar()" [disabled]="busy() || !referenciaPago.trim() || !referencia.trim() || !importe || importe<=0">{{busy()?'Guardando…':'Confirmar venta'}}</button></div>
    </section></div>}
  </div>`,styleUrl:'./modos.page.css'})
export class TiendaPage implements OnInit {
  private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);readonly auth=inject(AuthService);
  readonly tienda=signal<Tienda|null>(null);readonly stock=signal<Pagina<Moto>|null>(null);readonly ventas=signal<Pagina<Venta>|null>(null);
  readonly stockPagina=signal(0);readonly ventaPagina=signal(0);readonly moto=signal<Moto|null>(null);
  readonly error=signal('');readonly errorVenta=signal('');readonly busy=signal(false);
  referenciaPago='';referencia='';importe:number|null=null;private tiendaId:number|null=null;
  ngOnInit():void {const id=Number(this.route.snapshot.queryParamMap.get('tiendaId'));this.tiendaId=id>0?id:null;this.cargar();}
  private params(p?:number):HttpParams {let q=new HttpParams();if(this.tiendaId)q=q.set('tiendaId',this.tiendaId);if(p!==undefined)q=q.set('pagina',p);return q;}
  cargar():void {this.http.get<Tienda>('/api/v1/modos/tienda',{params:this.params()}).subscribe({next:v=>this.tienda.set(v),error:e=>this.error.set(apiError(e))});this.cargarStock(0);this.cargarVentas(0);}
  cargarStock(p:number):void {if(p<0)return;this.http.get<Pagina<Moto>>('/api/v1/modos/tienda/stock',{params:this.params(p)}).subscribe({next:v=>{this.stock.set(v);this.stockPagina.set(p);},error:e=>this.error.set(apiError(e))});}
  cargarVentas(p:number):void {if(p<0)return;this.http.get<Pagina<Venta>>('/api/v1/modos/tienda/ventas',{params:this.params(p)}).subscribe({next:v=>{this.ventas.set(v);this.ventaPagina.set(p);},error:e=>this.error.set(apiError(e))});}
  seleccionar(m:Moto):void {this.moto.set(m);this.referenciaPago='';this.referencia='';this.importe=null;this.errorVenta.set('');}
  cerrar():void {if(!this.busy())this.moto.set(null);}
  guardar():void {const m=this.moto();if(!m||!this.referenciaPago.trim()||!this.referencia.trim()||!this.importe||this.importe<=0)return;this.busy.set(true);this.errorVenta.set('');
    this.http.post('/api/v1/modos/tienda/ventas',{motocicletaId:m.id,referenciaPago:this.referenciaPago.trim(),referenciaComprobante:this.referencia.trim(),importe:this.importe},{params:this.params()}).subscribe({
      next:()=>{this.busy.set(false);this.moto.set(null);this.cargar();},error:e=>{this.busy.set(false);this.errorVenta.set(apiError(e));}});}
}
