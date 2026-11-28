import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { ControlDatosPage } from '../inventario/control-datos.page';
import { DetalleCuenta, UsuariosPage } from './usuarios.page';

const detalle = (estado: string): DetalleCuenta => ({
  id: 2, nombreCompleto: 'Miguel Rojas', nombreUsuario: 'miguel', rolCodigo: 'INVENTARIOS', rolNombre: 'Inventarios',
  estado, tiendaNombre: null, creadoEn: '2026-11-01T10:00:00Z', actualizadoEn: '2026-11-01T10:00:00Z',
  permisosEfectivos: ['FICHAS_REGISTRAR'], excepciones: [{ codigo: 'FICHAS_EDITAR', porRol: true, excepcion: 'DENEGAR', permitido: false }],
  ultimoCambioEstado: null
});

describe('HU-16 y HU-17: cuentas', () => {
  function crear(permisos: string[]) {
    TestBed.configureTestingModule({ imports: [UsuariosPage], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { can: (p: string) => permisos.includes(p) } }] });
    const fixture = TestBed.createComponent(UsuariosPage);
    return { fixture, page: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }

  it('abre Ver detalle en una ventana visible y permite cerrarla con Escape', async () => {
    const { fixture, http } = crear(['USUARIOS_CONSULTAR']);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 300));
    http.expectOne(req => req.url === '/api/v1/usuarios').flush({ items: [
      { id: 2, nombreCompleto: 'Miguel Rojas', nombreUsuario: 'miguel', rolCodigo: 'INVENTARIOS', estado: 'ACTIVO' }
    ], pagina: 0, tamano: 10, totalElementos: 1 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button.link-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Cargando detalle');
    http.expectOne('/api/v1/usuarios/2').flush(detalle('ACTIVO'));
    http.expectOne('/api/v1/usuarios/2/estado/historial').flush([]);
    fixture.detectChanges();
    expect(dialog.textContent).toContain('Miguel Rojas');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    http.verify();
  });

  it('consulta la cuenta y la desactiva solo después de confirmar con motivo', () => {
    const { fixture, page, http } = crear(['USUARIOS_CONSULTAR', 'USUARIOS_DESACTIVAR']);
    page.verDetalle(2);
    http.expectOne('/api/v1/usuarios/2').flush(detalle('ACTIVO'));
    http.expectOne('/api/v1/usuarios/2/estado/historial').flush([]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('FICHAS_REGISTRAR');
    expect(texto).toContain('Denegado: FICHAS_EDITAR');
    expect(texto).not.toContain('Datos del trabajador');

    page.pedirConfirmacion();
    expect(page.errorEstado()).toBe('Escribe el motivo del cambio.');
    expect(page.confirmando()).toBe(false);

    page.motivo = 'Dejó la empresa';
    page.pedirConfirmacion();
    expect(page.confirmando()).toBe(true);
    http.expectNone('/api/v1/usuarios/2/estado');

    page.cambiarEstado();
    const put = http.expectOne('/api/v1/usuarios/2/estado');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ estado: 'INACTIVO', motivo: 'Dejó la empresa' });
    put.flush({ ...detalle('INACTIVO'), ultimoCambioEstado: { estadoAnterior: 'ACTIVO', estadoNuevo: 'INACTIVO', motivo: 'Dejó la empresa', actor: 'admin', fecha: '2026-11-23T10:00:00Z' } });
    http.expectOne('/api/v1/usuarios/2/estado/historial').flush([{ estadoAnterior: 'ACTIVO', estadoNuevo: 'INACTIVO', motivo: 'Dejó la empresa', actor: 'admin', fecha: '2026-11-23T10:00:00Z' }]);
    expect(page.detalle()?.estado).toBe('INACTIVO');
    expect(page.mensajeEstado()).toBe('Cuenta miguel desactivada.');
    expect(page.historial().length).toBe(1);
  });

  it('muestra el motivo del servidor cuando el cambio no se permite', () => {
    const { page, http } = crear(['USUARIOS_CONSULTAR', 'USUARIOS_DESACTIVAR']);
    page.verDetalle(1);
    http.expectOne('/api/v1/usuarios/1').flush({ ...detalle('ACTIVO'), id: 1, rolCodigo: 'ADMIN' });
    http.expectOne('/api/v1/usuarios/1/estado/historial').flush([]);
    page.motivo = 'Prueba'; page.cambiarEstado();
    http.expectOne('/api/v1/usuarios/1/estado').flush({ error: 'Debe quedar al menos un administrador activo' }, { status: 409, statusText: 'Conflict' });
    expect(page.errorEstado()).toBe('Debe quedar al menos un administrador activo');
    expect(page.detalle()?.estado).toBe('ACTIVO');
  });
});

describe('HU-22: disponibilidad confiable', () => {
  it('muestra motivo, responsable y si la moto se puede ofrecer', () => {
    TestBed.configureTestingModule({ imports: [ControlDatosPage], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { can: () => false } }] });
    const fixture = TestBed.createComponent(ControlDatosPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.chasis = '0008'; page.buscar(0);
    http.expectOne(req => req.url === '/api/v1/disponibilidad').flush({ items: [
      { id: 8, chasis: 'IND-0008', marca: 'Ronco', modelo: 'RZ', color: 'Negro', ubicacion: 'Tienda', estado: 'EN_REVISION',
        motivo: 'Diferencia de datos en revisión: color', actualizadoEn: '2026-11-22T10:00:00Z', registradoPor: 'inventarios', puedeOfrecerse: false }
    ], pagina: 0, totalElementos: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No ofrecer');
    page.abrir(page.resultados()!.items[0]);
    http.expectOne('/api/v1/motocicletas/8/disponibilidad/historial').flush([]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('inventarios');
    expect(texto).toContain('Diferencia de datos en revisión: color');
    expect(texto).toContain('No, revisa el motivo antes de ofrecerla');
    expect(texto).toContain('La moto no se puede vender ni habilitar');
  });
});
