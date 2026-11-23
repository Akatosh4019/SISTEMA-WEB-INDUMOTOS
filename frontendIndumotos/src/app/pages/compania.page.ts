import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';

interface Tienda { id:number; nombre:string; disponibles:number; vendidas:number; }
interface Cuenta { id:number; nombreCompleto:string; nombreUsuario:string; }
interface Pagina<T> { items:T[]; totalElementos:number; }

@Component({selector:'app-compania-page',imports:[FormsModule,RouterLink],
  template:`<div class="form-page mode-page"><span class="eyebrow">ADMINISTRACIÓN</span><h1>Modo compañía</h1>
    <p class="lead">Consulta las tiendas y asigna el personal que puede trabajar en cada una.</p>
    @if(error()) { <p class="message error" role="alert">{{error()}}</p> }
    <div class="store-grid">@for(t of tiendas();track t.id){<article class="panel store-card"><span class="eyebrow">SEDE</span><h2>{{t.nombre}}</h2>
      <div class="stats"><div><strong>{{t.disponibles}}</strong><span>Motos disponibles</span></div><div><strong>{{t.vendidas}}</strong><span>Ventas</span></div></div>
      <a routerLink="/app/tienda" [queryParams]="{tiendaId:t.id}">Abrir tienda →</a></article>}
      @empty{<section class="panel">No hay tiendas activas. Agrégalas en Ubicaciones.</section>}</div>
    <section class="panel"><h2>Personal de tienda</h2><p class="hint">Cada cuenta de Comercial o Facturación se limita a una tienda. Solo Administración puede cambiarla.</p>
      <div class="filters"><label>Área<select [(ngModel)]="rol" (ngModelChange)="cargarCuentas(0)"><option value="COMERCIAL">Comercial</option><option value="FACTURACION">Facturación</option></select></label>
      <label>Buscar trabajador<input [(ngModel)]="buscar" (ngModelChange)="cargarCuentas(0)" placeholder="Nombre o usuario" /></label></div>
      <div class="filters"><label>Cuenta<select [(ngModel)]="usuarioId"><option [ngValue]="0">Seleccionar</option>@for(c of cuentas();track c.id){<option [ngValue]="c.id">{{c.nombreCompleto}} · {{c.nombreUsuario}}</option>}</select></label>
      <label>Tienda<select [(ngModel)]="tiendaId"><option [ngValue]="0">Seleccionar</option>@for(t of tiendas();track t.id){<option [ngValue]="t.id">{{t.nombre}}</option>}</select></label>
      <button type="button" (click)="asignar()" [disabled]="busy() || !usuarioId || !tiendaId">Asignar</button></div>
      <div class="pager"><button type="button" class="tertiary" (click)="cargarCuentas(pagina()-1)" [disabled]="pagina()===0">Anterior</button><span>Página {{pagina()+1}} de {{totalPaginas()}}</span><button type="button" class="tertiary" (click)="cargarCuentas(pagina()+1)" [disabled]="pagina()+1>=totalPaginas()">Siguiente</button></div>
      @if(mensaje()){<p class="message success" role="status">{{mensaje()}}</p>}
    </section></div>`,styleUrl:'./modos.page.css'})
export class CompaniaPage implements OnInit {
  private readonly http=inject(HttpClient);
  readonly tiendas=signal<Tienda[]>([]); readonly cuentas=signal<Cuenta[]>([]);
  readonly pagina=signal(0);readonly total=signal(0);readonly error=signal('');readonly mensaje=signal('');readonly busy=signal(false);
  rol='COMERCIAL'; buscar=''; usuarioId=0; tiendaId=0;
  ngOnInit():void { this.http.get<Tienda[]>('/api/v1/modos/compania').subscribe({next:v=>this.tiendas.set(v),error:e=>this.error.set(apiError(e))});this.cargarCuentas(0); }
  totalPaginas():number {return Math.max(1,Math.ceil(this.total()/10));}
  cargarCuentas(p:number):void { if(p<0)return; this.http.get<Pagina<Cuenta>>('/api/v1/usuarios',{params:{pagina:p,tamano:10,estado:'ACTIVO',rol:this.rol,buscar:this.buscar.trim()}}).subscribe({
    next:v=>{this.cuentas.set(v.items);this.pagina.set(p);this.total.set(v.totalElementos);this.usuarioId=0;},error:e=>this.error.set(apiError(e))}); }
  asignar():void {this.busy.set(true);this.error.set('');this.mensaje.set('');this.http.put(`/api/v1/usuarios/${this.usuarioId}/tienda`,{tiendaId:this.tiendaId}).subscribe({
    next:()=>{this.busy.set(false);this.mensaje.set('Tienda asignada.');},error:e=>{this.busy.set(false);this.error.set(apiError(e));}});}
}
