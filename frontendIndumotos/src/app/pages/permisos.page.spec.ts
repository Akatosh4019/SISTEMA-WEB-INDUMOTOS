import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PermisosPage } from './permisos.page';

describe('PermisosPage', () => {
  it('lista cuentas por páginas y abre permisos bloqueados hasta habilitar edición', async () => {
    TestBed.configureTestingModule({imports: [PermisosPage], providers: [provideHttpClient(), provideHttpClientTesting()]});
    const fixture = TestBed.createComponent(PermisosPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 300));
    const primera = http.expectOne(req => req.url === '/api/v1/usuarios' && req.params.get('pagina') === '0' && req.params.get('tamano') === '10');
    primera.flush({items: [{id: 4, nombreCompleto: 'Ana Lima', nombreUsuario: 'ana', rolCodigo: 'ALMACEN', estado: 'ACTIVO'}], pagina: 0, totalElementos: 11});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    fixture.componentInstance.irPagina(1);
    await new Promise(resolve => setTimeout(resolve, 300));
    http.expectOne(req => req.url === '/api/v1/usuarios' && req.params.get('pagina') === '1' && req.params.get('tamano') === '10')
      .flush({items: [{id: 5, nombreCompleto: 'Beto Cruz', nombreUsuario: 'beto', rolCodigo: 'COMERCIAL', estado: 'ACTIVO'}], pagina: 1, totalElementos: 11});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Beto Cruz');
    fixture.componentInstance.consultar(fixture.componentInstance.cuentas()!.items[0]);
    http.expectOne('/api/v1/usuarios/5/permisos').flush({usuarioId: 5, nombreUsuario: 'beto', rolCodigo: 'COMERCIAL', permisos: [{codigo: 'SOLICITUDES_CREAR', porRol: true, excepcion: null, permitido: true}]});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.role-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('.permission-actions')).toBeNull();
    fixture.nativeElement.querySelector('.edit-toggle input').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.role-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.permission-actions')).not.toBeNull();
    http.verify();
  });
});
