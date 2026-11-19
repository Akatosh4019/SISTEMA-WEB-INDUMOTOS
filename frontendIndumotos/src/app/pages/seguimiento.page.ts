import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Linea { id: number; marca: string; modelo: string; color: string; cantidad: number }
interface Solicitud { id: number; estado: string; lineas: Linea[]; solicitante: string }
interface Evento { id: number; estado: string; fecha: string; registrador: string; motivo: string | null }
interface Unidad { asociacionId: number; chasis: string }
interface Candidata { motocicletaId: number; chasis: string; modelo: string; color: string }

@Component({
  selector: 'app-seguimiento', imports: [FormsModule],
  template: `
    <h1>Seguimiento y asignación</h1>
    <section class="panel"><label>Número de solicitud <input type="number" min="1" [(ngModel)]="solicitudId"></label>
      <button type="button" (click)="consultar()" [disabled]="solicitudId < 1 || ocupado()">Consultar</button>
    </section>
    @if (solicitud(); as s) {
      <section class="panel"><h2>Solicitud #{{s.id}} · {{s.estado}}</h2><p>Solicitada por {{s.solicitante}}</p>
        @if (access.can('SOLICITUDES_AVANZAR')) {
          @if (s.estado === 'PENDIENTE') { <button type="button" (click)="avanzar('EN_PREPARACION')">Iniciar preparación</button> }
          @if (s.estado === 'EN_PREPARACION') { <button type="button" (click)="avanzar('ATENDIDA')">Marcar atendida</button> }
          @if (s.estado === 'PENDIENTE' || s.estado === 'EN_PREPARACION') {
            <button type="button" (click)="avanzar('RECHAZADA')">Rechazar</button>
          }
        }
        @if (access.can('SOLICITUDES_ANULAR') && s.estado === 'PENDIENTE') {
          <button type="button" (click)="anular()">Anular solicitud</button>
        }
        <h3>Historial</h3>
        @for (evento of eventos(); track evento.id) {
          <p>{{evento.estado}} · {{evento.fecha}} · {{evento.registrador}} {{evento.motivo || ''}}</p>
        }
      </section>
      @if (access.can('UNIDADES_ASIGNAR')) {
        <section class="panel"><h2>Unidades solicitadas</h2>
          @for (linea of s.lineas; track linea.id) {
            <article><h3>{{linea.marca}} {{linea.modelo}} · {{linea.color}} · {{linea.cantidad}}</h3>
              <button type="button" (click)="verUnidades(linea.id)">Ver asignadas</button>
              @for (unidad of unidades()[linea.id]; track unidad.asociacionId) {
                <p>{{unidad.chasis}}
                  @if (s.estado === 'EN_PREPARACION') {
                    <button type="button" (click)="retirar(linea.id,unidad.asociacionId)">Retirar</button>
                  }
                </p>
              }
              @if (s.estado === 'EN_PREPARACION') {
                <label>Buscar chasis <input [(ngModel)]="chasis"></label>
                <button type="button" (click)="buscar()">Buscar libres</button>
                @for (moto of candidatas(); track moto.motocicletaId) {
                  <button type="button" (click)="asignar(linea.id,moto.motocicletaId)">Asignar {{moto.chasis}} · {{moto.modelo}} · {{moto.color}}</button>
                }
              }
            </article>
          }
        </section>
      }
    }
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (mensaje()) { <p role="status">{{mensaje()}}</p> }
  `,
  styles: [`h1{color:#243347}.panel{background:white;border:1px solid #e5e9ee;border-radius:10px;padding:20px;margin:20px 0}article{border-top:1px solid #e5e9ee;padding:12px 0}label{display:grid;gap:6px;margin:10px 0}input{padding:9px;border:1px solid #ccd5df;border-radius:5px}button{padding:9px 12px;cursor:pointer;margin:4px}[role=alert]{color:#aa311e}[role=status]{color:#176744}`]
})
export class SeguimientoPage {
  private readonly http = inject(HttpClient);
  readonly access = inject(AuthService);
  readonly solicitud = signal<Solicitud | null>(null);
  readonly eventos = signal<Evento[]>([]);
  readonly unidades = signal<Record<number,Unidad[]>>({});
  readonly candidatas = signal<Candidata[]>([]);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly ocupado = signal(false);
  solicitudId = 0;
  chasis = '';

  consultar(): void {
    this.ocupado.set(true); this.error.set(''); this.solicitud.set(null);
    this.http.get<Solicitud>(`/api/v1/solicitudes/${this.solicitudId}`).subscribe({
      next: s => { this.solicitud.set(s); this.ocupado.set(false); this.historial(); },
      error: err => { this.error.set(apiError(err)); this.ocupado.set(false); }
    });
  }
  historial(): void {
    this.http.get<Evento[]>(`/api/v1/solicitudes/${this.solicitudId}/seguimiento`).subscribe({
      next: lista => this.eventos.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  avanzar(estado: string): void {
    const motivo = estado === 'RECHAZADA' ? window.prompt('Motivo del rechazo:') : null;
    if (estado === 'RECHAZADA' && !motivo?.trim()) return;
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/seguimiento`,{estado,motivo}).subscribe({
      next: () => { this.mensaje.set('Estado actualizado.'); this.consultar(); }, error: err => this.error.set(apiError(err))
    });
  }
  anular(): void {
    const motivo = window.prompt('Motivo de la anulación:');
    if (!motivo?.trim()) return;
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/anulacion`,{motivo}).subscribe({
      next: () => { this.mensaje.set('Solicitud anulada.'); this.consultar(); }, error: err => this.error.set(apiError(err))
    });
  }
  verUnidades(linea: number): void {
    this.http.get<Unidad[]>(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`).subscribe({
      next: lista => this.unidades.update(actual => ({...actual,[linea]:lista})), error: err => this.error.set(apiError(err))
    });
  }
  buscar(): void {
    this.http.get<Candidata[]>('/api/v1/motocicletas/elegibles',{params:{chasis:this.chasis}}).subscribe({
      next: lista => this.candidatas.set(lista), error: err => this.error.set(apiError(err))
    });
  }
  asignar(linea: number,motocicletaId: number): void {
    this.http.post(`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades`,{motocicletaId}).subscribe({
      next: () => { this.candidatas.set([]); this.verUnidades(linea); this.mensaje.set('Unidad asignada.'); },
      error: err => this.error.set(apiError(err))
    });
  }
  retirar(linea: number,asociacion: number): void {
    const motivo = window.prompt('Motivo del retiro:');
    if (!motivo?.trim()) return;
    this.http.request('DELETE',`/api/v1/solicitudes/${this.solicitudId}/lineas/${linea}/unidades/${asociacion}`,{body:{motivo}}).subscribe({
      next: () => { this.verUnidades(linea); this.mensaje.set('Unidad retirada.'); },
      error: err => this.error.set(apiError(err))
    });
  }
}
