import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, forkJoin, map, of, takeUntil } from 'rxjs';
import { AuthService } from '../core/auth.service';

interface Llegada {
  id: number;
  numeroGuia: string;
  fechaLlegada: string;
  receptorUsuario: string;
  cantidadDeclarada: number;
  cantidadRecibida: number;
  observacion: string | null;
  estadoRegistro: 'PENDIENTE' | 'CONFIRMADA';
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
  readonly listBusy = signal(false);
  readonly detailBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Partial<Record<'numeroGuia' | 'cantidadDeclarada' | 'cantidadRecibida' | 'imagenes', string>>>({});
  readonly searchError = signal('');
  readonly detailError = signal('');
  readonly result = signal<Llegada | null>(null);
  readonly detail = signal<DetalleLlegada | null>(null);
  readonly nuevaAbierta = signal(false);
  readonly detalleAbierto = signal(false);
  readonly fotos = signal<FotoVisible[]>([]);
  readonly fotosCargando = signal(false);
  readonly fotosError = signal('');
  readonly paginaLlegadas = signal<PaginaLlegadas | null>(null);
  readonly totalesEstado = signal<Record<'PENDIENTE' | 'CONFIRMADA', number | null>>({PENDIENTE:null, CONFIRMADA:null});
  readonly estadoActivo = signal<'PENDIENTE' | 'CONFIRMADA'>('PENDIENTE');
  private consultaListado = 0;
  private consultaDetalle = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  private readonly destroy$ = new Subject<void>();
  private detailRequest?: Subscription;
  private photoRequest?: Subscription;
  private routeRequest?: Subscription;
  private ultimoFoco?: HTMLElement;
  private destruido = false;
  imagenes: File[] = [];
  form: { numeroGuia: string; cantidadDeclarada: number | null; cantidadRecibida: number | null; observacion: string } =
    { numeroGuia: '', cantidadDeclarada: 1, cantidadRecibida: 1, observacion: '' };
  numeroGuia = '';

  ngOnInit(): void {
    if (!this.auth.can('INVENTARIO_CONSULTAR')) return;
    this.listar(0);
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = Number(params.get('id'));
      if (Number.isSafeInteger(id) && id > 0) {
        this.routeRequest?.unsubscribe();
        this.routeRequest = this.http.get<Llegada>(`/api/v1/llegadas/${id}`).subscribe({
          next: llegada => this.abrir(llegada), error: err => this.searchError.set(this.message(err))
        });
      }
    });
  }
  ngOnDestroy(): void {
    this.destruido = true;
    clearTimeout(this.temporizador);
    this.detailRequest?.unsubscribe();
    this.photoRequest?.unsubscribe();
    this.routeRequest?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
    this.limpiarFotos();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.detalleAbierto()) this.cerrarDetalle();
    else if (this.nuevaAbierta()) this.cerrarNueva();
  }

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
        this.resetearNueva(); this.estadoActivo.set('PENDIENTE');
        if (this.auth.can('INVENTARIO_CONSULTAR')) this.listar(0);
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

  abrir(llegada: Llegada, origen?: EventTarget | null): void {
    if (origen instanceof HTMLElement) this.ultimoFoco = origen;
    this.detailRequest?.unsubscribe();
    this.photoRequest?.unsubscribe();
    this.limpiarFotos();
    this.detalleAbierto.set(true);
    this.fotosError.set('');
    this.detailError.set('');
    this.detail.set(null);
    const consulta = ++this.consultaDetalle;
    this.detailBusy.set(true);
    queueMicrotask(() => (document.querySelector('[data-detail-dialog]') as HTMLElement | null)?.focus());
    this.detailRequest = this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (consulta !== this.consultaDetalle) return;
        this.detail.set(detalle); this.detailBusy.set(false); this.cargarFotos(llegada.id, consulta); },
      error: (error: unknown) => { if (consulta !== this.consultaDetalle) return;
        this.detailError.set(this.message(error)); this.detailBusy.set(false); }
    });
  }

  cerrarDetalle(): void {
    ++this.consultaDetalle;
    this.detailRequest?.unsubscribe();
    this.photoRequest?.unsubscribe();
    this.detalleAbierto.set(false); this.detail.set(null);
    this.detailBusy.set(false); this.fotosCargando.set(false); this.limpiarFotos();
    const foco = this.ultimoFoco;
    this.ultimoFoco = undefined;
    queueMicrotask(() => foco?.focus());
  }

  private cargarFotos(llegadaId: number, consulta: number): void {
    this.fotosCargando.set(true);
    this.photoRequest = this.http.get<GuiaImagen[]>(`/api/v1/llegadas/${llegadaId}/guias`).subscribe({
      next: imagenes => {
        if (consulta !== this.consultaDetalle) return;
        if (!imagenes.length) { this.fotosCargando.set(false); return; }
        const solicitudes = imagenes.map(imagen => this.http
          .get(`/api/v1/llegadas/${llegadaId}/guias/${imagen.id}`, {responseType:'blob'})
          .pipe(map(blob => ({imagen, blob})), catchError(() => of({imagen, blob:null}))));
        this.photoRequest = forkJoin(solicitudes).subscribe(resultados => {
          if (consulta !== this.consultaDetalle || this.destruido) return;
          const visibles = resultados.filter(resultado => resultado.blob !== null).map(resultado => ({
            ...resultado.imagen, url: URL.createObjectURL(resultado.blob as Blob)
          })).sort((a, b) => a.orden - b.orden);
          this.fotos.set(visibles);
          if (visibles.length !== resultados.length)
            this.fotosError.set('Una o más fotografías no pudieron cargarse. Las demás continúan disponibles.');
          this.fotosCargando.set(false);
        });
      },
      error: error => { if (consulta === this.consultaDetalle) { this.fotosError.set(this.message(error)); this.fotosCargando.set(false); } }
    });
  }

  private limpiarFotos(): void { this.fotos().forEach(foto => URL.revokeObjectURL(foto.url)); this.fotos.set([]); }

  buscarGuia(): void {
    clearTimeout(this.temporizador);
    this.totalesEstado.set({PENDIENTE:null, CONFIRMADA:null});
    this.listar(0);
  }

  limpiarBusqueda(): void {
    clearTimeout(this.temporizador);
    if (!this.numeroGuia) return;
    this.numeroGuia = '';
    this.totalesEstado.set({PENDIENTE:null, CONFIRMADA:null});
    this.listar(0);
  }

  cambiarEstado(estado: 'PENDIENTE' | 'CONFIRMADA'): void {
    if (this.estadoActivo() === estado) return;
    clearTimeout(this.temporizador);
    this.estadoActivo.set(estado);
    this.paginaLlegadas.set(null);
    this.listar(0);
  }

  alCambiarGuia(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.totalesEstado.set({PENDIENTE:null, CONFIRMADA:null});
      this.listar(0);
    }, 300);
  }

  cambiarPagina(pagina: number): void {
    clearTimeout(this.temporizador);
    this.listar(pagina);
  }

  listar(pagina: number): void {
    if (pagina < 0) return;
    const consulta = ++this.consultaListado;
    this.searchError.set('');
    this.listBusy.set(true);
    this.http.get<PaginaLlegadas>('/api/v1/llegadas/pagina',
      {params:{numeroGuia:this.numeroGuia.trim(),pagina,estado:this.estadoActivo()}}).subscribe({
      next: resultado => { if (consulta !== this.consultaListado) return;
        this.paginaLlegadas.set(resultado);
        this.totalesEstado.update(actual => ({...actual, [this.estadoActivo()]:resultado.totalElementos}));
        this.listBusy.set(false); },
      error: error => { if (consulta !== this.consultaListado) return;
        this.searchError.set(this.message(error)); this.listBusy.set(false); }
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
