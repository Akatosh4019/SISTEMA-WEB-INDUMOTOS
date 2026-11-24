import {DatePipe} from '@angular/common';
import {HttpClient,HttpParams} from '@angular/common/http';
import {Component,DestroyRef,OnInit,inject,signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {apiError} from '../core/api-error';
interface Evento {clave:string;fecha:string;tipo:string;descripcion:string;registradoPor:string;origen:string|null;destino:string|null;solicitudId:number|null}
interface Historial {motocicleta:{id:number;chasisCompleto:string;marca:string;modelo:string;color:string};items:Evento[];pagina:number;tamano:number;totalElementos:number;totalPaginas:number;fuentesDisponibles:string[]}
@Component({selector:'app-historial-moto',imports:[DatePipe,FormsModule,RouterLink],templateUrl:'./historial-moto.page.html',styleUrl:'./historial-moto.page.css'})
export class HistorialMotoPage implements OnInit {
 private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);private readonly destroyRef=inject(DestroyRef);
 readonly resultado=signal<Historial|null>(null);readonly cargando=signal(false);readonly error=signal('');readonly errorFechas=signal('');
 desde='';hasta='';private id=0;private consulta=0;private aplicados={desde:'',hasta:''};
 ngOnInit(){this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params=>{this.id=Number(params.get('id'));this.resultado.set(null);this.desde='';this.hasta='';this.aplicados={desde:'',hasta:''};if(!Number.isSafeInteger(this.id)||this.id<=0){this.consulta++;this.error.set('No se encontró una motocicleta válida. Vuelve al inventario.');this.cargando.set(false);return;}this.cargar(0);});}
 buscar(){this.errorFechas.set('');if(this.desde&&this.hasta&&this.desde>this.hasta){this.errorFechas.set('La fecha inicial no puede ser posterior a la final.');return;}this.aplicados={desde:this.desde,hasta:this.hasta};this.cargar(0);}
 limpiar(){this.desde='';this.hasta='';this.errorFechas.set('');this.aplicados={desde:'',hasta:''};this.cargar(0);}
 reintentar(){if(this.id>0)this.cargar(this.resultado()?.pagina||0);}
 irPagina(pagina:number){const actual=this.resultado();if(actual&&pagina>=0&&pagina<actual.totalPaginas)this.cargar(pagina);}
 etiqueta(tipo:string){return ({LLEGADA_REGISTRADA:'Llegada registrada',FICHA_REGISTRADA:'Ficha registrada',UBICACION:'Ubicación registrada',TRASLADO:'Traslado confirmado',ASIGNADA:'Asignada a un pedido',ASIGNACION_RETIRADA:'Retirada del pedido',SOLICITUD_PENDIENTE:'Pedido pendiente',SOLICITUD_EN_PREPARACION:'Pedido en preparación',SOLICITUD_ATENDIDA:'Pedido preparado',SOLICITUD_RECHAZADA:'Pedido rechazado',SOLICITUD_ANULADA:'Pedido anulado',DESPACHADA:'Salida registrada',RECEPCION_CONFIRMADA:'Recepción confirmada',VENTA_REGISTRADA:'Venta registrada',DISPONIBILIDAD_HABILITADA:'Disponibilidad habilitada',DISPONIBILIDAD_BLOQUEADA:'Disponibilidad bloqueada',DIFERENCIA_REPORTADA:'Diferencia de datos reportada',DIFERENCIA_RESUELTA:'Diferencia de datos resuelta'} as Record<string,string>)[tipo]||'Evento registrado';}
 fuente(nombre:string){return ({llegadas:'Llegadas',fichas:'Registro de motos',ubicaciones:'Ubicaciones y traslados',asignaciones:'Asignaciones',seguimiento:'Seguimiento de pedidos',envios:'Salidas y recepciones',ventas:'Ventas registradas',disponibilidad:'Disponibilidad',diferencias:'Revisión de datos'} as Record<string,string>)[nombre]||nombre;}
 private cargar(pagina:number){const consulta=++this.consulta;this.cargando.set(true);this.error.set('');let params=new HttpParams().set('pagina',pagina).set('tamano',20);if(this.aplicados.desde)params=params.set('desde',this.aplicados.desde);if(this.aplicados.hasta)params=params.set('hasta',this.aplicados.hasta);
  this.http.get<Historial>(`/api/v1/motocicletas/${this.id}/historial-integral`,{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:datos=>{if(consulta!==this.consulta)return;this.resultado.set(datos);this.cargando.set(false);},error:e=>{if(consulta!==this.consulta)return;this.error.set(apiError(e));this.resultado.set(null);this.cargando.set(false);}});
 }
}
