import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../core/api-error';

interface Opcion { marca: string; modelo: string; color: string }
interface Modelo { id: number; marca: string; modelo: string; descripcion: string;
  activo: boolean; tieneImagen: boolean; colores: string[] }

@Component({
  selector: 'app-catalogo-page',
  imports: [FormsModule],
  template: `<div class="form-page"><div class="eyebrow">ADMINISTRACIÓN · DATOS MAESTROS</div>
    <h1>Catálogo de motocicletas</h1><p class="lead">Administración define las marcas, sus modelos y los colores disponibles. Inventarios y Comercial los eligen en sus formularios.</p>
    <section class="panel"><h2>Agregar marca, modelo y color</h2><p class="hint">Puedes escribir una marca o modelo nuevo, o elegir uno existente. Para agregar otro color al mismo modelo, conserva la marca y el modelo y cambia el color.</p><form (ngSubmit)="agregar()" #f="ngForm">
      <div class="row"><div><label for="marca">Marca</label><input id="marca" name="marca" required maxlength="120" [(ngModel)]="nueva.marca" list="marcas" /><datalist id="marcas">@for (marca of marcas(); track marca) { <option [value]="marca"></option> }</datalist></div>
      <div><label for="modelo">Modelo de esa marca</label><input id="modelo" name="modelo" required maxlength="120" [(ngModel)]="nueva.modelo" list="modelos" /><datalist id="modelos">@for (modelo of modelosDeMarca(); track modelo) { <option [value]="modelo"></option> }</datalist></div></div>
      <label for="color">Color disponible para ese modelo</label><input id="color" name="color" required maxlength="120" [(ngModel)]="nueva.color" />
      @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
      @if (mensaje()) { <p class="message success" role="status">{{mensaje()}}</p> }
      <button type="submit" [disabled]="busy() || !f.valid">{{busy() ? 'Guardando...' : 'Agregar color al modelo'}}</button>
    </form></section>
    <section class="catalogo-list"><h2>Modelos de la empresa</h2><div class="catalog-grid">
      @for (modelo of modelos(); track modelo.id) { <article class="catalog-card" [class.inactive]="!modelo.activo">
        <div class="catalog-photo">@if (fotos()[modelo.id]; as foto) { <img [src]="foto" [alt]="modelo.marca + ' ' + modelo.modelo" /> } @else { <span aria-hidden="true">▣</span> }</div>
        <div class="catalog-body"><span class="eyebrow">{{modelo.marca}}</span><h3>{{modelo.modelo}}</h3><p>{{modelo.descripcion || 'Descripción pendiente de completar.'}}</p><div class="catalog-colors">@for (color of modelo.colores; track color) { <span>{{color}}</span> }</div>
          <div class="catalog-foot"><strong>{{modelo.activo ? 'Disponible' : 'Desactivado'}}</strong><button type="button" class="secondary" (click)="editar(modelo)">Editar</button></div></div></article>
      } @empty { <p>No hay modelos registrados.</p> }
    </div></section>
    @if (seleccionado(); as modelo) { <div class="im-overlay" (click)="cerrarEdicion()"><section class="im-dialog panel" role="dialog" aria-modal="true" aria-labelledby="catalog-editar" (click)="$event.stopPropagation()"><div class="catalog-head"><div><span class="eyebrow">{{modelo.marca}}</span><h2 id="catalog-editar">{{modelo.modelo}}</h2></div><button type="button" class="secondary" (click)="cerrarEdicion()" aria-label="Cerrar">✕</button></div>
      <p class="hint">Colores: {{modelo.colores.join(' · ')}}</p><form (ngSubmit)="guardarModelo()"><label>Descripción<textarea name="descripcion" [(ngModel)]="descripcion" maxlength="1200" rows="4" placeholder="Uso y características verificadas del modelo"></textarea></label>
        <label>Imagen JPG o PNG, hasta 3 MB<input type="file" accept="image/jpeg,image/png" (change)="elegirImagen($event)" /></label>
        @if (modelo.tieneImagen) { <label class="catalog-check"><input type="checkbox" name="quitarImagen" [(ngModel)]="quitarImagen" /> Eliminar imagen actual</label> }
        <label class="catalog-check"><input type="checkbox" name="activo" [(ngModel)]="activo" /> Disponible para nuevos registros y solicitudes</label>
        @if (error()) { <p class="message error" role="alert">{{error()}}</p> }
        <div class="catalog-actions"><button type="button" class="secondary" (click)="cerrarEdicion()">Cancelar</button><button type="submit" [disabled]="busy()">{{busy() ? 'Guardando…' : 'Guardar cambios'}}</button></div></form>
    </section></div> }
    </div>`,
  styles: [`.catalogo-list{margin-top:22px}.catalog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:17px}.catalog-card{overflow:hidden;background:#fff;border:1px solid #dfe7ef;border-radius:14px}.catalog-card.inactive{opacity:.7}.catalog-photo{height:165px;display:grid;place-items:center;background:#eaf0f5;color:#91a8bc;font-size:44px}.catalog-photo img{width:100%;height:100%;object-fit:cover}.catalog-body{padding:16px}.catalog-body h3{margin:6px 0;color:#193d61}.catalog-body p{min-height:36px;color:#627893;font-size:13px;line-height:1.4}.catalog-colors{display:flex;flex-wrap:wrap;gap:5px}.catalog-colors span{padding:5px 8px;border-radius:40px;background:#eaf0f5;font-size:11px}.catalog-foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px}.catalog-foot strong{font-size:12px;color:#193d61}.catalog-head,.catalog-actions{display:flex;justify-content:space-between;gap:12px}.catalog-check{display:flex!important;align-items:center;gap:9px}.catalog-check input{width:auto!important;margin:0!important}.catalog-actions{justify-content:flex-end}.im-dialog{width:min(720px,100%)}textarea{width:100%;box-sizing:border-box}`]
})
export class CatalogoPage implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly opciones = signal<Opcion[]>([]);
  readonly modelos = signal<Modelo[]>([]);
  readonly fotos = signal<Record<number,string>>({});
  readonly seleccionado = signal<Modelo | null>(null);
  readonly marcas = signal<string[]>([]);
  readonly grupos = computed(() => this.marcas().map(nombre => ({ nombre, modelos: [...new Set(this.opciones()
    .filter(o => o.marca === nombre).map(o => o.modelo))].map(modelo => ({ nombre: modelo,
      colores: this.opciones().filter(o => o.marca === nombre && o.modelo === modelo).map(o => o.color) })) })));
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  nueva = { marca: '', modelo: '', color: '' };
  descripcion = '';
  activo = true;
  quitarImagen = false;
  imagen: File | null = null;

  constructor() { this.cargar(); }
  ngOnDestroy(): void { Object.values(this.fotos()).forEach(url => URL.revokeObjectURL(url)); }
  modelosDeMarca(): string[] {
    return [...new Set(this.opciones().filter(o => o.marca.toLowerCase() === this.nueva.marca.trim().toLowerCase())
      .map(o => o.modelo))];
  }
  cargar(): void {
    this.http.get<Modelo[]>('/api/v1/catalogo-modelos').subscribe({
      next: modelos => { this.modelos.set(modelos); modelos.filter(m => m.tieneImagen).forEach(m => this.cargarFoto(m.id)); },
      error: err => this.error.set(apiError(err))
    });
    this.http.get<Opcion[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => this.error.set(apiError(err))
    });
  }
  private cargarFoto(id: number): void {
    this.http.get(`/api/v1/catalogo-modelos/${id}/imagen`,{responseType:'blob'}).subscribe({
      next: blob => { const anterior=this.fotos()[id]; if (anterior) URL.revokeObjectURL(anterior);
        this.fotos.update(fotos => ({...fotos,[id]:URL.createObjectURL(blob)})); },
      error: () => this.error.set('No se pudo cargar una imagen del catálogo.')
    });
  }
  editar(modelo: Modelo): void { this.seleccionado.set(modelo); this.descripcion=modelo.descripcion;
    this.activo=modelo.activo; this.quitarImagen=false; this.imagen=null; this.error.set(''); }
  cerrarEdicion(): void { if (!this.busy()) this.seleccionado.set(null); }
  elegirImagen(evento: Event): void {
    const archivo=(evento.target as HTMLInputElement).files?.[0] ?? null;
    if (archivo && (!['image/jpeg','image/png'].includes(archivo.type) || archivo.size > 3*1024*1024)) {
      this.error.set('Usa una imagen JPG o PNG de hasta 3 MB.'); this.imagen=null; return;
    }
    this.imagen=archivo; if (archivo) this.quitarImagen=false; this.error.set('');
  }
  guardarModelo(): void {
    const modelo=this.seleccionado(); if (!modelo || this.busy()) return;
    const datos=new FormData(); datos.append('descripcion',this.descripcion.trim());
    datos.append('activo',String(this.activo)); datos.append('quitarImagen',String(this.quitarImagen));
    if (this.imagen) datos.append('imagen',this.imagen,this.imagen.name);
    this.busy.set(true); this.error.set('');
    this.http.put<Modelo>(`/api/v1/catalogo-modelos/${modelo.id}`,datos).subscribe({
      next: () => { this.busy.set(false); this.seleccionado.set(null); this.mensaje.set('Modelo actualizado.');
        if (this.quitarImagen) { const url=this.fotos()[modelo.id]; if (url) URL.revokeObjectURL(url);
          this.fotos.update(fotos => { const copia={...fotos}; delete copia[modelo.id]; return copia; }); }
        this.cargar(); },
      error: err => { this.busy.set(false); this.error.set(apiError(err)); }
    });
  }
  agregar(): void {
    const datos = { marca: this.nueva.marca.trim(), modelo: this.nueva.modelo.trim(), color: this.nueva.color.trim() };
    if (!datos.marca || !datos.modelo || !datos.color) return;
    this.busy.set(true); this.error.set(''); this.mensaje.set('');
    this.http.post<Opcion>('/api/v1/catalogo-motocicletas', datos).subscribe({
      next: () => { this.nueva.color = ''; this.busy.set(false);
        this.mensaje.set('Color disponible agregado al modelo. Ya aparece en los formularios.'); this.cargar(); },
      error: err => { this.error.set(apiError(err)); this.busy.set(false); }
    });
  }
}
