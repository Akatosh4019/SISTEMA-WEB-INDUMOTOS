import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InventarioPage } from './inventario.page';
import { AuthService } from '../core/auth.service';
import { vi } from 'vitest';

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
    TestBed.inject(AuthService).access.set({usuarioId: 1, nombreUsuario: 'inventarios', rolCodigo: 'INVENTARIOS',
      permisos: [{codigo: 'INVENTARIO_CONSULTAR', permitido: true}]});
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

  it('busca automáticamente al escribir y el envío manual no duplica solicitudes', () => {
    vi.useFakeTimers();
    try {
      const input = fixture.nativeElement.querySelector('#chasis') as HTMLInputElement;
      input.value = '0042';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(299);
      http.expectNone(req => req.url === '/api/v1/motocicletas');
      vi.advanceTimersByTime(1);
      http.expectOne(req => req.params.get('chasis') === '0042')
        .flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
      page.filtros.chasis = '0001';
      page.alCambiarFiltro();
      (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', {cancelable:true}));
      http.expectOne(req => req.params.get('chasis') === '0001')
        .flush({items:[],pagina:0,tamano:10,totalElementos:0,totalPaginas:0});
      vi.advanceTimersByTime(500);
      http.expectNone(req => req.url === '/api/v1/motocicletas');
    } finally { vi.useRealTimers(); }
  });

  it('invalida la consulta anterior al escribir un chasis incompleto', () => {
    vi.useFakeTimers();
    try {
      page.filtros.chasis = '0042';
      page.buscar();
      const anterior = http.expectOne(req => req.params.get('chasis') === '0042');
      page.filtros.chasis = '004';
      page.alCambiarFiltro();
      expect(anterior.cancelled).toBe(true);
      expect(page.page()).toBeNull();
      expect(page.loading()).toBe(false);
      vi.advanceTimersByTime(300);
      expect(page.error()).toContain('cuatro dígitos');
      http.expectNone(req => req.url === '/api/v1/motocicletas');
    } finally { vi.useRealTimers(); }
  });

  it('limpiar cancela el temporizador y restaura todos los resultados una sola vez', () => {
    vi.useFakeTimers();
    try {
      page.filtros = {chasis:'0042',marca:'RONCO',modelo:'RZ 250',color:'ROJO'};
      page.alCambiarFiltro();
      page.limpiar();
      const request = http.expectOne('/api/v1/motocicletas?pagina=0&tamano=10');
      request.flush({items:[],pagina:0,tamano:10,totalElementos:22,totalPaginas:3});
      vi.advanceTimersByTime(500);
      http.expectNone(req => req.url === '/api/v1/motocicletas');
      expect(page.filtros).toEqual({chasis:'',marca:'',modelo:'',color:''});
      expect(page.page()?.totalElementos).toBe(22);
    } finally { vi.useRealTimers(); }
  });

  it('permite limpiar una consulta en curso e ignora sus resultados anteriores', () => {
    page.filtros.chasis = '0042';
    page.buscar();
    const anterior = http.expectOne(req => req.params.get('chasis') === '0042');
    fixture.detectChanges();
    const limpiar = fixture.nativeElement.querySelector('.actions button') as HTMLButtonElement;
    expect(limpiar.disabled).toBe(false);
    limpiar.click();
    expect(anterior.cancelled).toBe(true);
    http.expectOne('/api/v1/motocicletas?pagina=0&tamano=10')
      .flush({items:[],pagina:0,tamano:10,totalElementos:22,totalPaginas:3});
    expect(page.page()?.totalElementos).toBe(22);
  });

  it('cancela solicitudes y temporizadores al salir del componente', () => {
    vi.useFakeTimers();
    try {
      page.filtros.chasis = '0042';
      page.buscar();
      const pendiente = http.expectOne(req => req.params.get('chasis') === '0042');
      fixture.destroy();
      expect(pendiente.cancelled).toBe(true);
      vi.advanceTimersByTime(500);
      http.expectNone(req => req.url === '/api/v1/motocicletas');
    } finally { vi.useRealTimers(); }
  });

  it('no ejecuta una búsqueda automática pendiente después de salir', () => {
    vi.useFakeTimers();
    try {
      page.filtros.chasis = '0042';
      page.alCambiarFiltro();
      fixture.destroy();
      vi.advanceTimersByTime(500);
      http.expectNone(req => req.url === '/api/v1/motocicletas');
    } finally { vi.useRealTimers(); }
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
    http.expectOne('/api/v1/llegadas/2').flush({id:2,numeroGuia:'TG01-38337'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('DEMO-A-0042');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('TG01-38337');
    page.cerrarFicha(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(page.page()).not.toBeNull();
  });

  it('deja el control de disponibilidad dentro de Inventario', () => {
    TestBed.inject(AuthService).access.set({usuarioId:1,nombreUsuario:'admin',rolCodigo:'ADMIN',
      permisos:[{codigo:'INVENTARIO_CONSULTAR',permitido:true},{codigo:'DISPONIBILIDAD_CONSULTAR',permitido:true}]});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Disponibilidad y diferencias');
    page.vista.set('control');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-control-datos-page')).not.toBeNull();
  });
});
