import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css'
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly verClave = signal(false);
  readonly sessionNotice = this.auth.sessionNotice;
  nombreUsuario = '';
  clave = '';

  entrar(): void {
    if (!this.nombreUsuario.trim() || !this.clave) {
      this.error.set('Ingresa tu usuario y contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.nombreUsuario, this.clave).subscribe({
      next: () => void this.router.navigateByUrl('/app'),
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(error instanceof HttpErrorResponse && error.status === 401
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
      }
    });
  }
}
