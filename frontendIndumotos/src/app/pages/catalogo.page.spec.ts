import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogoPage } from './catalogo.page';

describe('CatalogoPage', () => {
  const habilitada = {id:1,marca:'Honda',modelo:'CB',color:'Rojo',habilitado:true};
  const deshabilitada = {id:2,marca:'Bajaj',modelo:'Pulsar',color:'Negro',habilitado:false};
  function preparar() {
    TestBed.configureTestingModule({imports:[CatalogoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture = TestBed.createComponent(CatalogoPage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/catalogo-motocicletas/administracion').flush([habilitada,deshabilitada]);
    fixture.detectChanges();
    return {fixture,http,page:fixture.componentInstance};
  }
  it('muestra estados reales, ordena la tabla y combina filtros', () => {
    const {fixture,http,page} = preparar();
    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas[0].textContent).toContain('Bajaj');
    expect(filas[0].textContent).toContain('Deshabilitado');
    expect(filas[1].textContent).toContain('Habilitado');
    page.estado.set('HABILITADO');
    expect(page.filas().map(o => o.id)).toEqual([1]);
    page.filtro.set('rojo');
    expect(page.filas().length).toBe(1);
    page.estado.set('DESHABILITADO');
    expect(page.filas()).toEqual([]);
    http.verify();
  });
  it('persiste el estado y evita envíos dobles mientras guarda', () => {
    const {fixture,http,page} = preparar();
    const boton = fixture.nativeElement.querySelector('button[aria-label="Deshabilitar Honda CB Rojo"]') as HTMLButtonElement;
    boton.click();
    page.cambiarEstado(habilitada);
    const request = http.expectOne('/api/v1/catalogo-motocicletas/1/estado');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({habilitado:false});
    expect(page.opciones().find(o => o.id === 1)?.habilitado).toBe(true);
    request.flush({...habilitada,habilitado:false});
    expect(page.opciones().find(o => o.id === 1)?.habilitado).toBe(false);
    expect(page.cambiando()).toBeNull();
    page.cambiarEstado({...habilitada,habilitado:false});
    const habilitar = http.expectOne('/api/v1/catalogo-motocicletas/1/estado');
    expect(habilitar.request.body).toEqual({habilitado:true});
    habilitar.flush(habilitada);
    expect(page.opciones().find(o => o.id === 1)?.habilitado).toBe(true);
    http.verify();
  });
  it('conserva el estado anterior si el servidor rechaza el cambio', () => {
    const {http,page} = preparar();
    page.cambiarEstado(habilitada);
    http.expectOne('/api/v1/catalogo-motocicletas/1/estado').flush({}, {status:403,statusText:'Forbidden'});
    expect(page.opciones().find(o => o.id === 1)?.habilitado).toBe(true);
    expect(page.errorListado()).toContain('permiso');
    expect(page.cambiando()).toBeNull();
    http.verify();
  });
  it('conserva el contrato de creación y recarga los estados después de agregar', () => {
    const {http,page} = preparar();
    page.nueva = {marca:' Honda ',modelo:' CB ',color:' Azul '};
    page.agregar();
    const request = http.expectOne('/api/v1/catalogo-motocicletas');
    expect(request.request.body).toEqual({marca:'Honda',modelo:'CB',color:'Azul'});
    request.flush({marca:'Honda',modelo:'CB',color:'Azul'});
    http.expectOne('/api/v1/catalogo-motocicletas/administracion').flush([habilitada,deshabilitada]);
    expect(page.nueva.color).toBe('');
    expect(page.busy()).toBe(false);
    http.verify();
  });
  it('distingue el error de carga de un catálogo vacío y permite reintentar', () => {
    TestBed.configureTestingModule({imports:[CatalogoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture = TestBed.createComponent(CatalogoPage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/catalogo-motocicletas/administracion').flush({}, {status:500,statusText:'Error'});
    expect(fixture.componentInstance.errorListado()).not.toBe('');
    expect(fixture.componentInstance.cargando()).toBe(false);
    fixture.componentInstance.cargar();
    http.expectOne('/api/v1/catalogo-motocicletas/administracion').flush([]);
    expect(fixture.componentInstance.errorListado()).toBe('');
    http.verify();
  });
});
