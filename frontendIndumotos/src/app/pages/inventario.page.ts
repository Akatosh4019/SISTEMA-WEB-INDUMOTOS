import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

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

@Component({
  selector: 'app-inventario-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './inventario.page.html',
  styleUrl: './inventario.page.css'
})
export class InventarioPage implements OnInit {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal<PaginaMotocicletas | null>(null);
  filtros: Filtros = { chasis: '', marca: '', modelo: '', color: '' };
  private aplicados: Filtros = { ...this.filtros };

  ngOnInit(): void { this.cargar(0); }

  buscar(): void {
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

  paginasVisibles(total: number, actual: number): number[] {
    const inicio = Math.max(0, Math.min(actual - 2, total - 5));
    return Array.from({ length: Math.min(5, total - inicio) }, (_, indice) => inicio + indice);
  }

  private cargar(pagina: number): void {
    if (this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    let params = new HttpParams().set('pagina', pagina).set('tamano', 10);
    for (const [campo, valor] of Object.entries(this.aplicados)) {
      if (valor) params = params.set(campo, valor);
    }
    this.http.get<PaginaMotocicletas>('/api/v1/motocicletas', { params }).subscribe({
      next: resultado => { this.page.set(resultado); this.loading.set(false); },
      error: error => {
        this.page.set(null);
        this.error.set(apiError(error));
        this.loading.set(false);
      }
    });
  }
}
