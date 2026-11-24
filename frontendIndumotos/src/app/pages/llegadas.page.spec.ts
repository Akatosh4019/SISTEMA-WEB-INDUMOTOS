import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import { LlegadasPage } from './llegadas.page';

describe('LlegadasPage', () => {
  const llegada = (estado: 'PENDIENTE' | 'CONFIRMADA' = 'PENDIENTE', id = 7) => ({
    id, numeroGuia:`GR-${id}`, fechaLlegada:'2026-11-24T14:30:00Z', receptorUsuario:'Jade Sanchez',
    cantidadDeclarada:3, cantidadRecibida:3, observacion:null, estadoRegistro:estado
  });
  const pagina = (items: ReturnType<typeof llegada>[]) =>
    ({items,pagina:0,tamano:10,totalElementos:items.length,totalPaginas:1});
  const configurar = (permisos: string[] = ['INVENTARIO_CONSULTAR']) => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permisos.includes(permiso)}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return {fixture,http,page:fixture.componentInstance};
  };
  it('permite quitar una foto y cancelar descarta todo el formulario', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'LLEGADAS_REGISTRAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    (fixture.nativeElement.querySelector('.new-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#nueva-llegada-titulo')?.textContent).toBe('Nueva llegada');
    page.form.numeroGuia = 'GUIA-EQUIVOCADA';
    page.form.observacion = 'Borrador';
    const primera = new File(['uno'], 'primera.jpg', {type:'image/jpeg'});
    const segunda = new File(['dos'], 'segunda.jpg', {type:'image/jpeg'});
    const input = {files:[primera, segunda], value:'seleccionadas'};
    page.seleccionarImagenes({target:input} as unknown as Event);
    expect(input.value).toBe('');
    expect(page.imagenes.length).toBe(2);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.remove-file') as HTMLButtonElement).click();
    expect(page.imagenes.map(foto => foto.name)).toEqual(['segunda.jpg']);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dialog-actions .secondary-button') as HTMLButtonElement).click();
    expect(page.nuevaAbierta()).toBe(false);
    expect(page.imagenes).toEqual([]);
    expect(page.form.numeroGuia).toBe('');
    expect(page.form.observacion).toBe('');
    page.abrirNueva();
    expect(page.imagenes).toEqual([]);
    expect(page.form.numeroGuia).toBe('');
    http.expectNone('/api/v1/llegadas/con-guia');
    http.verify();
  });
  it('exige foto y envía la guía como formulario multipart', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'LLEGADAS_REGISTRAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.form.numeroGuia = 'TG01-38359';
    page.form.cantidadDeclarada = 2;
    page.form.cantidadRecibida = 2;
    page.registrar();
    expect(page.fieldErrors().imagenes).toContain('foto');
    http.expectNone('/api/v1/llegadas/con-guia');
    page.imagenes = [new File(['foto'], 'guia.jpg', {type:'image/jpeg'})];
    page.registrar();
    const request = http.expectOne('/api/v1/llegadas/con-guia');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('numeroGuia')).toBe('TG01-38359');
    expect((request.request.body as FormData).getAll('imagenes').length).toBe(1);
    request.flush({id:5,numeroGuia:'TG01-38359'});
    http.verify();
  });
  it('lista todas las guías en páginas de diez y conserva el filtro', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'INVENTARIO_CONSULTAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina' && req.params.get('pagina') === '0'
      && req.params.get('numeroGuia') === '' && req.params.get('estado') === 'PENDIENTE')
      .flush({items:[],pagina:0,tamano:10,totalElementos:21,totalPaginas:3});
    const page = fixture.componentInstance;
    expect(page.paginaLlegadas()?.totalPaginas).toBe(3);
    page.numeroGuia = 'GR-'; page.buscarGuia();
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '0')
      .flush({items:[],pagina:0,tamano:10,totalElementos:11,totalPaginas:2});
    page.listar(1);
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '1')
      .flush({items:[],pagina:1,tamano:10,totalElementos:11,totalPaginas:2});
    expect(page.paginaLlegadas()?.pagina).toBe(1);
    page.cambiarEstado('CONFIRMADA');
    http.expectOne(req => req.params.get('estado') === 'CONFIRMADA' && req.params.get('pagina') === '0')
      .flush({items:[],pagina:0,tamano:10,totalElementos:2,totalPaginas:1});
    expect(page.estadoActivo()).toBe('CONFIRMADA');
    expect(page.paginaLlegadas()?.totalElementos).toBe(2);
    http.verify();
  });

  it('muestra responsable, fecha real y estado sin deducirlo de las cantidades', () => {
    const {fixture,http} = configurar();
    http.expectOne('/api/v1/llegadas/pagina?numeroGuia=&pagina=0&estado=PENDIENTE')
      .flush(pagina([llegada('PENDIENTE')]));
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Jade Sanchez');
    expect(texto).toContain('24/11/2026');
    expect(texto).toContain('09:30');
    expect(texto).toContain('3/3');
    expect(texto).toContain('Pendiente');
    expect(texto).not.toContain('Confirmada');
    http.verify();
  });

  it('cancela la búsqueda automática al buscar manualmente, cambiar pestaña o paginar', () => {
    vi.useFakeTimers();
    const {http,page} = configurar();
    http.expectOne(req => req.params.get('estado') === 'PENDIENTE').flush(pagina([]));
    page.numeroGuia = 'GR-20';
    page.alCambiarGuia();
    page.buscarGuia();
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-20').flush(pagina([]));
    vi.advanceTimersByTime(350);
    http.expectNone('/api/v1/llegadas/pagina');
    page.alCambiarGuia();
    page.cambiarEstado('CONFIRMADA');
    http.expectOne(req => req.params.get('estado') === 'CONFIRMADA').flush(pagina([]));
    vi.advanceTimersByTime(350);
    http.expectNone('/api/v1/llegadas/pagina');
    page.alCambiarGuia();
    page.cambiarPagina(1);
    http.expectOne(req => req.params.get('pagina') === '1').flush({...pagina([]),pagina:1});
    vi.advanceTimersByTime(350);
    http.expectNone('/api/v1/llegadas/pagina');
    vi.useRealTimers();
    http.verify();
  });

  it('mantiene independiente el error del detalle y deja de cargar cuando falla', () => {
    const {fixture,http,page} = configurar();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush(pagina([]));
    page.abrir(llegada());
    http.expectOne('/api/v1/llegadas/7/detalle').flush({}, {status:500,statusText:'Error'});
    fixture.detectChanges();
    expect(page.detailError()).toContain('servidor');
    expect(page.fotosError()).toBe('');
    expect(page.detailBusy()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Cargando detalle…');
    http.verify();
  });

  it('cancela el detalle anterior al cambiar de guía o cerrar la ventana', () => {
    const {http,page} = configurar();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush(pagina([]));
    page.abrir(llegada('PENDIENTE', 7));
    const anterior = http.expectOne('/api/v1/llegadas/7/detalle');
    page.abrir(llegada('PENDIENTE', 8));
    expect(anterior.cancelled).toBe(true);
    const actual = http.expectOne('/api/v1/llegadas/8/detalle');
    page.cerrarDetalle();
    expect(actual.cancelled).toBe(true);
    expect(page.detalleAbierto()).toBe(false);
    expect(page.detail()).toBeNull();
    http.verify();
  });

  it('conserva fotos válidas si otra falla y libera sus URL al cerrar', () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto-1');
    const liberar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const {fixture,http,page} = configurar();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush(pagina([]));
    page.abrir(llegada());
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:llegada(),fichas:[],cantidadFichas:0,diferenciaInformativa:3});
    http.expectOne('/api/v1/llegadas/7/guias').flush([
      {id:1,orden:1,nombreArchivo:'pagina-1.jpg',tipoMime:'image/jpeg',tamano:20},
      {id:2,orden:2,nombreArchivo:'pagina-2.jpg',tipoMime:'image/jpeg',tamano:20}
    ]);
    http.expectOne('/api/v1/llegadas/7/guias/1').flush(new Blob(['foto'],{type:'image/jpeg'}));
    http.expectOne('/api/v1/llegadas/7/guias/2').flush(new Blob([], {type:'application/json'}), {status:500,statusText:'Error'});
    fixture.detectChanges();
    expect(page.fotos().map(foto => foto.nombreArchivo)).toEqual(['pagina-1.jpg']);
    expect(page.fotosError()).toContain('demás continúan disponibles');
    expect(crear).toHaveBeenCalledTimes(1);
    page.cerrarDetalle();
    expect(liberar).toHaveBeenCalledWith('blob:foto-1');
    crear.mockRestore(); liberar.mockRestore();
    http.verify();
  });

  it('muestra fichas y continuar registro solo para una guía pendiente con permiso', () => {
    const {fixture,http,page} = configurar(['INVENTARIO_CONSULTAR','FICHAS_REGISTRAR']);
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush(pagina([]));
    page.abrir(llegada());
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:llegada(),cantidadFichas:1,diferenciaInformativa:2,
      fichas:[{id:91,llegadaId:7,marca:'Honda',modelo:'CB',color:'Rojo',chasisCompleto:'CHASIS-91'}]});
    http.expectOne('/api/v1/llegadas/7/guias').flush([]);
    fixture.detectChanges();
    const ficha = fixture.nativeElement.querySelector('.open-record') as HTMLAnchorElement;
    const continuar = fixture.nativeElement.querySelector('.new-ficha-link') as HTMLAnchorElement;
    expect(ficha.textContent).toContain('Abrir ficha');
    expect(ficha.getAttribute('href')).toContain('/app/inventario?id=91');
    expect(continuar.getAttribute('href')).toContain('/app/fichas?llegadaId=7');
    page.cerrarDetalle();
    page.abrir(llegada('CONFIRMADA'));
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:llegada('CONFIRMADA'),cantidadFichas:0,diferenciaInformativa:0,fichas:[]});
    http.expectOne('/api/v1/llegadas/7/guias').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.new-ficha-link')).toBeNull();
    http.verify();
  });

  it('oculta registro y nueva llegada cuando faltan permisos', () => {
    const {fixture,http,page} = configurar(['INVENTARIO_CONSULTAR']);
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush(pagina([]));
    expect(fixture.nativeElement.querySelector('.new-button')).toBeNull();
    page.abrir(llegada());
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:llegada(),cantidadFichas:0,diferenciaInformativa:3,fichas:[]});
    http.expectOne('/api/v1/llegadas/7/guias').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.new-ficha-link')).toBeNull();
    http.verify();
  });
});
