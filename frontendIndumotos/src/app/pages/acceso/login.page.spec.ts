import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  it('muestra y oculta la contraseña con el botón del ojo', () => {
    TestBed.configureTestingModule({ imports: [LoginPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const clave = root.querySelector<HTMLInputElement>('#clave')!;
    const ojo = root.querySelector<HTMLButtonElement>('.password-toggle')!;
    expect(clave.type).toBe('password');
    expect(ojo.getAttribute('aria-label')).toBe('Mostrar contraseña');

    ojo.click(); fixture.detectChanges();
    expect(clave.type).toBe('text');
    expect(ojo.getAttribute('aria-label')).toBe('Ocultar contraseña');

    ojo.click(); fixture.detectChanges();
    expect(clave.type).toBe('password');
  });
});
