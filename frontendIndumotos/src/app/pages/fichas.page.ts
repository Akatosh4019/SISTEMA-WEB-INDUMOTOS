import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

interface Ficha {
  id: number; llegadaId: number; marca: string; modelo: string; color: string;
  chasisCompleto: string; numeroMotor: string; dua: string; itemDua: string;
  creadorUsuario: string; creadoEn: string;
}
interface LlegadaOpcion { id: number; numeroGuia: string; fechaLlegada: string; receptorUsuario: string; cantidadDeclarada: number; cantidadRecibida: number }
interface PaginaLlegadas { items: LlegadaOpcion[]; pagina: number; totalPaginas: number; totalElementos: number }
interface DetalleLlegada { llegada: LlegadaOpcion; fichas: Ficha[]; cantidadFichas: number; diferenciaInformativa: number }
interface OpcionMotocicleta { marca: string; modelo: string; color: string }
interface BorradorMoto { marca: string; modelo: string; color: string; chasisCompleto: string;
  numeroMotor: string; dua: string; itemDua: string; guardada: boolean; error: string;
  fieldErrors: Record<string, string>; existingId?: number; sugerida?: boolean }
interface SugerenciaOcr { marca: string; modelo: string; color: string; chasisCompleto: string;
  numeroMotor: string; dua: string; itemDua: string; pagina: number }
interface ResultadoOcr { fotosAnalizadas: number; sugerencias: SugerenciaOcr[] }
interface FotoGuia { id: number; orden: number; nombreArchivo: string; url: string }
interface EstadoRegistro { terminado: boolean; recibidas: number; registradas: number;
  borradores: (BorradorMoto & {posicion: number})[] }

@Component({
  selector: 'app-fichas-page',
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './fichas.page.html',
  styleUrl: './fichas.page.css'
})
export class FichasPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly searchBusy = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly searchError = signal('');
  readonly created = signal<Ficha | null>(null);
  readonly existingId = signal<number | null>(null);
  readonly found = signal<Ficha | null>(null);
  readonly modoDetalle = signal(false);
  readonly editando = signal(false);
  readonly editError = signal('');
  readonly editSuccess = signal(false);
  readonly llegadas = signal<LlegadaOpcion[]>([]);
  readonly paginaLlegadas = signal<PaginaLlegadas | null>(null);
  readonly detalleLlegada = signal<DetalleLlegada | null>(null);
  readonly bloques = signal<BorradorMoto[]>([]);
  readonly registroTerminado = signal(false);
  readonly registroCargado = signal(false);
  readonly paginaBloques = signal(0);
  readonly borradoresBusy = signal(false);
  readonly finalizando = signal(false);
  readonly verRegistradas = signal(false);
  readonly guiasBusy = signal(false);
  readonly ocrBusy = signal(false);
  readonly ocrMensaje = signal('');
  readonly llegadaSeleccionada = signal<LlegadaOpcion | null>(null);
  readonly fotosGuia = signal<FotoGuia[]>([]);
  readonly fotosCargando = signal(false);
  readonly fotosError = signal('');
  readonly paginaFoto = signal(0);
  readonly zoomFoto = signal(1);
  readonly opciones = signal<OpcionMotocicleta[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly catalogoError = signal('');
  guiaBusqueda = '';
  private temporizadorGuia?: ReturnType<typeof setTimeout>;
  private consultaGuias = 0;
  private consultaFotos = 0;
  private arrastreFoto?: {x:number;y:number;izquierda:number;arriba:number};
  edicion = { marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  form = { llegadaId: null as number | null, marca: '', modelo: '', color: '', chasisCompleto: '', numeroMotor: '', dua: '', itemDua: '' };
  searchId: number | null = null;

  ngOnInit(): void {
    if (this.auth.can('FICHAS_REGISTRAR') || this.auth.can('FICHAS_EDITAR')) this.cargarCatalogo();
    if (this.auth.can('FICHAS_REGISTRAR') && this.auth.can('INVENTARIO_CONSULTAR')) this.buscarLlegadas();
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      const llegadaId = Number(params.get('llegadaId'));
      this.modoDetalle.set(!params.has('nuevo') && Number.isSafeInteger(id) && id > 0);
      this.editando.set(false); this.editSuccess.set(false);
      if (Number.isSafeInteger(llegadaId) && llegadaId > 0) {
        this.form.llegadaId = llegadaId;
        this.http.get<LlegadaOpcion>(`/api/v1/llegadas/${llegadaId}`).subscribe({
          next: llegada => this.seleccionarLlegada(llegada),
          error: err => this.error.set(apiError(err))
        });
      }
      if (this.modoDetalle()) { this.searchId = id; this.buscar(); }
      else { this.found.set(null); this.searchId = null; }
    });
  }

  ngOnDestroy(): void { clearTimeout(this.temporizadorGuia); this.limpiarFotos(); }

  private limpiarFotos(): void {
    ++this.consultaFotos;
    this.fotosGuia().forEach(foto => URL.revokeObjectURL(foto.url));
    this.fotosGuia.set([]); this.paginaFoto.set(0); this.zoomFoto.set(1);
    this.fotosCargando.set(false); this.fotosError.set('');
  }

  private cargarFotos(llegadaId: number): void {
    const consulta = this.consultaFotos;
    this.fotosCargando.set(true);
    this.http.get<FotoGuia[]>(`/api/v1/llegadas/${llegadaId}/guias`).subscribe({
      next: imagenes => {
        if (consulta !== this.consultaFotos) return;
        if (!imagenes.length) { this.fotosCargando.set(false); return; }
        let pendientes = imagenes.length;
        for (const imagen of imagenes) {
          this.http.get(`/api/v1/llegadas/${llegadaId}/guias/${imagen.id}`, {responseType:'blob'}).subscribe({
            next: blob => {
              if (consulta === this.consultaFotos) this.fotosGuia.update(actual =>
                [...actual, {...imagen, url:URL.createObjectURL(blob)}].sort((a,b) => a.orden - b.orden));
              if (--pendientes === 0 && consulta === this.consultaFotos) this.fotosCargando.set(false);
            },
            error: () => {
              if (consulta === this.consultaFotos) this.fotosError.set('No se pudo cargar una foto de la guía.');
              if (--pendientes === 0 && consulta === this.consultaFotos) this.fotosCargando.set(false);
            }
          });
        }
      },
      error: err => { if (consulta === this.consultaFotos) {
        this.fotosError.set(apiError(err)); this.fotosCargando.set(false);
      } }
    });
  }

  cambiarPaginaFoto(direccion: number): void {
    this.paginaFoto.set(Math.max(0, Math.min(this.fotosGuia().length - 1, this.paginaFoto() + direccion)));
    this.zoomFoto.set(1);
  }

  cambiarZoom(direccion: number): void {
    this.zoomFoto.set(Math.max(1, Math.min(3, Math.round((this.zoomFoto() + direccion * .25) * 100) / 100)));
  }
  iniciarArrastreFoto(evento: PointerEvent): void {
    if (evento.pointerType === 'touch') return;
    const visor = evento.currentTarget as HTMLElement;
    this.arrastreFoto = {x:evento.clientX,y:evento.clientY,
      izquierda:visor.scrollLeft,arriba:visor.scrollTop};
    visor.setPointerCapture(evento.pointerId);
  }
  moverFoto(evento: PointerEvent): void {
    if (!this.arrastreFoto) return;
    const visor = evento.currentTarget as HTMLElement;
    visor.scrollLeft = this.arrastreFoto.izquierda - (evento.clientX - this.arrastreFoto.x);
    visor.scrollTop = this.arrastreFoto.arriba - (evento.clientY - this.arrastreFoto.y);
  }
  terminarArrastreFoto(): void { this.arrastreFoto = undefined; }

  bloquesPagina(): {bloque:BorradorMoto; indice:number}[] {
    return this.bloques().map((bloque,indice) => ({bloque,indice}))
      .slice(this.paginaBloques() * 5, (this.paginaBloques() + 1) * 5);
  }
  totalPaginasBloques(): number { return Math.max(1, Math.ceil(this.bloques().length / 5)); }
  cambiarPaginaBloques(pagina: number): void {
    this.paginaBloques.set(Math.max(0, Math.min(this.totalPaginasBloques() - 1,pagina)));
  }
  borradoresCompletos(): boolean {
    return !!this.detalleLlegada() && this.registroCargado() && !this.registroTerminado() && !this.borradoresBusy()
      && this.bloques().every(bloque => bloque.guardada);
  }

  cargarCatalogo(): void {
    this.http.get<OpcionMotocicleta[]>('/api/v1/catalogo-motocicletas').subscribe({
      next: opciones => { this.opciones.set(opciones); this.marcas.set([...new Set(opciones.map(o => o.marca))]); },
      error: err => this.catalogoError.set(apiError(err))
    });
  }

  modelos(marca: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca).map(o => o.modelo))];
  }

  colores(marca: string, modelo: string): string[] {
    return [...new Set(this.opciones().filter(o => o.marca === marca && o.modelo === modelo).map(o => o.color))];
  }

  alCambiarGuia(): void {
    clearTimeout(this.temporizadorGuia);
    this.limpiarFotos();
    this.llegadaSeleccionada.set(null);
    this.detalleLlegada.set(null);
    this.form.llegadaId = null;
    this.bloques.set([]);
    this.registroTerminado.set(false); this.registroCargado.set(false); this.paginaBloques.set(0);
    this.verRegistradas.set(false);
    this.ocrBusy.set(false);
    this.ocrMensaje.set('');
    this.temporizadorGuia = setTimeout(() => this.buscarLlegadas(), 300);
  }

  buscarLlegadas(pagina = 0): void {
    clearTimeout(this.temporizadorGuia);
    const consulta = ++this.consultaGuias;
    this.guiasBusy.set(true);
    this.http.get<PaginaLlegadas>('/api/v1/llegadas/pagina',
      {params:{numeroGuia:this.guiaBusqueda.trim(),pagina}}).subscribe({
      next: resultado => { if (consulta !== this.consultaGuias) return;
        this.paginaLlegadas.set(resultado); this.llegadas.set(resultado.items); this.guiasBusy.set(false); },
      error: err => { if (consulta !== this.consultaGuias) return;
        this.error.set(apiError(err)); this.guiasBusy.set(false); }
    });
  }

  seleccionarLlegada(llegada: LlegadaOpcion): void {
    this.limpiarFotos();
    this.form.llegadaId = llegada.id; this.llegadaSeleccionada.set(llegada);
    this.cargarFotos(llegada.id);
    this.guiaBusqueda = llegada.numeroGuia;
    this.detalleLlegada.set(null); this.bloques.set([]); this.verRegistradas.set(false);
    this.registroTerminado.set(false); this.registroCargado.set(false);
    this.paginaBloques.set(0); this.borradoresBusy.set(true);
    this.ocrMensaje.set(''); this.ocrBusy.set(false); this.error.set('');
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (this.form.llegadaId !== llegada.id) return;
        this.detalleLlegada.set(detalle);
        const pendientes = Math.max(0, detalle.llegada.cantidadRecibida - detalle.cantidadFichas);
        this.http.get<EstadoRegistro>(`/api/v1/llegadas/${llegada.id}/registro`).subscribe({
          next: estado => { if (this.form.llegadaId !== llegada.id) return;
            this.registroTerminado.set(estado.terminado);
            this.registroCargado.set(true);
            const borradores = new Map(estado.borradores.map(b => [b.posicion,b]));
            this.bloques.set(estado.terminado ? [] : Array.from({length:pendientes},(_,i) => {
              const guardado = borradores.get(i + 1);
              return guardado ? {...this.nuevoBloque(),...guardado,guardada:true} : this.nuevoBloque();
            }));
            this.borradoresBusy.set(false);
          }, error: err => { this.error.set(apiError(err)); this.borradoresBusy.set(false); }
        });
      },
      error: err => { this.error.set(apiError(err)); this.borradoresBusy.set(false); }
    });
  }

  private nuevoBloque(): BorradorMoto {
    return {marca:'',modelo:'',color:'',chasisCompleto:'',numeroMotor:'',dua:'',itemDua:'',
      guardada:false,error:'',fieldErrors:{}};
  }

  pendientesEnPantalla(): number {
    return this.bloques().filter(bloque => !bloque.guardada).length;
  }

  finalizarRegistro(): void {
    const llegada = this.llegadaSeleccionada();
    if (!llegada || !this.borradoresCompletos() || this.finalizando()) return;
    this.finalizando.set(true); this.error.set('');
    this.http.post<EstadoRegistro>(`/api/v1/llegadas/${llegada.id}/registro/finalizar`,{}).subscribe({
      next: estado => { this.finalizando.set(false); this.registroTerminado.set(estado.terminado);
        this.bloques.set([]); this.paginaBloques.set(0);
        this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
          next: detalle => { if (this.llegadaSeleccionada()?.id === llegada.id) this.detalleLlegada.set(detalle); },
          error: err => this.error.set(apiError(err))
        });
      }, error: err => { this.error.set(apiError(err)); this.finalizando.set(false); }
    });
  }

  autocompletar(): void {
    const llegada = this.llegadaSeleccionada();
    if (!llegada || this.ocrBusy()) return;
    this.ocrBusy.set(true); this.ocrMensaje.set('');
    this.http.get<ResultadoOcr>(`/api/v1/llegadas/${llegada.id}/sugerencias-ocr`).subscribe({
      next: resultado => {
        if (this.llegadaSeleccionada()?.id !== llegada.id) return;
        const existentes = new Set((this.detalleLlegada()?.fichas ?? [])
          .map(ficha => ficha.chasisCompleto.trim().toUpperCase()));
        const sugerencias = resultado.sugerencias.filter(sugerencia =>
          !existentes.has(sugerencia.chasisCompleto.trim().toUpperCase()));
        let indice = 0;
        const usadas = new Set<string>();
        this.bloques.update(actual => actual.map(bloque => {
          if (bloque.guardada) return bloque;
          const sugerencia = bloque.chasisCompleto.trim()
            ? sugerencias.find(item => item.chasisCompleto.toUpperCase() === bloque.chasisCompleto.trim().toUpperCase())
            : sugerencias.find(item => !usadas.has(item.chasisCompleto.toUpperCase())
                && !actual.some(otro => otro !== bloque && otro.chasisCompleto.trim().toUpperCase() === item.chasisCompleto.toUpperCase()));
          if (!sugerencia) return bloque;
          usadas.add(sugerencia.chasisCompleto.toUpperCase());
          indice++;
          const marca = this.coincidencia(this.marcas(), sugerencia.marca);
          const modelo = this.coincidencia(this.modelos(marca), sugerencia.modelo);
          const color = this.coincidencia(this.colores(marca, modelo), sugerencia.color);
          return {...bloque, marca:bloque.marca || marca, modelo:bloque.modelo || modelo,
            color:bloque.color || color, chasisCompleto:bloque.chasisCompleto || sugerencia.chasisCompleto,
            numeroMotor:bloque.numeroMotor || sugerencia.numeroMotor, dua:bloque.dua || sugerencia.dua,
            itemDua:bloque.itemDua || sugerencia.itemDua, sugerida:true};
        }));
        this.ocrMensaje.set(indice
          ? `Se propusieron datos para ${indice} moto${indice === 1 ? '' : 's'} desde ${resultado.fotosAnalizadas} foto${resultado.fotosAnalizadas === 1 ? '' : 's'}. Revisa todos los caracteres antes de guardar.`
          : 'No se pudieron reconocer chasis en las fotos. Completa los bloques manualmente.');
        this.ocrBusy.set(false);
      }, error: err => { this.ocrMensaje.set(apiError(err)); this.ocrBusy.set(false); }
    });
  }

  private coincidencia(opciones: string[], texto: string): string {
    const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lectura = normalizar(texto || '');
    return opciones.find(opcion => lectura.includes(normalizar(opcion))) ?? '';
  }

  iniciarEdicion(ficha: Ficha): void {
    this.edicion = { marca: ficha.marca, modelo: ficha.modelo, color: ficha.color,
      chasisCompleto: ficha.chasisCompleto, numeroMotor: ficha.numeroMotor,
      dua: ficha.dua, itemDua: ficha.itemDua };
    this.editError.set(''); this.editSuccess.set(false); this.editando.set(true);
  }

  actualizar(): void {
    const ficha = this.found();
    if (!ficha || this.busy()) return;
    this.editError.set(''); this.editSuccess.set(false); this.busy.set(true);
    this.http.put<Ficha>(`/api/v1/motocicletas/${ficha.id}`, this.edicion).subscribe({
      next: actualizada => { this.found.set(actualizada); this.busy.set(false); this.editando.set(false); this.editSuccess.set(true); },
      error: err => { this.editError.set(apiError(err)); this.busy.set(false); }
    });
  }
  guardarBloque(indice: number): void {
    const bloque = this.bloques()[indice];
    const llegadaId = this.form.llegadaId;
    if (!bloque || this.registroTerminado() || this.busy() || !llegadaId) return;
    this.error.set('');
    const mensajes: Record<string, string> = {
      marca: 'Ingresa la marca.', modelo: 'Ingresa el modelo.', color: 'Ingresa el color.',
      chasisCompleto: 'Ingresa el chasis completo.', numeroMotor: 'Ingresa el número de motor.',
      dua: 'Ingresa la DUA.', itemDua: 'Ingresa el ítem de DUA.'
    };
    const errores: Record<string, string> = {};
    for (const [campo, mensaje] of Object.entries(mensajes)) {
      if (!String(bloque[campo as keyof BorradorMoto] ?? '').trim()) errores[campo] = mensaje;
    }
    if (Object.keys(errores).length) {
      this.actualizarBloque(indice, {fieldErrors:errores,error:'Completa los campos de esta motocicleta.'}); return;
    }
    this.actualizarBloque(indice, {fieldErrors:{},error:'',existingId:undefined});
    this.busy.set(true);
    const datos = {posicion:indice + 1,marca:bloque.marca,modelo:bloque.modelo,color:bloque.color,
      chasisCompleto:bloque.chasisCompleto,numeroMotor:bloque.numeroMotor,dua:bloque.dua,itemDua:bloque.itemDua};
    this.http.put<EstadoRegistro>(`/api/v1/llegadas/${llegadaId}/registro/borradores/${indice + 1}`, datos).subscribe({
      next: () => { this.busy.set(false);
        this.actualizarBloque(indice, {guardada:true,error:'',fieldErrors:{}});
      },
      error: err => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          const body = err.error as { fichaExistenteId?: number } | null;
          this.actualizarBloque(indice, {existingId:body?.fichaExistenteId,
            error:'El chasis completo ya está registrado.'});
        } else if (err instanceof HttpErrorResponse && err.status === 400) {
          const body = err.error as { errores?: Record<string, string> } | null;
          this.actualizarBloque(indice, {fieldErrors:body?.errores ?? {},
            error:body?.errores && Object.keys(body.errores).length
              ? 'Corrige los campos marcados.' : 'Revisa el formato de la ficha.'});
        } else this.actualizarBloque(indice, {error:apiError(err)});
        this.busy.set(false);
      }
    });
  }

  private actualizarBloque(indice: number, cambios: Partial<BorradorMoto>): void {
    this.bloques.update(actual => actual.map((bloque, posicion) =>
      posicion === indice ? {...bloque,...cambios} : bloque));
  }

  verExistente(id: number): void {
    this.searchId = id;
    this.modoDetalle.set(true);
    this.buscar();
  }

  buscar(): void {
    this.found.set(null); this.searchError.set('');
    if (!this.searchId || this.searchId < 1) { this.searchError.set('No se pudo identificar la ficha seleccionada.'); return; }
    this.searchBusy.set(true);
    this.http.get<Ficha>(`/api/v1/motocicletas/${this.searchId}`).subscribe({
      next: value => { this.found.set(value); this.searchBusy.set(false); },
      error: err => { this.searchError.set(apiError(err)); this.searchBusy.set(false); }
    });
  }
}
