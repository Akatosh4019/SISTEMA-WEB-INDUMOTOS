import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, switchMap, tap } from 'rxjs';

export interface AccessProfile {
  usuarioId: number;
  nombreUsuario: string;
  rolCodigo: string;
  permisos: { codigo: string; permitido: boolean }[];
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenState = signal(sessionStorage.getItem('indumotos_token') ?? '');
  readonly access = signal<AccessProfile | null>(null);
  readonly sessionNotice = signal('');
  readonly authenticated = computed(() => Boolean(this.tokenState()) &&
    Date.now() < Number(sessionStorage.getItem('indumotos_expires_at') ?? 0));

  token(): string {
    const expiresAt = Number(sessionStorage.getItem('indumotos_expires_at') ?? 0);
    if (!this.tokenState() || Date.now() >= expiresAt) {
      this.logout(this.tokenState() ? 'Tu sesión venció. Ingresa de nuevo.' : '');
      return '';
    }
    return this.tokenState();
  }

  login(nombreUsuario: string, clave: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/v1/auth/login', { nombreUsuario, clave }).pipe(
      tap(response => {
        this.sessionNotice.set('');
        const expiresAt = Date.now() + response.expiresIn * 1000;
        sessionStorage.setItem('indumotos_token', response.accessToken);
        sessionStorage.setItem('indumotos_expires_at', String(expiresAt));
        sessionStorage.setItem('indumotos_usuario', nombreUsuario.trim().toLowerCase());
        this.tokenState.set(response.accessToken);
      }),
      switchMap(response => this.loadAccess().pipe(map(() => response)))
    );
  }

  loadAccess(): Observable<AccessProfile> {
    return this.http.get<AccessProfile>('/api/v1/auth/me').pipe(
      tap(profile => this.access.set(profile))
    );
  }

  can(codigo: string): boolean {
    return this.access()?.permisos.some(p => p.codigo === codigo && p.permitido) ?? false;
  }

  username(): string {
    return sessionStorage.getItem('indumotos_usuario') ?? '';
  }

  logout(notice = ''): void {
    sessionStorage.removeItem('indumotos_token');
    sessionStorage.removeItem('indumotos_expires_at');
    sessionStorage.removeItem('indumotos_usuario');
    this.tokenState.set('');
    this.access.set(null);
    this.sessionNotice.set(notice);
  }
}
