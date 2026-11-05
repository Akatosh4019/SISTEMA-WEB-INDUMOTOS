import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BusquedaPage } from './busqueda.page';

describe('HU-01: búsqueda y selección de ficha', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<BusquedaPage>>;
  let page: BusquedaPage;
  let http: HttpTestingController;
  const endpoint = '/api/v1/motocicletas/busqueda';
  const a = { id: 8, marca: 'Marca', modelo: 'Modelo A', color: 'Azul', chasisCompleto: 'DEMO-A-0042' };
  const b = { id: 9, marca: 'Marca', modelo: 'Modelo B', color: 'Rojo', chasisCompleto: 'DEMO-B-0042' };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BusquedaPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    fixture = TestBed.createComponent(BusquedaPage); page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('rechaza una consulta vacía y un sufijo incompleto sin consultar toda la base', () => {
    page.buscar(); expect(page.error()).toBeTruthy();
    page.modo = 'terminacion'; page.consulta = '042'; page.buscar();
    expect(page.error()).toContain('cuatro'); http.expectNone(r => r.url === endpoint);
  });
  it('envía el chasis completo como texto y no como un ID', () => {
    page.consulta = ' DEMO-A-0042 '; page.buscar();
    const req = http.expectOne(r => r.url === endpoint);
    expect(req.request.params.get('chasisCompleto')).toBe('DEMO-A-0042');
    expect(req.request.params.has('ultimosCuatro')).toBe(false);
    req.flush({ items: [a], pagina: 0, tamano: 20, totalElementos: 1, totalPaginas: 1 });
    expect(page.resultado()?.items[0].id).toBe(8);
  });
  it('conserva ceros y presenta todas las coincidencias con sus enlaces por ID', () => {
    page.modo = 'terminacion'; page.consulta = '0042'; page.buscar();
    const req = http.expectOne(r => r.url === endpoint);
    expect(req.request.params.get('ultimosCuatro')).toBe('0042');
    req.flush({ items: [a, b], pagina: 0, tamano: 20, totalElementos: 2, totalPaginas: 1 }); fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll('.result-card a')] as HTMLAnchorElement[];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/app/fichas?id=8', '/app/fichas?id=9']);
    expect(fixture.nativeElement.textContent).toContain('Modelo B');
    expect(fixture.nativeElement.textContent).toContain('Rojo');
  });
  it('muestra el caso sin coincidencias', () => {
    page.consulta = 'INEXISTENTE'; page.buscar();
    http.expectOne(r => r.url === endpoint).flush({ items: [], pagina: 0, tamano: 20, totalElementos: 0, totalPaginas: 0 });
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No se encontraron motocicletas');
  });
  it('muestra error de permiso sin dejar resultados anteriores', () => {
    page.consulta = 'DEMO-A-0042'; page.buscar();
    http.expectOne(r => r.url === endpoint).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(page.error()).toBeTruthy(); expect(page.resultado()).toBeNull(); expect(page.busy()).toBe(false);
  });
  it('pagina con el criterio aplicado aunque se edite el campo antes de buscar otra vez', () => {
    page.modo = 'terminacion'; page.consulta = '0042'; page.buscar();
    http.expectOne(r => r.url === endpoint).flush({ items: [a], pagina: 0, tamano: 20, totalElementos: 21, totalPaginas: 2 });
    page.consulta = '9999'; page.cargar(1);
    const req = http.expectOne(r => r.url === endpoint);
    expect(req.request.params.get('ultimosCuatro')).toBe('0042'); expect(req.request.params.get('pagina')).toBe('1');
    req.flush({ items: [b], pagina: 1, tamano: 20, totalElementos: 21, totalPaginas: 2 });
  });
  it('no duplica el envío y cancela la solicitud al salir de la pantalla', () => {
    page.consulta = 'DEMO-A-0042'; page.buscar(); page.buscar();
    const req = http.expectOne(r => r.url === endpoint); fixture.destroy(); expect(req.cancelled).toBe(true);
  });
});
