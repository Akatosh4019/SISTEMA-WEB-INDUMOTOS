import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
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
  it('lista todas las guías en páginas de diez y conserva el filtro', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'INVENTARIO_CONSULTAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina' && req.params.get('pagina') === '0'
      && req.params.get('numeroGuia') === '').flush({items:[],pagina:0,tamano:10,totalElementos:21,totalPaginas:3});
    const page = fixture.componentInstance;
    expect(page.paginaLlegadas()?.totalPaginas).toBe(3);
    page.numeroGuia = 'GR-'; page.buscarGuia();
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '0')
      .flush({items:[],pagina:0,tamano:10,totalElementos:11,totalPaginas:2});
    page.listar(1);
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '1')
      .flush({items:[],pagina:1,tamano:10,totalElementos:11,totalPaginas:2});
    expect(page.paginaLlegadas()?.pagina).toBe(1);
    http.verify();
  });
});
