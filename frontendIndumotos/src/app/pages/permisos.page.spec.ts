import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PermisosPage } from './permisos.page';

describe('PermisosPage', () => {
  it('muestra roles y guarda los permisos del rol editado', () => {
    TestBed.configureTestingModule({imports: [PermisosPage], providers: [provideHttpClient(), provideHttpClientTesting()]});
    const fixture = TestBed.createComponent(PermisosPage);
    const http = TestBed.inject(HttpTestingController);
    const rol = {id:2,codigo:'ALMACEN',nombre:'Almacenero',descripcion:'Recepción',estado:'ACTIVO',trabajadores:3,permisos:1};
    const permisos = [{codigo:'LLEGADAS_REGISTRAR',nombre:'Registrar llegadas',descripcion:'',asignado:true},
      {codigo:'INVENTARIO_CONSULTAR',nombre:'Consultar inventario',descripcion:'',asignado:false}];
    http.expectOne('/api/v1/roles').flush([rol]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Almacenero');
    expect(fixture.nativeElement.textContent).not.toContain('Cuentas del sistema');
    fixture.componentInstance.abrir(rol);
    http.expectOne('/api/v1/roles/ALMACEN').flush({rol,permisos});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.role-actions button:last-child').textContent).toContain('Cerrar');
    fixture.componentInstance.alternarEdicion();
    fixture.componentInstance.cambiarPermiso('INVENTARIO_CONSULTAR');
    fixture.componentInstance.guardar();
    const cambio = http.expectOne('/api/v1/roles/ALMACEN/permisos');
    expect(cambio.request.body.codigos).toContain('INVENTARIO_CONSULTAR');
    cambio.flush({rol:{...rol,permisos:2},permisos:permisos.map(p => ({...p,asignado:true}))});
    http.expectOne('/api/v1/roles').flush([{...rol,permisos:2}]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Permisos del rol actualizados');
    http.verify();
  });
});
