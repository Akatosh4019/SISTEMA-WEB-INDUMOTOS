import { Component, inject } from '@angular/core';
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

  constructor() {
    this.auth.loadAccess().subscribe({ error: () => { /* El interceptor gestiona 401. */ } });
  }

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
