import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PerfilModalComponent } from './perfil-modal.component';

@Component({
  selector: 'app-shell-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PerfilModalComponent],
  templateUrl: './shell.page.html',
  styleUrl: './shell.page.css'
})
export class ShellPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly access = this.auth;
  readonly menuOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly profileMenuOpen = signal(false);
  readonly username = computed(() => this.auth.access()?.nombreUsuario || this.auth.username() || 'Usuario');
  readonly roleName = computed(() => {
    const role = this.auth.access()?.rolCodigo;
    return role === 'ADMIN' ? 'Administrador' : role === 'ALMACEN' ? 'Almacén'
      : role === 'INVENTARIOS' ? 'Inventarios' : role === 'COMERCIAL' ? 'Comercial'
      : role === 'ENSAMBLAJE' ? 'Ensamblaje' : role?.replaceAll('_', ' ') || 'Cargando perfil';
  });
  readonly initials = computed(() => this.username().slice(0, 2).toUpperCase());
  readonly logoutError = signal('');
  readonly logoutBusy = signal(false);

  constructor() {
    this.auth.loadAccess().subscribe({ error: () => { /* El interceptor gestiona 401. */ } });
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void { this.menuOpen.set(false); this.profileMenuOpen.set(false); }

  abrirPerfil(): void {
    this.profileMenuOpen.set(false);
    this.profileOpen.set(true);
    this.menuOpen.set(false);
  }

  salir(): void {
    if (this.logoutBusy()) return;
    this.profileMenuOpen.set(false);
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
