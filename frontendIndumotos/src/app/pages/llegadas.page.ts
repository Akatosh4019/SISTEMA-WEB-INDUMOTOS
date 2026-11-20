import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface Llegada {
  id: number;
  numeroGuia: string;
  fechaLlegada: string;
  receptorUsuario: string;
  cantidadDeclarada: number;
  cantidadRecibida: number;
  observacion: string | null;
}

interface FichaVinculada {
  id: number;
  llegadaId: number;
  marca: string;
  modelo: string;
  color: string;
  chasisCompleto: string;
}

interface DetalleLlegada {
  llegada: Llegada;
  fichas: FichaVinculada[];
  cantidadFichas: number;
  diferenciaInformativa: number;
}
interface PaginaLlegadas { items: Llegada[]; pagina: number; tamano: number; totalElementos: number; totalPaginas: number }
interface GuiaImagen { id: number; orden: number; nombreArchivo: string; tipoMime: string; tamano: number }
interface FotoVisible extends GuiaImagen { url: string }

@Component({
  selector: 'app-llegadas-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './llegadas.page.html',
  styleUrl: './llegadas.page.css'
})
export class LlegadasPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Partial<Record<'numeroGuia' | 'cantidadDeclarada' | 'cantidadRecibida' | 'imagenes', string>>>({});
  readonly searchError = signal('');
  readonly result = signal<Llegada | null>(null);
  readonly detail = signal<DetalleLlegada | null>(null);
  readonly nuevaAbierta = signal(false);
  readonly detalleAbierto = signal(false);
  readonly fotos = signal<FotoVisible[]>([]);
  readonly fotosCargando = signal(false);
  readonly fotosError = signal('');
  readonly paginaLlegadas = signal<PaginaLlegadas | null>(null);
  private consultaListado = 0;
  private consultaDetalle = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  imagenes: File[] = [];
  form: { numeroGuia: string; cantidadDeclarada: number | null; cantidadRecibida: number | null; observacion: string } =
    { numeroGuia: '', cantidadDeclarada: 1, cantidadRecibida: 1, observacion: '' };
  numeroGuia = '';

  ngOnInit(): void {
    if (!this.auth.can('INVENTARIO_CONSULTAR')) return;
    this.listar(0);
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (Number.isSafeInteger(id) && id > 0) {
        this.http.get<Llegada>(`/api/v1/llegadas/${id}`).subscribe({
          next: llegada => this.abrir(llegada), error: err => this.searchError.set(this.message(err))
        });
      }
    });
  }
  ngOnDestroy(): void { clearTimeout(this.temporizador); this.limpiarFotos(); }

  abrirNueva(): void { this.resetearNueva(); this.nuevaAbierta.set(true); }
  cerrarNueva(): void { if (!this.busy()) { this.nuevaAbierta.set(false); this.resetearNueva(); } }

  private resetearNueva(): void {
    this.form = {numeroGuia:'', cantidadDeclarada:1, cantidadRecibida:1, observacion:''};
    this.imagenes = [];
    this.error.set('');
    this.fieldErrors.set({});
  }

  seleccionarImagenes(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const nuevas = Array.from(input.files ?? []);
    input.value = '';
    if (!nuevas.length) return;
    if (this.imagenes.length + nuevas.length > 3) {
      this.fieldErrors.update(actual => ({...actual, imagenes:'Puedes adjuntar como máximo tres fotos.'}));
      return;
    }
    this.imagenes = [...this.imagenes, ...nuevas];
    this.fieldErrors.update(actual => ({...actual, imagenes:this.errorImagenes()}));
  }

  quitarImagen(indice: number): void {
    this.imagenes = this.imagenes.filter((_, posicion) => posicion !== indice);
    this.fieldErrors.update(actual => ({...actual, imagenes:undefined}));
  }

  private errorImagenes(): string | undefined {
    if (this.imagenes.length < 1 || this.imagenes.length > 3)
      return 'Adjunta entre una y tres fotos de la guía.';
    if (this.imagenes.some(foto => !['image/jpeg', 'image/png'].includes(foto.type)
      || foto.size < 1 || foto.size > 5 * 1024 * 1024))
      return 'Cada foto debe ser JPG o PNG y pesar hasta 5 MB.';
    return undefined;
  }

  registrar(): void {
    this.error.set('');
    this.fieldErrors.set({});
    const errores: Partial<Record<'numeroGuia' | 'cantidadDeclarada' | 'cantidadRecibida' | 'imagenes', string>> = {};
    if (!this.form.numeroGuia.trim()) errores.numeroGuia = 'Ingresa el número de guía.';
    if (!Number.isSafeInteger(this.form.cantidadDeclarada) || (this.form.cantidadDeclarada ?? 0) <= 0)
      errores.cantidadDeclarada = 'Ingresa una cantidad declarada entera mayor que cero.';
    if (!Number.isSafeInteger(this.form.cantidadRecibida) || (this.form.cantidadRecibida ?? 0) <= 0)
      errores.cantidadRecibida = 'Ingresa una cantidad recibida entera mayor que cero.';
    const errorImagenes = this.errorImagenes();
    if (errorImagenes) errores.imagenes = errorImagenes;
    if (Object.keys(errores).length) { this.fieldErrors.set(errores); this.error.set('Corrige los campos marcados.'); return; }
    this.busy.set(true);
    const datos = new FormData();
    datos.append('numeroGuia', this.form.numeroGuia.trim());
    datos.append('cantidadDeclarada', String(this.form.cantidadDeclarada));
    datos.append('cantidadRecibida', String(this.form.cantidadRecibida));
    datos.append('observacion', this.form.observacion.trim());
    this.imagenes.forEach(imagen => datos.append('imagenes', imagen, imagen.name));
    this.http.post<Llegada>('/api/v1/llegadas/con-guia', datos).subscribe({
      next: llegada => { this.result.set(llegada); this.busy.set(false); this.nuevaAbierta.set(false);
        this.resetearNueva(); if (this.auth.can('INVENTARIO_CONSULTAR')) this.listar(0);
        if (this.auth.can('INVENTARIO_CONSULTAR')) this.abrir(llegada); },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 400) {
          const details = error.error as { errores?: Record<string, string> } | null;
          const fields = details?.errores ?? {};
          this.fieldErrors.set({ numeroGuia: fields['numeroGuia'],
            cantidadDeclarada: fields['cantidadDeclarada'], cantidadRecibida: fields['cantidadRecibida'] });
          this.error.set(Object.keys(fields).length ? 'Corrige los campos marcados.' : this.message(error));
        } else this.error.set(this.message(error));
        this.busy.set(false);
      }
    });
  }

  abrir(llegada: Llegada): void {
    this.limpiarFotos();
    this.detalleAbierto.set(true);
    this.fotosError.set('');
    this.detail.set(null);
    const consulta = ++this.consultaDetalle;
    this.searchBusy.set(true);
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (consulta !== this.consultaDetalle) return;
        this.detail.set(detalle); this.searchBusy.set(false); this.cargarFotos(llegada.id, consulta); },
      error: (error: unknown) => { if (consulta !== this.consultaDetalle) return;
        this.fotosError.set(this.message(error)); this.searchBusy.set(false); }
    });
  }

  cerrarDetalle(): void {
    ++this.consultaDetalle; this.detalleAbierto.set(false); this.detail.set(null);
    this.fotosCargando.set(false); this.limpiarFotos();
  }

  private cargarFotos(llegadaId: number, consulta: number): void {
    this.fotosCargando.set(true);
    this.http.get<GuiaImagen[]>(`/api/v1/llegadas/${llegadaId}/guias`).subscribe({
      next: imagenes => {
        if (consulta !== this.consultaDetalle) return;
        if (!imagenes.length) { this.fotosCargando.set(false); return; }
        let pendientes = imagenes.length;
        for (const imagen of imagenes) {
          this.http.get(`/api/v1/llegadas/${llegadaId}/guias/${imagen.id}`, {responseType:'blob'}).subscribe({
            next: blob => { if (consulta === this.consultaDetalle) {
              this.fotos.update(actual => [...actual, {...imagen, url:URL.createObjectURL(blob)}]
                .sort((a, b) => a.orden - b.orden));
            } if (--pendientes === 0 && consulta === this.consultaDetalle) this.fotosCargando.set(false); },
            error: () => { if (consulta === this.consultaDetalle) this.fotosError.set('No se pudo cargar una foto de la guía.');
              if (--pendientes === 0 && consulta === this.consultaDetalle) this.fotosCargando.set(false); }
          });
        }
      },
      error: error => { if (consulta === this.consultaDetalle) { this.fotosError.set(this.message(error)); this.fotosCargando.set(false); } }
    });
  }

  private limpiarFotos(): void { this.fotos().forEach(foto => URL.revokeObjectURL(foto.url)); this.fotos.set([]); }

  buscarGuia(): void {
    clearTimeout(this.temporizador);
    this.listar(0);
  }

  alCambiarGuia(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.listar(0), 300);
  }

  listar(pagina: number): void {
    if (pagina < 0) return;
    const consulta = ++this.consultaListado;
    this.searchError.set('');
    this.searchBusy.set(true);
    this.http.get<PaginaLlegadas>('/api/v1/llegadas/pagina',
      {params:{numeroGuia:this.numeroGuia.trim(),pagina}}).subscribe({
      next: resultado => { if (consulta !== this.consultaListado) return;
        this.paginaLlegadas.set(resultado); this.searchBusy.set(false); },
      error: error => { if (consulta !== this.consultaListado) return;
        this.searchError.set(this.message(error)); this.searchBusy.set(false); }
    });
  }

  private message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo completar la operación.';
    if (error.status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';
    if (error.status === 404) return 'No se encontró la llegada solicitada.';
    if (error.status === 413) return 'Las fotos superan el tamaño permitido.';
    if (error.status === 400) return typeof error.error?.error === 'string' ? error.error.error : 'Revisa los datos ingresados.';
    return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }
}
