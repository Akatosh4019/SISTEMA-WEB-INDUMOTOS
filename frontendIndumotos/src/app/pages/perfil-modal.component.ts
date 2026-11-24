import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/api-error';

interface Perfil {
  nombreCompleto: string;
  nombreUsuario: string;
  rolCodigo: string;
  rolNombre: string;
  estado: string;
  tiendaNombre: string | null;
  documento: string | null;
  telefono: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

@Component({
  selector: 'app-perfil-modal',
  imports: [FormsModule, DatePipe],
  templateUrl: './perfil-modal.component.html',
  styleUrl: './perfil-modal.component.css'
})
export class PerfilModalComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly cerrar = output<void>();
  readonly perfil = signal<Perfil | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly editando = signal<'usuario' | 'clave' | 'telefono' | null>(null);
  nombreUsuario = '';
  claveActual = '';
  claveNueva = '';
  confirmarClave = '';
  telefono = '';

  ngOnInit(): void {
    this.http.get<Perfil>('/api/v1/auth/perfil').subscribe({
      next: perfil => { this.perfil.set(perfil); this.cargando.set(false); },
      error: err => { this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }

  editar(tipo: 'usuario' | 'clave' | 'telefono'): void {
    this.error.set('');
    this.editando.set(tipo);
    this.nombreUsuario = this.perfil()?.nombreUsuario ?? '';
    this.claveActual = '';
    this.claveNueva = '';
    this.confirmarClave = '';
    this.telefono = this.perfil()?.telefono ?? '';
  }

  cancelarEdicion(): void {
    if (this.guardando()) return;
    this.editando.set(null);
    this.error.set('');
    this.claveActual = '';
    this.claveNueva = '';
    this.confirmarClave = '';
  }

  guardarUsuario(): void {
    if (this.guardando()) return;
    this.error.set('');
    const nombre = this.nombreUsuario.trim();
    if (!/^[A-Za-z0-9._-]{3,80}$/.test(nombre) || !this.claveActual) {
      this.error.set('Revisa el nombre de usuario y escribe tu contraseña actual.'); return;
    }
    this.guardando.set(true);
    this.http.put<Perfil>('/api/v1/auth/perfil/usuario', {
      nombreUsuario: nombre, claveActual: this.claveActual
    }).subscribe({
      next: () => this.volverAlLogin('Nombre de usuario actualizado. Ingresa de nuevo.'),
      error: err => { this.error.set(apiError(err)); this.guardando.set(false); }
    });
  }

  guardarClave(): void {
    if (this.guardando()) return;
    this.error.set('');
    if (!this.claveActual || this.claveNueva.length < 12 || this.claveNueva.length > 100) {
      this.error.set('Escribe tu contraseña actual y una nueva de 12 a 100 caracteres.'); return;
    }
    if (this.claveNueva !== this.confirmarClave) {
      this.error.set('La confirmación no coincide con la contraseña nueva.'); return;
    }
    this.guardando.set(true);
    this.http.put<void>('/api/v1/auth/perfil/clave', {
      claveActual: this.claveActual, claveNueva: this.claveNueva
    }).subscribe({
      next: () => this.volverAlLogin('Contraseña actualizada. Ingresa de nuevo.'),
      error: err => { this.error.set(apiError(err)); this.guardando.set(false); }
    });
  }

  guardarTelefono(): void {
    if (this.guardando()) return;
    this.error.set('');
    const telefono = this.telefono.trim();
    if (!this.claveActual || (telefono && !/^[+0-9 -]{6,30}$/.test(telefono))) {
      this.error.set('Escribe tu contraseña actual y revisa el teléfono.'); return;
    }
    this.guardando.set(true);
    this.http.put<Perfil>('/api/v1/auth/perfil/telefono', {telefono, claveActual: this.claveActual}).subscribe({
      next: perfil => { this.perfil.set(perfil); this.claveActual = ''; this.editando.set(null); this.guardando.set(false); },
      error: err => { this.error.set(apiError(err)); this.guardando.set(false); }
    });
  }

  private volverAlLogin(aviso: string): void {
    this.claveActual = '';
    this.claveNueva = '';
    this.confirmarClave = '';
    this.auth.logout(aviso);
    this.cerrar.emit();
    void this.router.navigateByUrl('/login');
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cerrarVentana(); }

  cerrarVentana(): void { if (!this.guardando()) this.cerrar.emit(); }
}
