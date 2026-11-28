import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PerfilModalComponent } from './perfil-modal.component';

describe('PerfilModalComponent', () => {
  it('muestra los datos y deja la edición oculta hasta pedirla', () => {
    TestBed.configureTestingModule({imports: [PerfilModalComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ]});
    const fixture = TestBed.createComponent(PerfilModalComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/auth/perfil').flush({nombreCompleto: 'Roberto Samuel Valencia Saavedra',
      nombreUsuario: 'roberto', rolCodigo: 'ADMIN', rolNombre: 'Administrador',
      estado: 'ACTIVO', tiendaNombre: null, creadoEn: '2026-11-01T00:00:00Z',
      actualizadoEn: '2026-11-01T00:00:00Z'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Roberto Samuel Valencia Saavedra');
    expect(fixture.nativeElement.querySelector('#perfil-clave-usuario')).toBeNull();
    fixture.nativeElement.querySelector('.perfil-editar').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#perfil-clave-usuario')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#perfil-usuario')).toBeNull();
    http.verify();
  });

  it('cierra la sesión tras cambiar el usuario y exige nueva autenticación', () => {
    TestBed.configureTestingModule({imports: [PerfilModalComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([])
    ]});
    const fixture = TestBed.createComponent(PerfilModalComponent);
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const logout = vi.spyOn(auth, 'logout');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    http.expectOne('/api/v1/auth/perfil').flush({nombreCompleto: 'Ana', nombreUsuario: 'ana',
      rolCodigo: 'ADMIN', rolNombre: 'Administrador', estado: 'ACTIVO', tiendaNombre: null,
      creadoEn: '2026-11-01T00:00:00Z', actualizadoEn: '2026-11-01T00:00:00Z'});
    fixture.componentInstance.editar('usuario');
    fixture.componentInstance.claveActual = 'clave-actual';
    fixture.componentInstance.confirmarUsuario();
    http.expectOne('/api/v1/auth/perfil/confirmar-clave').flush(null, {status: 204, statusText: 'No Content'});
    expect(fixture.componentInstance.usuarioConfirmado()).toBe(true);
    fixture.componentInstance.nombreUsuario = 'ana_nueva';
    fixture.componentInstance.guardarUsuario();
    const request = http.expectOne('/api/v1/auth/perfil/usuario');
    expect(request.request.body).toEqual({nombreUsuario: 'ana_nueva', claveActual: 'clave-actual'});
    request.flush({});
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
    http.verify();
  });

  it('actualiza el teléfono propio dentro del perfil', () => {
    TestBed.configureTestingModule({imports:[PerfilModalComponent],providers:[
      provideHttpClient(),provideHttpClientTesting(),provideRouter([])
    ]});
    const fixture=TestBed.createComponent(PerfilModalComponent);
    const http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const datos={nombreCompleto:'Ana',nombreUsuario:'ana',rolCodigo:'COMERCIAL',rolNombre:'Comercial',
      estado:'ACTIVO',tiendaNombre:'Puruchuco',documento:'12345678',telefono:null,
      creadoEn:'2026-11-01T00:00:00Z',actualizadoEn:'2026-11-01T00:00:00Z'};
    http.expectOne('/api/v1/auth/perfil').flush(datos);
    fixture.componentInstance.editar('telefono');
    fixture.componentInstance.telefono='+51 900 000 001';
    fixture.componentInstance.claveActual='ClaveActual123';
    fixture.componentInstance.guardarTelefono();
    const request=http.expectOne('/api/v1/auth/perfil/telefono');
    expect(request.request.body).toEqual({telefono:'+51 900 000 001',claveActual:'ClaveActual123'});
    request.flush({...datos,telefono:'+51 900 000 001'});
    expect(fixture.componentInstance.perfil()?.telefono).toBe('+51 900 000 001');
    expect(fixture.componentInstance.editando()).toBeNull();
    http.verify();
  });
});
