import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.page.html',
  styleUrl: './shell.page.css'
})
export class ShellPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly username = this.auth.username();
  readonly access = this.auth;
  readonly logoutError = signal('');
  readonly logoutBusy = signal(false);

  constructor() {
    this.auth.loadAccess().subscribe({ error: () => { /* El interceptor gestiona 401. */ } });
  }

  salir(): void {
    if (this.logoutBusy()) return;
    this.logoutError.set('');
    this.logoutBusy.set(true);
    this.auth.closeSession().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => {
        this.logoutBusy.set(false);
        this.logoutError.set('No se pudo cerrar la sesión. Inténtalo de nuevo.');
      }
    });
  }
}
