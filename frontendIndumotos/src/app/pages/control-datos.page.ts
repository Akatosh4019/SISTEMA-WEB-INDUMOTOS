import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/api-error';

interface Moto {id:number;chasis:string;marca:string;modelo:string;color:string;ubicacion:string|null;estado:string;motivo:string;actualizadoEn:string|null;registradoPor:string|null;puedeOfrecerse:boolean;}
interface Evento {estado:string;motivo:string;registrador:string;fecha:string;}
interface Caso {id:number;motocicletaId:number;chasis:string;campo:string;valorObservado:string;descripcion:string;estado:string;reportante:string;reportadaEn:string;valorAnterior:string|null;valorCorregido:string|null;fuente:string|null;resolucion:string|null;resolutor:string|null;resueltaEn:string|null;}
interface Pagina<T>{items:T[];pagina:number;totalElementos:number;}
const campos=[{id:'marca',nombre:'Marca'},{id:'modelo',nombre:'Modelo'},{id:'color',nombre:'Color'},
  {id:'chasisCompleto',nombre:'Chasis completo'},{id:'numeroMotor',nombre:'Número de motor'},
  {id:'dua',nombre:'DUA'},{id:'itemDua',nombre:'Ítem DUA'}];

@Component({selector:'app-control-datos-page',imports:[FormsModule,DatePipe],
  template:`<div class="form-page control-page"><h2>Disponibilidad y diferencias</h2>
    <p class="lead">Busca una moto por chasis. Facturación registra diferencias o bloqueos; Inventarios investiga y corrige.</p>
    <section class="panel"><h2>Buscar motocicleta</h2><p class="hint">Escribe al menos cuatro caracteres del chasis. El resultado muestra su estado y ubicación confirmada.</p>
      <label for="buscarChasis">Chasis<input id="buscarChasis" [(ngModel)]="chasis" (ngModelChange)="buscarCambio()" placeholder="Chasis completo o fragmento" maxlength="120" /></label>
      @if(errorBusqueda()){<p class="message error" role="alert">{{errorBusqueda()}}</p>}
      @if(resultados();as lista){<div class="table-wrap"><table><thead><tr><th>Motocicleta</th><th>Chasis</th><th>Ubicación</th><th>Disponibilidad</th><th></th></tr></thead><tbody>
        @for(m of lista.items;track m.id){<tr><td><strong>{{m.marca}} {{m.modelo}}</strong><small>{{m.color}}</small></td><td>{{m.chasis}}</td><td>{{m.ubicacion || 'Sin confirmar'}}</td><td><span class="status" [class.blocked]="!m.puedeOfrecerse">{{m.estado}}</span><small class="offer" [class.no]="!m.puedeOfrecerse">{{m.puedeOfrecerse ? 'Se puede ofrecer' : 'No ofrecer'}}</small></td><td><button type="button" class="tertiary" (click)="abrir(m)">Ver</button></td></tr>}
        @empty{<tr><td colspan="5">No se encontraron motos.</td></tr>}</tbody></table></div>
        <div class="pager"><button type="button" class="tertiary" (click)="buscar(paginaBusqueda()-1)" [disabled]="paginaBusqueda()===0">Anterior</button><span>{{lista.totalElementos}} resultados · Página {{paginaBusqueda()+1}}</span><button type="button" class="tertiary" (click)="buscar(paginaBusqueda()+1)" [disabled]="(paginaBusqueda()+1)*10>=lista.totalElementos">Siguiente</button></div>}
    </section>
    @if(auth.can('DIFERENCIAS_CONSULTAR')){<section class="panel"><div class="section-head"><div><h2>Diferencias de datos</h2><p class="hint">Los casos pendientes llegan a Inventarios. Quien reportó puede ver el resultado.</p></div><select aria-label="Filtrar casos" [(ngModel)]="filtroCasos" (ngModelChange)="cargarCasos(0)"><option value="PENDIENTE">Pendientes</option><option value="RESUELTA">Resueltas</option><option value="TODAS">Todas</option></select></div>
      @if(errorCasos()){<p class="message error" role="alert">{{errorCasos()}}</p>}
      <div class="table-wrap"><table><thead><tr><th>Chasis</th><th>Campo</th><th>Observación</th><th>Estado</th><th></th></tr></thead><tbody>
        @for(c of casos()?.items ?? [];track c.id){<tr><td>{{c.chasis}}</td><td>{{nombreCampo(c.campo)}}</td><td>{{c.descripcion}}</td><td><span class="status" [class.blocked]="c.estado==='PENDIENTE'">{{c.estado}}</span></td><td><button type="button" class="tertiary" (click)="abrirCaso(c)">Ver</button></td></tr>}
        @empty{<tr><td colspan="5">No hay casos en este estado.</td></tr>}</tbody></table></div>
      <div class="pager"><button type="button" class="tertiary" (click)="cargarCasos(paginaCasos()-1)" [disabled]="paginaCasos()===0">Anterior</button><span>{{casos()?.totalElementos ?? 0}} casos · Página {{paginaCasos()+1}}</span><button type="button" class="tertiary" (click)="cargarCasos(paginaCasos()+1)" [disabled]="(paginaCasos()+1)*10 >= (casos()?.totalElementos ?? 0)">Siguiente</button></div>
    </section>}
    @if(moto();as m){<div class="im-overlay" (click)="cerrarMoto()"><section class="im-dialog control-dialog" role="dialog" aria-modal="true" aria-labelledby="moto-title" (click)="$event.stopPropagation()"><div class="im-dialog-header"><div><span class="eyebrow">FICHA Y ESTADO</span><h2 id="moto-title">{{m.marca}} {{m.modelo}}</h2><small>{{m.chasis}} · {{m.color}}</small></div><button type="button" class="im-dialog-close" (click)="cerrarMoto()">Cerrar</button></div>
      <div class="detail-grid"><div><span>Estado actual</span><strong>{{m.estado}}</strong></div><div><span>Ubicación</span><strong>{{m.ubicacion || 'Sin confirmar'}}</strong></div><div><span>Último cambio</span><strong>{{m.actualizadoEn ? (m.actualizadoEn | date:'short') : 'Sin fecha registrada'}}</strong></div><div><span>Registrado por</span><strong>{{m.registradoPor || 'Sin responsable registrado'}}</strong></div><div><span>¿Se puede ofrecer?</span><strong class="offer" [class.no]="!m.puedeOfrecerse">{{m.puedeOfrecerse ? 'Sí, está disponible para la venta' : 'No, revisa el motivo antes de ofrecerla'}}</strong></div><div class="wide"><span>Motivo o fuente</span><strong>{{m.motivo}}</strong></div></div>
      @if(m.estado==='EN_REVISION'){<p class="hint">Hay una diferencia de datos pendiente. La moto no se puede vender ni habilitar hasta resolver el caso.</p>}
      @if(auth.can('DISPONIBILIDAD_CAMBIAR') && m.estado!=='VENDIDA' && m.estado!=='EN_TRANSITO'){<div class="control-form"><h3>Cambiar disponibilidad</h3><p class="hint">Indica el motivo y la fuente antes de confirmar el cambio.</p><select [(ngModel)]="nuevoEstado"><option value="BLOQUEADA">Bloquear temporalmente</option><option value="HABILITADA">Habilitar</option></select><textarea [(ngModel)]="motivo" maxlength="500" placeholder="Motivo y fuente del cambio"></textarea><button type="button" (click)="guardarEstado()" [disabled]="busy() || !motivo.trim()">Guardar estado</button></div>}
      @if(auth.can('DIFERENCIAS_REPORTAR')){<div class="control-form"><h3>Reportar diferencia</h3><p class="hint">Indica qué dato no coincide con la guía, DUA, moto física o comprobante.</p><select [(ngModel)]="campoReporte">@for(c of campos;track c.id){<option [value]="c.id">{{c.nombre}}</option>}</select><input [(ngModel)]="valorObservado" maxlength="300" placeholder="Valor observado" /><textarea [(ngModel)]="descripcion" maxlength="1000" placeholder="Describe la diferencia y dónde la encontraste"></textarea><button type="button" (click)="reportar()" [disabled]="busy() || !valorObservado.trim() || !descripcion.trim()">Enviar a Inventarios</button></div>}
      <h3>Historial de disponibilidad</h3><div class="event-list">@for(e of eventos();track e.fecha){<p><strong>{{e.estado}}</strong> · {{e.motivo}}<small>{{e.registrador}} · {{e.fecha | date:'short'}}</small></p>}@empty{<p>Sin cambios manuales registrados.</p>}</div>
      @if(errorDetalle()){<p class="message error" role="alert">{{errorDetalle()}}</p>}
    </section></div>}
    @if(caso();as c){<div class="im-overlay" (click)="cerrarCaso()"><section class="im-dialog control-dialog" role="dialog" aria-modal="true" aria-labelledby="caso-title" (click)="$event.stopPropagation()"><div class="im-dialog-header"><div><span class="eyebrow">CASO DE DIFERENCIA</span><h2 id="caso-title">{{c.chasis}}</h2><small>{{nombreCampo(c.campo)}} · {{c.estado}}</small></div><button class="im-dialog-close" type="button" (click)="cerrarCaso()">Cerrar</button></div>
      <div class="detail-grid"><div><span>Reportó</span><strong>{{c.reportante}}</strong></div><div><span>Fecha</span><strong>{{c.reportadaEn | date:'short'}}</strong></div><div><span>Valor observado</span><strong>{{c.valorObservado}}</strong></div><div class="wide"><span>Descripción</span><strong>{{c.descripcion}}</strong></div></div>
      @if(c.estado==='RESUELTA'){<div class="resolution"><h3>Resolución</h3><p>Antes: {{c.valorAnterior}} · Corregido: {{c.valorCorregido}}</p><p>Fuente: {{c.fuente}}</p><p>{{c.resolucion}} · {{c.resolutor}} · {{c.resueltaEn | date:'short'}}</p></div>}
      @if(c.estado==='PENDIENTE' && auth.can('DIFERENCIAS_RESOLVER')){<div class="control-form"><h3>Resolver caso</h3><p class="hint">Contrasta con la fuente antes de actualizar la ficha. La corrección y el cierre se guardan juntos.</p><input [(ngModel)]="valorCorregido" maxlength="300" placeholder="Valor correcto" /><input [(ngModel)]="fuente" maxlength="500" placeholder="Fuente contrastada: guía, DUA o físico" /><textarea [(ngModel)]="resolucion" maxlength="1000" placeholder="Explica la investigación y corrección"></textarea><button type="button" (click)="resolver()" [disabled]="busy() || !valorCorregido.trim() || !fuente.trim() || !resolucion.trim()">Guardar resolución</button></div>}
      @if(errorDetalle()){<p class="message error" role="alert">{{errorDetalle()}}</p>}
    </section></div>}
  </div>`,styleUrl:'./control-datos.page.css'})
export class ControlDatosPage implements OnInit {
  private readonly http=inject(HttpClient);private readonly destroyRef=inject(DestroyRef);
  readonly auth=inject(AuthService);readonly campos=campos;
  readonly resultados=signal<Pagina<Moto>|null>(null);readonly casos=signal<Pagina<Caso>|null>(null);
  readonly moto=signal<Moto|null>(null);readonly caso=signal<Caso|null>(null);readonly eventos=signal<Evento[]>([]);
  readonly paginaBusqueda=signal(0);readonly paginaCasos=signal(0);readonly busy=signal(false);
  readonly errorBusqueda=signal('');readonly errorCasos=signal('');readonly errorDetalle=signal('');
  private readonly busqueda=new Subject<string>();
  chasis='';filtroCasos='PENDIENTE';nuevoEstado='BLOQUEADA';motivo='';campoReporte='chasisCompleto';valorObservado='';descripcion='';valorCorregido='';fuente='';resolucion='';
  ngOnInit():void {this.busqueda.pipe(debounceTime(260),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.buscar(0));if(this.auth.can('DIFERENCIAS_CONSULTAR'))this.cargarCasos(0);}
  buscarCambio():void {if(this.chasis.trim().length<4){this.resultados.set(null);this.errorBusqueda.set('');return;}this.busqueda.next(this.chasis);}
  buscar(p:number):void {if(p<0 || this.chasis.trim().length<4)return;this.http.get<Pagina<Moto>>('/api/v1/disponibilidad',{params:{chasis:this.chasis.trim(),pagina:p}}).subscribe({next:v=>{this.resultados.set(v);this.paginaBusqueda.set(p);this.errorBusqueda.set('');},error:e=>this.errorBusqueda.set(apiError(e))});}
  cargarCasos(p:number):void {if(p<0)return;this.http.get<Pagina<Caso>>('/api/v1/diferencias',{params:{estado:this.filtroCasos,pagina:p}}).subscribe({next:v=>{this.casos.set(v);this.paginaCasos.set(p);this.errorCasos.set('');},error:e=>this.errorCasos.set(apiError(e))});}
  nombreCampo(id:string):string{return campos.find(c=>c.id===id)?.nombre ?? id;}
  abrir(m:Moto):void {this.moto.set(m);this.errorDetalle.set('');this.motivo='';this.valorObservado='';this.descripcion='';this.http.get<Evento[]>(`/api/v1/motocicletas/${m.id}/disponibilidad/historial`).subscribe({next:v=>this.eventos.set(v),error:e=>this.errorDetalle.set(apiError(e))});}
  cerrarMoto():void {if(!this.busy())this.moto.set(null);}
  abrirCaso(c:Caso):void {this.caso.set(c);this.valorCorregido=c.valorObservado;this.fuente='';this.resolucion='';this.errorDetalle.set('');}
  cerrarCaso():void {if(!this.busy())this.caso.set(null);}
  guardarEstado():void {const m=this.moto();if(!m)return;this.busy.set(true);this.errorDetalle.set('');this.http.post<Moto>(`/api/v1/motocicletas/${m.id}/disponibilidad`,{estado:this.nuevoEstado,motivo:this.motivo.trim()}).subscribe({next:v=>{this.moto.set(v);this.busy.set(false);this.buscar(this.paginaBusqueda());this.abrir(v);},error:e=>{this.busy.set(false);this.errorDetalle.set(apiError(e));}});}
  reportar():void {const m=this.moto();if(!m)return;this.busy.set(true);this.errorDetalle.set('');this.http.post('/api/v1/diferencias',{motocicletaId:m.id,campo:this.campoReporte,valorObservado:this.valorObservado.trim(),descripcion:this.descripcion.trim()}).subscribe({next:()=>{this.busy.set(false);this.moto.set(null);this.cargarCasos(0);},error:e=>{this.busy.set(false);this.errorDetalle.set(apiError(e));}});}
  resolver():void {const c=this.caso();if(!c)return;this.busy.set(true);this.errorDetalle.set('');this.http.post(`/api/v1/diferencias/${c.id}/resolucion`,{valorCorregido:this.valorCorregido.trim(),fuente:this.fuente.trim(),resolucion:this.resolucion.trim()}).subscribe({next:()=>{this.busy.set(false);this.caso.set(null);this.cargarCasos(this.paginaCasos());this.buscar(this.paginaBusqueda());},error:e=>{this.busy.set(false);this.errorDetalle.set(apiError(e));}});}
}
