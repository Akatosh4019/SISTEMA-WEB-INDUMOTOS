import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { nombreRol } from '../core/roles';
import { CatalogoPage } from './catalogo.page';
import { ReportesPage } from './reportes.page';
import { SolicitudesPage } from './solicitudes.page';

const proveedores = [provideHttpClient(), provideHttpClientTesting()];

describe('Catálogo en tabla', () => {
  it('filtra por estado y desactiva un modelo tras confirmarlo', () => {
    TestBed.configureTestingModule({ imports: [CatalogoPage], providers: proveedores });
    const fixture = TestBed.createComponent(CatalogoPage);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/catalogo-motocicletas').flush([
      { id: 1, marca: 'Honda', modelo: 'CB 190R', color: 'Rojo', activo: true },
      { id: 2, marca: 'Honda', modelo: 'XR 150L', color: 'Blanco', activo: false },
      { id: 3, marca: 'Yamaha', modelo: 'FZ 25', color: 'Negro', activo: true }
    ]);
    page.estado.set('INACTIVO');
    expect(page.visibles().map(o => o.id)).toEqual([2]);
    page.estado.set('TODOS'); page.busqueda.set('yamaha');
    expect(page.visibles().map(o => o.id)).toEqual([3]);
    page.confirmar(page.visibles()[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Dejará de aparecer');
    page.cambiarEstado(page.confirmando()!);
    const put = http.expectOne('/api/v1/catalogo-motocicletas/3/estado');
    expect(put.request.body).toEqual({ activo: false });
    put.flush({ id: 3, marca: 'Yamaha', modelo: 'FZ 25', color: 'Negro', activo: false });
    expect(page.opciones().find(o => o.id === 3)?.activo).toBe(false);
    expect(page.confirmando()).toBeNull();
    http.verify();
  });

  it('pagina de diez en diez', () => {
    TestBed.configureTestingModule({ imports: [CatalogoPage], providers: proveedores });
    const page = TestBed.createComponent(CatalogoPage).componentInstance;
    TestBed.inject(HttpTestingController).expectOne('/api/v1/catalogo-motocicletas').flush(
      Array.from({ length: 23 }, (_, i) => ({ id: i + 1, marca: 'M', modelo: 'Modelo ' + i, color: 'Rojo', activo: true })));
    expect(page.totalPaginas()).toBe(3);
    expect(page.resumen()).toBe('Mostrando 1–10 de 23 combinaciones');
    page.pagina.set(2);
    expect(page.visibles().length).toBe(3);
  });
});

describe('Solicitudes en tabla', () => {
  function crear() {
    TestBed.configureTestingModule({ imports: [SolicitudesPage], providers: proveedores });
    sessionStorage.setItem('indumotos_usuario', 'comercial');
    TestBed.inject(AuthService).access.set({ usuarioId: 2, nombreUsuario: 'comercial', rolCodigo: 'COMERCIAL', permisos: [
      { codigo: 'SOLICITUDES_CREAR', permitido: true }, { codigo: 'SOLICITUDES_ANULAR', permitido: true }] });
    const fixture = TestBed.createComponent(SolicitudesPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }
  const pendiente = { id: 8, estado: 'PENDIENTE', solicitante: 'comercial', destinoId: 4, destinoNombre: 'Tienda Puruchuco',
    creadaEn: '2026-11-24T10:00:00Z', observacion: null, lineas: [{ id: 1, marca: 'Honda', modelo: 'CB 190R', color: 'Rojo', cantidad: 2 }] };

  it('busca en el servidor y usa el total para el pie de tabla', () => {
    const { page, http } = crear();
    const primera = http.expectOne(r => r.url === '/api/v1/solicitudes');
    expect(primera.request.params.get('tamano')).toBe('10');
    primera.flush([pendiente], { headers: { 'X-Total-Count': '25' } });
    expect(page.total()).toBe(25);
    expect(page.totalPaginas()).toBe(3);
    expect(page.resumenLineas(page.solicitudes()[0])).toBe('Honda CB 190R · 2 unid.');
    page.busqueda = 'honda'; page.estado = 'PENDIENTE';
    page.irPagina(0);
    const filtrada = http.expectOne(r => r.url === '/api/v1/solicitudes' && r.params.get('buscar') === 'honda');
    expect(filtrada.request.params.get('estado')).toBe('PENDIENTE');
    filtrada.flush([], { headers: { 'X-Total-Count': '0' } });
    expect(page.resumen()).toBe('Sin resultados');
    http.verify();
    sessionStorage.clear();
  });

  it('edita una solicitud pendiente propia con PUT', () => {
    const { page, http } = crear();
    http.expectOne(r => r.url === '/api/v1/solicitudes').flush([pendiente], { headers: { 'X-Total-Count': '1' } });
    expect(page.puedeEditar(pendiente)).toBe(true);
    expect(page.puedeEditar({ ...pendiente, estado: 'EN_PREPARACION' })).toBe(false);
    expect(page.puedeEditar({ ...pendiente, solicitante: 'otra' })).toBe(false);
    page.abrirFormulario(pendiente);
    http.expectOne('/api/v1/solicitudes/opciones-motocicleta').flush([{ marca: 'Honda', modelo: 'CB 190R', color: 'Rojo' }]);
    http.expectOne('/api/v1/ubicaciones').flush([{ id: 4, codigo: 'PURUCHUCO_TIENDA', nombre: 'Tienda Puruchuco', tipo: 'TIENDA' }]);
    page.lineas[0].cantidad = 3;
    page.guardar();
    const put = http.expectOne('/api/v1/solicitudes/8');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.lineas[0].cantidad).toBe(3);
    put.flush({ ...pendiente, lineas: [{ ...pendiente.lineas[0], cantidad: 3 }] });
    expect(page.confirmacion()).toBe('Solicitud #8 actualizada.');
    http.expectOne(r => r.url === '/api/v1/solicitudes').flush([], { headers: { 'X-Total-Count': '0' } });
    http.verify();
    sessionStorage.clear();
  });

  it('anula con motivo obligatorio desde un modal', () => {
    const { page, http } = crear();
    http.expectOne(r => r.url === '/api/v1/solicitudes').flush([pendiente], { headers: { 'X-Total-Count': '1' } });
    page.pedirAnulacion(pendiente);
    page.anular();
    http.expectNone('/api/v1/solicitudes/8/anulacion');
    page.motivo = ' Pedido duplicado ';
    page.anular();
    const post = http.expectOne('/api/v1/solicitudes/8/anulacion');
    expect(post.request.body).toEqual({ motivo: 'Pedido duplicado' });
    post.flush({});
    expect(page.anulando()).toBeNull();
    http.expectOne(r => r.url === '/api/v1/solicitudes').flush([], { headers: { 'X-Total-Count': '0' } });
    http.verify();
    sessionStorage.clear();
  });
});

describe('Reportes', () => {
  it('carga el mes por defecto y cambia de periodo', () => {
    TestBed.configureTestingModule({ imports: [ReportesPage], providers: proveedores });
    const fixture = TestBed.createComponent(ReportesPage);
    const page = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const reporte = { periodo: 'MES', desde: '2026-10-26', hasta: '2026-11-24', unidadesVendidas: 4, importeTotal: 40000,
      masVendidos: [{ marca: 'Honda', modelo: 'CB 190R', cantidad: 3, importe: 29400 }],
      menosVendidos: [{ marca: 'Bajaj', modelo: 'Pulsar N 250', cantidad: 0, importe: 0 }],
      porTienda: [{ tienda: 'Tienda norte', cantidad: 4, importe: 40000 }],
      serie: [{ fecha: '2026-11-23', cantidad: 1 }, { fecha: '2026-11-24', cantidad: 3 }],
      stock: [{ marca: 'Honda', modelo: 'CB 190R', total: 5, enAlmacen: 3, enTienda: 1, enCamino: 1 }] };
    http.expectOne('/api/v1/reportes/ventas?periodo=MES').flush(reporte);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('CB 190R');
    expect(texto).toContain('Pulsar N 250');
    expect(page.maximo()).toBe(3);
    expect(page.stockTotal()).toBe(5);
    page.cambiar('ANIO');
    http.expectOne('/api/v1/reportes/ventas?periodo=ANIO').flush({ ...reporte, periodo: 'ANIO' });
    expect(page.etiqueta('2026-11-01')).toBe('Nov 2026');
    http.verify();
  });
});

describe('Nombres de roles', () => {
  it('usa un solo nombre por rol, incluido Facturación', () => {
    expect(nombreRol('ADMIN')).toBe('Administrador');
    expect(nombreRol('ALMACEN')).toBe('Almacén');
    expect(nombreRol('FACTURACION')).toBe('Facturación');
    expect(nombreRol(undefined, 'Cargando perfil')).toBe('Cargando perfil');
  });
});
