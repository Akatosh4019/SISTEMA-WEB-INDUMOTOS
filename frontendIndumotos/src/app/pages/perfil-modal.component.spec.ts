import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
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
    fixture.nativeElement.querySelector('.perfil-pie .perfil-guardar').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#perfil-nombres')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#perfil-clave-actual')).toBeNull();
    expect(fixture.componentInstance.datos.nombres).toBe('');
    http.verify();
  });

  it('guarda los datos personales y muestra la respuesta sin cerrar sesión', () => {
    TestBed.configureTestingModule({imports: [PerfilModalComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]});
    const fixture = TestBed.createComponent(PerfilModalComponent);
    const http = TestBed.inject(HttpTestingController);
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout');
    fixture.detectChanges();
    const perfil = {nombreCompleto:'Ana Lima',nombres:'Ana',apellidos:'Lima',correo:'ana@example.com',telefono:'987654321',dni:'01234567',nombreUsuario:'ana',rolCodigo:'ALMACEN',rolNombre:'Almacén',estado:'ACTIVO',tiendaNombre:null,creadoEn:'2026-11-24T10:00:00Z',actualizadoEn:'2026-11-24T10:00:00Z'};
    http.expectOne('/api/v1/auth/perfil').flush(perfil);
    fixture.componentInstance.editar('datos');
    expect(fixture.componentInstance.datos.dni).toBe('01234567');
    fixture.componentInstance.datos.telefono='912345678';
    fixture.componentInstance.guardarDatos();
    const request=http.expectOne('/api/v1/auth/perfil/datos');
    expect(request.request.body).toEqual({nombres:'Ana',apellidos:'Lima',correo:'ana@example.com',telefono:'912345678',dni:'01234567'});
    request.flush({...perfil,telefono:'912345678'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('912345678');
    expect(fixture.componentInstance.editando()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
    fixture.componentInstance.editar('datos');
    fixture.componentInstance.datos.nombres='Cambio sin guardar';
    fixture.componentInstance.cancelarEdicion();
    expect(fixture.componentInstance.perfil()?.nombres).toBe('Ana');
    http.verify();
  });

  it('conserva la edición cuando el DNI está ocupado y no envía un teléfono inválido', () => {
    TestBed.configureTestingModule({imports:[PerfilModalComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]});
    const fixture=TestBed.createComponent(PerfilModalComponent);
    const http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/auth/perfil').flush({nombreCompleto:'Ana Lima',nombreUsuario:'ana',rolNombre:'Almacén'});
    fixture.componentInstance.editar('datos');
    fixture.componentInstance.datos={nombres:'Ana',apellidos:'Lima',correo:'ana@example.com',telefono:'123',dni:'01234567'};
    fixture.componentInstance.guardarDatos();
    http.expectNone('/api/v1/auth/perfil/datos');
    fixture.componentInstance.datos.telefono='987654321';
    fixture.componentInstance.guardarDatos();
    http.expectOne('/api/v1/auth/perfil/datos').flush({error:'Ese DNI ya está registrado en otra cuenta'},{status:409,statusText:'Conflict'});
    expect(fixture.componentInstance.editando()).toBe('datos');
    expect(fixture.componentInstance.error()).toContain('DNI');
    expect(fixture.componentInstance.guardando()).toBe(false);
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
    fixture.componentInstance.nombreUsuario = 'ana_nueva';
    fixture.componentInstance.claveActual = 'clave-actual';
    fixture.componentInstance.guardarUsuario();
    const request = http.expectOne('/api/v1/auth/perfil/usuario');
    expect(request.request.body).toEqual({nombreUsuario: 'ana_nueva', claveActual: 'clave-actual'});
    request.flush({});
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
    http.verify();
  });
});
