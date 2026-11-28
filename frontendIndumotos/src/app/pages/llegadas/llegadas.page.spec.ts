import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LlegadasPage } from './llegadas.page';

describe('LlegadasPage', () => {
  it('permite quitar una foto y cancelar descarta todo el formulario', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'LLEGADAS_REGISTRAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.abrirNueva();
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
  it('lista todas las guías en páginas de diez y combina filtros', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'INVENTARIO_CONSULTAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina' && req.params.get('pagina') === '0'
      && req.params.get('numeroGuia') === '' && req.params.get('estado') === '')
      .flush({items:[],pagina:0,tamano:10,totalElementos:21,totalPaginas:3});
    const page = fixture.componentInstance;
    expect(page.paginaLlegadas()?.totalPaginas).toBe(3);
    page.numeroGuia = 'GR-'; page.fechaFiltro = '2026-11-27'; page.receptorFiltro = 'admin';
    page.estadoFiltro = 'CONFIRMADA'; page.listar(0);
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '0'
      && req.params.get('fecha') === '2026-11-27' && !req.params.has('cantidad')
      && req.params.get('receptor') === 'admin' && req.params.get('estado') === 'CONFIRMADA')
      .flush({items:[],pagina:0,tamano:10,totalElementos:11,totalPaginas:2});
    page.listar(1);
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '1')
      .flush({items:[],pagina:1,tamano:10,totalElementos:11,totalPaginas:2});
    expect(page.paginaLlegadas()?.pagina).toBe(1);
    page.limpiarFiltros();
    http.expectOne(req => req.params.get('estado') === '' && req.params.get('numeroGuia') === '' && req.params.get('pagina') === '0')
      .flush({items:[],pagina:0,tamano:10,totalElementos:2,totalPaginas:1});
    expect(page.estadoFiltro).toBe('');
    expect(page.paginaLlegadas()?.totalElementos).toBe(2);
    http.verify();
  });

  it('restaura una guía desde papelera y actualiza el listado', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:() => true}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
    const page = fixture.componentInstance;
    page.abrirPapelera();
    http.expectOne('/api/v1/llegadas/papelera').flush([{id:9,numeroGuia:'TG01-38359',
      eliminadoEn:'2026-11-27T10:00:00Z',eliminadoPor:'almacen',motivo:'Registro duplicado',
      venceEn:'2026-12-27T10:00:00Z'}]);
    http.expectOne(req => req.url === '/api/v1/llegadas/retiros' && req.params.get('pagina') === '0').flush([]);
    expect(page.papelera().length).toBe(1);
    page.restaurar(page.papelera()[0]);
    http.expectOne('/api/v1/llegadas/9/restaurar').flush(null);
    http.expectOne('/api/v1/llegadas/papelera').flush([]);
    http.expectOne(req => req.url === '/api/v1/llegadas/retiros').flush([]);
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:1,totalPaginas:1});
    expect(page.papelera().length).toBe(0);
    http.verify();
  });

  it('solo reemplaza fotos después de habilitar edición y guardar cambios', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:() => true}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
    const page = fixture.componentInstance;
    page.detail.set({llegada:{id:6,numeroGuia:'TG01-38359',fechaLlegada:'2026-11-27T10:00:00Z',
      receptorUsuario:'almacen',cantidadDeclarada:2,cantidadRecibida:2,observacion:null,estadoRegistro:'PENDIENTE'},
      fichas:[],cantidadFichas:0,diferenciaInformativa:2,confirmadoPor:null,confirmadoEn:null});
    page.abrirEdicionFotos();
    const foto = new File(['foto'], 'guia-corregida.jpg', {type:'image/jpeg'});
    page.seleccionarFotosCorreccion({target:{files:[foto],value:'seleccionada'}} as unknown as Event);
    expect(page.fotosPendientes).toEqual([]);
    http.expectNone('/api/v1/llegadas/6/guias');
    page.alternarEdicionFotos();
    page.seleccionarFotosCorreccion({target:{files:[foto],value:'seleccionada'}} as unknown as Event);
    expect(page.fotosPendientes).toHaveLength(1);
    page.cerrarEdicionFotos();
    expect(page.fotosPendientes).toEqual([]);
    http.expectNone('/api/v1/llegadas/6/guias');
    page.abrirEdicionFotos();
    page.alternarEdicionFotos();
    page.seleccionarFotosCorreccion({target:{files:[foto],value:'seleccionada'}} as unknown as Event);
    page.guardarCorreccionFotos();
    const request = http.expectOne('/api/v1/llegadas/6/guias');
    expect(request.request.method).toBe('PUT');
    expect((request.request.body as FormData).getAll('imagenes')).toHaveLength(1);
    request.flush(null);
    http.expectOne('/api/v1/llegadas/6/guias').flush([]);
    http.expectOne('/api/v1/llegadas/6/historial').flush([]);
    expect(page.fotosEdicionAbierta()).toBe(false);
    http.verify();
  });

  it('despliega filtros dentro de la barra y oculta el texto introductorio', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'INVENTARIO_CONSULTAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
    fixture.detectChanges();
    const barra = fixture.nativeElement.querySelector('.arrival-toolbar') as HTMLElement;
    const tabla = fixture.nativeElement.querySelector('.table-wrap') as HTMLElement;
    expect(barra.querySelector('.toolbar-intro')).not.toBeNull();
    (barra.querySelector('.filter-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(barra.querySelector('.toolbar-intro')).toBeNull();
    expect(barra.querySelector('#arrival-filters')).not.toBeNull();
    expect(barra.querySelector('.filter-grid .clear-filters')).not.toBeNull();
    expect(barra.querySelectorAll('.filter-grid label')).toHaveLength(4);
    expect(tabla.parentElement).toBe(barra.parentElement);
    (barra.querySelector('.filter-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(barra.querySelector('.toolbar-intro')).not.toBeNull();
    http.verify();
  });

  it('cierra el detalle antes de pedir el motivo y retira la guía seleccionada', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:() => true}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:1,totalPaginas:1});
    const page = fixture.componentInstance;
    const detalle = {llegada:{id:6,numeroGuia:'TG01-38359',fechaLlegada:'2026-11-27T10:00:00Z',
      receptorUsuario:'almacen',cantidadDeclarada:2,cantidadRecibida:2,observacion:null,estadoRegistro:'PENDIENTE' as const},
      fichas:[],cantidadFichas:0,diferenciaInformativa:2,confirmadoPor:null,confirmadoEn:null};
    page.detail.set(detalle);
    page.detalleAbierto.set(true);
    page.abrirRetiro();
    fixture.detectChanges();
    expect(page.detalleAbierto()).toBe(false);
    expect(page.detail()).toBeNull();
    expect(page.retiroAbierto()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('#retirar-guia-titulo')?.textContent).toContain('TG01-38359');
    (fixture.nativeElement.querySelector('.dialog-actions .secondary-button') as HTMLButtonElement).click();
    expect(page.detalleAbierto()).toBe(true);
    expect(page.retiroAbierto()).toBe(false);
    expect(page.retiroGuiaId).toBeNull();
    http.expectNone('/api/v1/llegadas/6');
    http.expectOne('/api/v1/llegadas/6/detalle').flush(detalle);
    http.expectOne('/api/v1/llegadas/6/guias').flush([]);
    http.expectOne('/api/v1/llegadas/6/historial').flush([]);
    page.cerrarDetalle();
    page.detail.set(detalle);
    page.detalleAbierto.set(true);
    page.abrirRetiro();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.correction-overlay .im-dialog-close') as HTMLButtonElement).click();
    expect(page.detalleAbierto()).toBe(false);
    expect(page.retiroAbierto()).toBe(false);
    page.detail.set(detalle);
    page.detalleAbierto.set(true);
    page.abrirRetiro();
    page.motivoRetiro = 'La foto no corresponde a esta guía';
    page.retirar();
    const request = http.expectOne('/api/v1/llegadas/6');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({motivo:'La foto no corresponde a esta guía'});
    request.flush(null);
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
    expect(page.retiroAbierto()).toBe(false);
    expect(page.retiroGuiaId).toBeNull();
    http.verify();
  });
});
