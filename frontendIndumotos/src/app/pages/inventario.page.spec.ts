import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InventarioPage } from './inventario.page';

describe('InventarioPage', () => {
  let http: HttpTestingController;
  let page: InventarioPage;
  let fixture: ComponentFixture<InventarioPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InventarioPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    fixture = TestBed.createComponent(InventarioPage);
    http = TestBed.inject(HttpTestingController);
    page = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/v1/motocicletas?pagina=0&tamano=10').flush({
      items: [], pagina: 0, tamano: 10, totalElementos: 0, totalPaginas: 0
    });
  });

  afterEach(() => http.verify());

  it('combina el sufijo y los filtros y conserva la consulta al paginar', () => {
    page.filtros = { chasis: ' 0042 ', marca: ' RONCO ', modelo: '', color: ' ROJO ' };
    page.buscar();
    const first = http.expectOne(req => req.url === '/api/v1/motocicletas' &&
      req.params.get('chasis') === '0042' && req.params.get('marca') === 'RONCO' &&
      req.params.get('color') === 'ROJO' && req.params.get('pagina') === '0');
    first.flush({ items: [{ id: 8, marca: 'RONCO', modelo: 'RZ', color: 'ROJO', chasisVista: '**** 0042' }],
      pagina: 0, tamano: 10, totalElementos: 11, totalPaginas: 2 });
    expect(page.page()?.totalElementos).toBe(11);
    page.irPagina(1);
    const next = http.expectOne(req => req.params.get('pagina') === '1' &&
      req.params.get('chasis') === '0042' && req.params.get('marca') === 'RONCO');
    next.flush({ items: [], pagina: 1, tamano: 10, totalElementos: 11, totalPaginas: 2 });
    expect(page.page()?.pagina).toBe(1);
  });

  it('rechaza un sufijo incompleto sin llamar a la API', () => {
    page.filtros.chasis = '042';
    page.buscar();
    expect(page.error()).toContain('cuatro dígitos');
    http.expectNone('/api/v1/motocicletas?pagina=0&tamano=10&chasis=042');
  });

  it('muestra ausencia de resultados al buscar el chasis completo', () => {
    page.filtros.chasis = 'DEMO-A-0042';
    page.buscar();
    http.expectOne(req => req.params.get('chasis') === 'DEMO-A-0042').flush({
      items: [], pagina: 0, tamano: 10, totalElementos: 0, totalPaginas: 0
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay coincidencias');
  });

  it('abre la ficha sobre el inventario y la cierra sin perder la lista', () => {
    page.fichaAbierta.set(8);
    fixture.detectChanges();
    http.expectOne('/api/v1/motocicletas/8').flush({id:8,llegadaId:2,marca:'RONCO',modelo:'RZ 250',color:'Rojo',
      chasisCompleto:'DEMO-A-0042',numeroMotor:'MOTOR-1',dua:'DUA-1',itemDua:'1',creadorUsuario:'inventarios',creadoEn:'2026-11-19T09:00:00Z'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('DEMO-A-0042');
    page.cerrarFicha(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(page.page()).not.toBeNull();
  });
});
