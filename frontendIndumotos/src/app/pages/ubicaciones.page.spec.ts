import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UbicacionesPage } from './ubicaciones.page';

const sedes = [
  {id:1,codigo:'ALM',nombre:'Almacén central',tipo:'ALMACEN',referencia:'Ate',activo:true},
  {id:2,codigo:'TIE',nombre:'Tienda Puruchuco',tipo:'TIENDA',referencia:null,activo:true},
  {id:3,codigo:'OLD',nombre:'Taller antiguo',tipo:'TALLER',referencia:null,activo:false}
];

function crear(admin: boolean) {
  TestBed.configureTestingModule({imports:[UbicacionesPage],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]});
  TestBed.inject(AuthService).access.set({usuarioId:1,nombreUsuario:'admin',rolCodigo:admin ? 'ADMIN' : 'ALMACEN',
    permisos:admin ? [{codigo:'PERMISOS_ASIGNAR',permitido:true}] : []});
  const fixture=TestBed.createComponent(UbicacionesPage);
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
}

describe('UbicacionesPage', () => {
  it('Administración ve todas las sedes en tabla y filtra mientras escribe', () => {
    const { fixture, page, http } = crear(true);
    http.expectOne('/api/v1/ubicaciones?todas=true').flush(sedes);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Inactiva');
    page.busqueda.set('puru');
    fixture.detectChanges();
    expect(page.visibles().map(s => s.id)).toEqual([2]);
    page.busqueda.set(''); page.tipo.set('TALLER');
    expect(page.visibles().map(s => s.id)).toEqual([3]);
    http.verify();
  });

  it('edita una sede en el modal sin cambiar su código', () => {
    const { page, http } = crear(true);
    http.expectOne('/api/v1/ubicaciones?todas=true').flush(sedes);
    page.abrir(sedes[1]);
    page.form.nombre = ' Tienda Puruchuco 2 ';
    page.form.referencia = 'Av. Prolongación Javier Prado';
    page.guardar();
    const put = http.expectOne('/api/v1/ubicaciones/2');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({nombre:'Tienda Puruchuco 2',tipo:'TIENDA',referencia:'Av. Prolongación Javier Prado'});
    put.flush({...sedes[1], nombre:'Tienda Puruchuco 2'});
    http.expectOne('/api/v1/ubicaciones?todas=true').flush(sedes);
    expect(page.formAbierto()).toBe(false);
    expect(page.mensaje()).toBe('Ubicación actualizada.');
    http.verify();
  });

  it('muestra el motivo cuando una sede en uso no se puede desactivar', () => {
    const { page, http } = crear(true);
    http.expectOne('/api/v1/ubicaciones?todas=true').flush(sedes);
    page.confirmar(sedes[0]);
    page.cambiarEstado(sedes[0]);
    const put = http.expectOne('/api/v1/ubicaciones/1/estado');
    expect(put.request.body).toEqual({activo:false});
    put.flush({error:'Hay 20 moto(s) ubicadas en esta sede; trasládalas antes de desactivarla'}, {status:409, statusText:'Conflict'});
    expect(page.error()).toContain('Hay 20 moto(s)');
    expect(page.confirmando()).not.toBeNull();
    http.verify();
  });

  it('otros roles solo consultan las sedes activas', () => {
    const { fixture, http } = crear(false);
    http.expectOne('/api/v1/ubicaciones').flush(sedes.slice(0, 2));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Agregar ubicación');
    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    http.verify();
  });
});
