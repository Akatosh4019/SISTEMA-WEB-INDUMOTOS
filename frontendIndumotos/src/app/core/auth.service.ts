import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';

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
  private renovacion?: Observable<string>;
  readonly access = signal<AccessProfile | null>(null);
  readonly sessionNotice = signal('');
  readonly authenticated = computed(() => Boolean(this.tokenState()) &&
    Date.now() < Number(sessionStorage.getItem('indumotos_expires_at') ?? 0));

  token(): string {
    const expiresAt = Number(sessionStorage.getItem('indumotos_expires_at') ?? 0);
    return Date.now() < expiresAt ? this.tokenState() : '';
  }

  ensureToken(): Observable<string> {
    const expiresAt = Number(sessionStorage.getItem('indumotos_expires_at') ?? 0);
    if (this.tokenState() && expiresAt - Date.now() > 120_000) return of(this.tokenState());
    if (this.renovacion) return this.renovacion;
    this.renovacion = this.http.post<LoginResponse>('/api/v1/auth/refresh', {},
      {withCredentials:true, headers:{'X-Indumotos-Refresh':'1'}}).pipe(
      tap(response => this.guardarToken(response)),
      map(response => response.accessToken),
      catchError(() => {
        this.logout('Tu sesión venció. Ingresa de nuevo.');
        return of('');
      }),
      finalize(() => { this.renovacion = undefined; }),
      shareReplay(1)
    );
    return this.renovacion;
  }

  login(nombreUsuario: string, clave: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/v1/auth/login', { nombreUsuario, clave }).pipe(
      tap(response => {
        this.guardarToken(response);
        sessionStorage.setItem('indumotos_usuario', nombreUsuario.trim().toLowerCase());
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

  closeSession(): Observable<void> {
    return this.http.post<void>('/api/v1/auth/logout', {}).pipe(tap(() => this.logout()));
  }

  logout(notice = ''): void {
    sessionStorage.removeItem('indumotos_token');
    sessionStorage.removeItem('indumotos_expires_at');
    sessionStorage.removeItem('indumotos_usuario');
    this.tokenState.set('');
    this.access.set(null);
    this.sessionNotice.set(notice);
  }

  private guardarToken(response: LoginResponse): void {
    this.sessionNotice.set('');
    sessionStorage.setItem('indumotos_token', response.accessToken);
    sessionStorage.setItem('indumotos_expires_at', String(Date.now() + response.expiresIn * 1000));
    this.tokenState.set(response.accessToken);
  }
}
