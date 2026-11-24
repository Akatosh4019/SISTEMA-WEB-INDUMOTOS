import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { FichaDialogComponent } from './ficha-dialog.component';
import { ControlDatosPage } from './control-datos.page';

interface ResumenMotocicleta {
  id: number;
  marca: string;
  modelo: string;
  color: string;
  chasisVista: string;
}

interface PaginaMotocicletas {
  items: ResumenMotocicleta[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

type Filtros = { chasis: string; marca: string; modelo: string; color: string };
interface EstadoResumen { id: number; estado: string; puedeOfrecerse: boolean }
const ESTADOS: Record<string, string> = { DISPONIBLE: 'Disponible', ASIGNADA: 'Asignada a solicitud', EN_TRANSITO: 'En camino',
  VENDIDA: 'Vendida', BLOQUEADA: 'Bloqueada', EN_REVISION: 'En revisión', SIN_UBICACION: 'Sin ubicación' };

@Component({
  selector: 'app-inventario-page',
  imports: [FormsModule, RouterLink, FichaDialogComponent, ControlDatosPage],
  templateUrl: './inventario.page.html',
  styleUrl: './inventario.page.css'
})
export class InventarioPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal<PaginaMotocicletas | null>(null);
  readonly fichaAbierta = signal<number | null>(null);
  readonly filtrosAbiertos = signal(false);
  readonly vista = signal<'listado' | 'control'>('listado');
  readonly estados = signal<Record<number, EstadoResumen>>({});
  filtros: Filtros = { chasis: '', marca: '', modelo: '', color: '' };
  private aplicados: Filtros = { ...this.filtros };
  private temporizador?: ReturnType<typeof setTimeout>;
  private consulta = 0;

  ngOnInit(): void {
    if (this.auth.can('INVENTARIO_CONSULTAR')) this.cargar(0);
    else this.vista.set('control');
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (Number.isSafeInteger(id) && id > 0) this.fichaAbierta.set(id);
    });
  }

  @HostListener('document:keydown.escape')
  cerrarFicha(): void { this.fichaAbierta.set(null); }

  alCambiarFiltro(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.buscar(), 300);
  }

  buscar(): void {
    clearTimeout(this.temporizador);
    const chasis = this.filtros.chasis.trim();
    if (chasis && (chasis.length < 4 || (chasis.length === 4 && !/^\d{4}$/.test(chasis)))) {
      this.error.set('Ingresa el chasis completo o sus últimos cuatro dígitos.');
      return;
    }
    this.aplicados = {
      chasis,
      marca: this.filtros.marca.trim(),
      modelo: this.filtros.modelo.trim(),
      color: this.filtros.color.trim()
    };
    this.cargar(0);
  }

  limpiar(): void {
    this.filtros = { chasis: '', marca: '', modelo: '', color: '' };
    this.aplicados = { ...this.filtros };
    this.cargar(0);
  }

  irPagina(pagina: number): void {
    const actual = this.page();
    if (actual && pagina >= 0 && pagina < actual.totalPaginas) this.cargar(pagina);
  }

  nombreEstado(estado: string): string { return ESTADOS[estado] ?? estado; }

  /** Muestra en cada fila si la moto se puede ofrecer; solo para cuentas que consultan disponibilidad. */
  private cargarEstados(items: ResumenMotocicleta[]): void {
    if (!items.length || !this.auth.can('DISPONIBILIDAD_CONSULTAR')) return;
    const ids = items.map(item => item.id).join(',');
    this.http.get<EstadoResumen[]>('/api/v1/disponibilidad/estados', { params: { ids } }).subscribe({
      next: lista => this.estados.update(actual => ({ ...actual, ...Object.fromEntries(lista.map(e => [e.id, e])) })),
      error: () => { /* El estado es informativo: si falla, la lista sigue disponible. */ }
    });
  }

  paginasVisibles(total: number, actual: number): number[] {
    const inicio = Math.max(0, Math.min(actual - 2, total - 5));
    return Array.from({ length: Math.min(5, total - inicio) }, (_, indice) => inicio + indice);
  }

  private cargar(pagina: number): void {
    const consulta = ++this.consulta;
    this.error.set('');
    this.loading.set(true);
    let params = new HttpParams().set('pagina', pagina).set('tamano', 10);
    for (const [campo, valor] of Object.entries(this.aplicados)) {
      if (valor) params = params.set(campo, valor);
    }
    this.http.get<PaginaMotocicletas>('/api/v1/motocicletas', { params }).subscribe({
      next: resultado => { if (consulta !== this.consulta) return; this.page.set(resultado); this.loading.set(false); this.cargarEstados(resultado.items); },
      error: error => {
        if (consulta !== this.consulta) return;
        this.page.set(null);
        this.error.set(apiError(error));
        this.loading.set(false);
      }
    });
  }
}
