import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-fichas-page',
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './fichas.page.html',
  styleUrl: './fichas.page.css'
})
export class FichasPage implements OnInit {
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
  readonly verRegistradas = signal(false);
  readonly guiasBusy = signal(false);
  readonly ocrBusy = signal(false);
  readonly ocrMensaje = signal('');
  readonly llegadaSeleccionada = signal<LlegadaOpcion | null>(null);
  readonly opciones = signal<OpcionMotocicleta[]>([]);
  readonly marcas = signal<string[]>([]);
  readonly catalogoError = signal('');
  guiaBusqueda = '';
  private temporizadorGuia?: ReturnType<typeof setTimeout>;
  private consultaGuias = 0;
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
    this.llegadaSeleccionada.set(null);
    this.detalleLlegada.set(null);
    this.form.llegadaId = null;
    this.bloques.set([]);
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
    this.form.llegadaId = llegada.id; this.llegadaSeleccionada.set(llegada);
    this.guiaBusqueda = llegada.numeroGuia;
    this.detalleLlegada.set(null); this.bloques.set([]); this.verRegistradas.set(false);
    this.ocrMensaje.set(''); this.ocrBusy.set(false); this.error.set('');
    this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegada.id}/detalle`).subscribe({
      next: detalle => { if (this.form.llegadaId !== llegada.id) return;
        this.detalleLlegada.set(detalle);
        const pendientes = Math.max(0, detalle.llegada.cantidadRecibida - detalle.cantidadFichas);
        this.bloques.set(Array.from({length:pendientes}, () => this.nuevoBloque()));
      },
      error: err => this.error.set(apiError(err))
    });
  }

  private nuevoBloque(): BorradorMoto {
    return {marca:'',modelo:'',color:'',chasisCompleto:'',numeroMotor:'',dua:'',itemDua:'',
      guardada:false,error:'',fieldErrors:{}};
  }

  pendientesEnPantalla(): number {
    return this.bloques().filter(bloque => !bloque.guardada).length;
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
        this.bloques().forEach(bloque => {
          if (bloque.chasisCompleto.trim()) existentes.add(bloque.chasisCompleto.trim().toUpperCase());
        });
        const sugerencias = resultado.sugerencias.filter(sugerencia =>
          !existentes.has(sugerencia.chasisCompleto.trim().toUpperCase()));
        let indice = 0;
        this.bloques.update(actual => actual.map(bloque => {
          if (bloque.guardada || bloque.sugerida || bloque.chasisCompleto || bloque.numeroMotor
            || bloque.marca || bloque.modelo || bloque.color || bloque.dua || bloque.itemDua
            || indice >= sugerencias.length) return bloque;
          const sugerencia = sugerencias[indice++];
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
    if (!bloque || bloque.guardada || this.busy() || !llegadaId) return;
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
    const datos = {llegadaId,marca:bloque.marca,modelo:bloque.modelo,color:bloque.color,
      chasisCompleto:bloque.chasisCompleto,numeroMotor:bloque.numeroMotor,dua:bloque.dua,itemDua:bloque.itemDua};
    this.http.post<Ficha>('/api/v1/motocicletas', datos).subscribe({
      next: value => { this.created.set(value); this.busy.set(false);
        this.actualizarBloque(indice, {guardada:true,error:'',fieldErrors:{}});
        this.http.get<DetalleLlegada>(`/api/v1/llegadas/${llegadaId}/detalle`).subscribe({
          next: detalle => { if (this.form.llegadaId === llegadaId) this.detalleLlegada.set(detalle); },
          error: err => this.error.set(apiError(err))
        });
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
