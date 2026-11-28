import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('Renovación de sesión', () => {
  afterEach(() => {
    sessionStorage.removeItem('indumotos_token');
    sessionStorage.removeItem('indumotos_expires_at');
    sessionStorage.removeItem('indumotos_usuario');
  });

  it('renueva una sola vez y usa el JWT nuevo en las peticiones pendientes', () => {
    sessionStorage.setItem('indumotos_token', 'anterior');
    sessionStorage.setItem('indumotos_expires_at', String(Date.now() + 60_000));
    TestBed.configureTestingModule({providers:[
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])
    ]});
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    let completadas = 0;
    auth.loadAccess().subscribe(() => completadas++);
    auth.loadAccess().subscribe(() => completadas++);
    const renovaciones = http.match('/api/v1/auth/refresh');
    expect(renovaciones).toHaveLength(1);
    expect(renovaciones[0].request.withCredentials).toBe(true);
    expect(renovaciones[0].request.headers.get('X-Indumotos-Refresh')).toBe('1');
    renovaciones[0].flush({accessToken:'nuevo',tokenType:'Bearer',expiresIn:900});
    const perfiles = http.match('/api/v1/auth/me');
    expect(perfiles).toHaveLength(2);
    perfiles.forEach(perfil => {
      expect(perfil.request.headers.get('Authorization')).toBe('Bearer nuevo');
      perfil.flush({usuarioId:1,nombreUsuario:'admin',rolCodigo:'ADMIN',permisos:[]});
    });
    expect(completadas).toBe(2);
    expect(auth.token()).toBe('nuevo');
    http.verify();
  });
});
