import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
  confirmadoPor: string | null;
  confirmadoEn: string | null;
}
interface PaginaLlegadas { items: Llegada[]; pagina: number; tamano: number; totalElementos: number; totalPaginas: number }
interface GuiaImagen { id: number; orden: number; nombreArchivo: string; tipoMime: string; tamano: number }
interface FotoVisible extends GuiaImagen { url: string }
interface GuiaPapelera { id: number; numeroGuia: string; eliminadoEn: string; eliminadoPor: string | null; motivo: string; venceEn: string }
interface EventoGuia { accion: string; usuario: string | null; ocurridoEn: string; motivo: string | null }
interface RetiroHistorico { llegadaId: number; numeroGuia: string; usuario: string | null; ocurridoEn: string; motivo: string }

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
  readonly filtrosAbiertos = signal(false);
  readonly papeleraAbierta = signal(false);
  readonly papelera = signal<GuiaPapelera[]>([]);
  readonly retiros = signal<RetiroHistorico[]>([]);
  readonly paginaRetiros = signal(0);
  readonly historial = signal<EventoGuia[]>([]);
  readonly correccionError = signal('');
  readonly correccionBusy = signal(false);
  readonly retiroAbierto = signal(false);
  readonly fotosEdicionAbierta = signal(false);
  readonly fotosEditando = signal(false);
  readonly fotosEdicionError = signal('');
  fotosPendientes: File[] = [];
  fotosPendientesUrls: string[] = [];
  motivoRetiro = '';
  retiroGuiaId: number | null = null;
  retiroNumeroGuia = '';
  private guiaEnRetiro: Llegada | null = null;
  private consultaListado = 0;
  private consultaDetalle = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  imagenes: File[] = [];
  vistasPrevias: string[] = [];
  form: { numeroGuia: string; cantidadDeclarada: number | null; cantidadRecibida: number | null; observacion: string } =
    { numeroGuia: '', cantidadDeclarada: 1, cantidadRecibida: 1, observacion: '' };
  numeroGuia = '';
  fechaFiltro = '';
  receptorFiltro = '';
  estadoFiltro = '';

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
  ngOnDestroy(): void { clearTimeout(this.temporizador); this.limpiarFotos(); this.descartarFotosPendientes(); }

  abrirNueva(): void { this.resetearNueva(); this.nuevaAbierta.set(true); }
  cerrarNueva(): void { if (!this.busy()) { this.nuevaAbierta.set(false); this.resetearNueva(); } }

  private resetearNueva(): void {
    this.vistasPrevias.forEach(url => { if (url) URL.revokeObjectURL(url); });
    this.vistasPrevias = [];
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
    this.vistasPrevias = [...this.vistasPrevias, ...nuevas.map(foto =>
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(foto) : '')];
    this.fieldErrors.update(actual => ({...actual, imagenes:this.errorImagenes()}));
  }

  quitarImagen(indice: number): void {
    if (this.vistasPrevias[indice]) URL.revokeObjectURL(this.vistasPrevias[indice]);
    this.vistasPrevias = this.vistasPrevias.filter((_, posicion) => posicion !== indice);
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
        this.resetearNueva();
        if (this.auth.can('INVENTARIO_CONSULTAR')) this.listar(0);
        if (this.auth.can('INVENTARIO_CONSULTAR')) this.abrir(llegada); },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 400) {
          const details = error.error as { errores?: Record<string, string> } | null;
          const fields = details?.errores ?? {};
          this.fieldErrors.set({ numeroGuia: fields['numeroGuia'],
            cantidadDeclarada: fields['cantidadDeclarada'], cantidadRecibida: fields['cantidadRecibida'],
            imagenes: fields['imagenes'] });
          const mensajeServidor = typeof error.error?.error === 'string' ? error.error.error : null;
          this.error.set(Object.keys(fields).length ? 'Corrige los campos marcados.'
            : mensajeServidor ?? this.message(error));
        } else this.error.set(this.message(error));
        this.busy.set(false);
      }
    });
  }

  abrir(llegada: Llegada): void {
    this.cerrarEdicionFotos();
    this.limpiarFotos();
    this.detalleAbierto.set(true);
    this.fotosError.set('');
    this.detail.set(null);
    this.correccionError.set('');
    this.historial.set([]);
    const consulta = ++this.consultaDetalle;
    this.searchBusy.set(true);
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (consulta !== this.consultaDetalle) return;
        this.detail.set(detalle); this.searchBusy.set(false); this.cargarFotos(llegada.id, consulta);
        this.cargarHistorial(llegada.id); },
      error: (error: unknown) => { if (consulta !== this.consultaDetalle) return;
        this.fotosError.set(this.message(error)); this.searchBusy.set(false); }
    });
  }

  cerrarDetalle(): void {
    this.cerrarEdicionFotos();
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

  private cargarHistorial(id: number): void {
    this.http.get<EventoGuia[]>(`/api/v1/llegadas/${id}/historial`).subscribe({
      next: eventos => this.historial.set(eventos), error: () => this.historial.set([])
    });
  }

  abrirPapelera(): void {
    this.papeleraAbierta.set(true);
    this.correccionError.set('');
    this.cargarPapelera();
    this.cargarRetiros(0);
  }

  private cargarPapelera(): void {
    this.http.get<GuiaPapelera[]>('/api/v1/llegadas/papelera').subscribe({
      next: guias => this.papelera.set(guias),
      error: error => this.correccionError.set(this.message(error))
    });
  }

  cargarRetiros(pagina: number): void {
    if (pagina < 0) return;
    this.http.get<RetiroHistorico[]>('/api/v1/llegadas/retiros', {params:{pagina}}).subscribe({
      next: eventos => { this.retiros.set(eventos); this.paginaRetiros.set(pagina); },
      error: error => this.correccionError.set(this.message(error))
    });
  }

  abrirRetiro(): void {
    const guia = this.detail()?.llegada;
    if (!guia) return;
    this.retiroGuiaId = guia.id;
    this.retiroNumeroGuia = guia.numeroGuia;
    this.guiaEnRetiro = guia;
    this.cerrarDetalle();
    this.motivoRetiro = '';
    this.correccionError.set('');
    this.retiroAbierto.set(true);
  }
  cerrarRetiro(): void {
    if (this.correccionBusy()) return;
    this.retiroAbierto.set(false);
    this.retiroGuiaId = null;
    this.retiroNumeroGuia = '';
    this.guiaEnRetiro = null;
    this.motivoRetiro = '';
    this.correccionError.set('');
  }
  cancelarRetiro(): void {
    if (this.correccionBusy()) return;
    const guia = this.guiaEnRetiro;
    this.cerrarRetiro();
    if (guia) this.abrir(guia);
  }

  retirar(): void {
    const id = this.retiroGuiaId;
    if (!id || this.motivoRetiro.trim().length < 10) {
      this.correccionError.set('Explica el motivo con al menos 10 caracteres.'); return;
    }
    this.correccionBusy.set(true); this.correccionError.set('');
    this.http.delete(`/api/v1/llegadas/${id}`, {body:{motivo:this.motivoRetiro.trim()}}).subscribe({
      next: () => { this.correccionBusy.set(false); this.cerrarRetiro(); this.listar(0); },
      error: error => { this.correccionBusy.set(false); this.correccionError.set(this.message(error)); }
    });
  }

  restaurar(guia: GuiaPapelera): void {
    this.correccionBusy.set(true); this.correccionError.set('');
    this.http.post(`/api/v1/llegadas/${guia.id}/restaurar`, {}).subscribe({
      next: () => { this.correccionBusy.set(false); this.cargarPapelera(); this.cargarRetiros(0); this.listar(0); },
      error: error => { this.correccionBusy.set(false); this.correccionError.set(this.message(error)); }
    });
  }

  abrirEdicionFotos(): void {
    this.descartarFotosPendientes();
    this.fotosEditando.set(false);
    this.fotosEdicionError.set('');
    this.fotosEdicionAbierta.set(true);
  }

  cerrarEdicionFotos(): void {
    if (this.correccionBusy()) return;
    this.fotosEdicionAbierta.set(false);
    this.fotosEditando.set(false);
    this.fotosEdicionError.set('');
    this.descartarFotosPendientes();
  }

  alternarEdicionFotos(): void {
    if (this.correccionBusy()) return;
    if (this.fotosEditando()) this.descartarFotosPendientes();
    this.fotosEdicionError.set('');
    this.fotosEditando.set(!this.fotosEditando());
  }

  seleccionarFotosCorreccion(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const nuevas = Array.from(input.files ?? []);
    input.value = '';
    if (!this.fotosEditando() || !nuevas.length) return;
    if (this.fotosPendientes.length + nuevas.length > 3 || nuevas.some(f =>
      !['image/jpeg','image/png'].includes(f.type) || f.size < 1 || f.size > 5 * 1024 * 1024)) {
      this.fotosEdicionError.set('Selecciona hasta tres fotos JPG o PNG, de 5 MB como máximo cada una.');
      return;
    }
    this.fotosPendientes.push(...nuevas);
    this.fotosPendientesUrls.push(...nuevas.map(foto =>
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(foto) : ''));
    this.fotosEdicionError.set('');
  }

  quitarFotoCorreccion(indice: number): void {
    if (!this.fotosEditando() || this.correccionBusy()) return;
    const url = this.fotosPendientesUrls[indice];
    if (url) URL.revokeObjectURL(url);
    this.fotosPendientes.splice(indice, 1);
    this.fotosPendientesUrls.splice(indice, 1);
  }

  private descartarFotosPendientes(): void {
    this.fotosPendientesUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
    this.fotosPendientes = [];
    this.fotosPendientesUrls = [];
  }

  guardarCorreccionFotos(): void {
    const id = this.detail()?.llegada.id;
    if (!this.fotosEdicionAbierta() || !this.fotosEditando() || !id || this.correccionBusy()) return;
    if (!this.fotosPendientes.length) {
      this.fotosEdicionError.set('Selecciona al menos una foto nueva antes de guardar.'); return;
    }
    const datos = new FormData();
    this.fotosPendientes.forEach(foto => datos.append('imagenes', foto, foto.name));
    this.correccionBusy.set(true); this.fotosEdicionError.set('');
    this.http.put(`/api/v1/llegadas/${id}/guias`, datos).subscribe({
      next: () => { this.correccionBusy.set(false); this.cerrarEdicionFotos(); this.limpiarFotos();
        this.cargarFotos(id, this.consultaDetalle); this.cargarHistorial(id); },
      error: error => { this.correccionBusy.set(false); this.fotosEdicionError.set(this.message(error)); }
    });
  }

  alCambiarFiltro(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.listar(0), 250);
  }

  limpiarFiltros(): void {
    clearTimeout(this.temporizador);
    this.numeroGuia = '';
    this.fechaFiltro = '';
    this.receptorFiltro = '';
    this.estadoFiltro = '';
    this.listar(0);
  }

  listar(pagina: number): void {
    if (pagina < 0) return;
    const consulta = ++this.consultaListado;
    this.searchError.set('');
    this.searchBusy.set(true);
    this.http.get<PaginaLlegadas>('/api/v1/llegadas/pagina',
      {params:{numeroGuia:this.numeroGuia.trim(),pagina,estado:this.estadoFiltro,
        ...(this.fechaFiltro ? {fecha:this.fechaFiltro} : {}),
        receptor:this.receptorFiltro.trim()}}).subscribe({
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
    if (error.status === 409) return typeof error.error?.error === 'string' ? error.error.error : 'La guía ya existe o no se puede modificar.';
    if (error.status === 413) return 'Las fotos superan el tamaño permitido.';
    if (error.status === 400) return typeof error.error?.error === 'string' ? error.error.error : 'Revisa los datos ingresados.';
    return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }
}
