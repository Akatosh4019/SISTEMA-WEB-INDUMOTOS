import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/api-error';
import { DatosPersonales, datosPersonalesValidos } from '../core/datos-personales';

interface Perfil {
  nombres?: string | null;
  apellidos?: string | null;
  correo?: string | null;
  telefono?: string | null;
  dni?: string | null;
  nombreCompleto: string;
  nombreUsuario: string;
  rolCodigo: string;
  rolNombre: string;
  estado: string;
  tiendaNombre: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

@Component({
  selector: 'app-perfil-modal',
  imports: [FormsModule, DatePipe],
  templateUrl: './perfil-modal.component.html',
  styleUrl: './perfil-modal.component.css'
})
export class PerfilModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly cerrar = output<void>();
  readonly perfil = signal<Perfil | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly editando = signal<'datos' | 'usuario' | 'clave' | null>(null);
  readonly mensaje = signal('');
  datos: DatosPersonales = { nombres: '', apellidos: '', correo: '', telefono: '', dni: '' };
  nombreUsuario = '';
  claveActual = '';
  claveNueva = '';
  confirmarClave = '';

  ngOnInit(): void {
    this.http.get<Perfil>('/api/v1/auth/perfil').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: perfil => { this.perfil.set(perfil); this.cargando.set(false); },
      error: err => { this.error.set(apiError(err)); this.cargando.set(false); }
    });
  }

  ngAfterViewInit(): void { this.element.nativeElement.querySelector<HTMLButtonElement>('.perfil-cerrar')?.focus(); }
  ngOnDestroy(): void { this.previousFocus?.focus(); }

  @HostListener('keydown', ['$event'])
  keepFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && this.document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && this.document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  editar(tipo: 'datos' | 'usuario' | 'clave'): void {
    if (this.guardando()) return;
    this.error.set('');
    this.mensaje.set('');
    this.editando.set(tipo);
    const perfil = this.perfil();
    this.datos = { nombres: perfil?.nombres ?? '', apellidos: perfil?.apellidos ?? '',
      correo: perfil?.correo ?? '', telefono: perfil?.telefono ?? '', dni: perfil?.dni ?? '' };
    this.nombreUsuario = this.perfil()?.nombreUsuario ?? '';
    this.claveActual = '';
    this.claveNueva = '';
    this.confirmarClave = '';
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

  guardarDatos(): void {
    if (this.guardando()) return;
    this.error.set('');
    if (!datosPersonalesValidos(this.datos)) {
      this.error.set('Completa tus nombres, apellidos, correo válido, teléfono de 9 dígitos y DNI de 8 dígitos.'); return;
    }
    this.guardando.set(true);
    const datos = Object.fromEntries(Object.entries(this.datos).map(([campo, valor]) => [campo, valor.trim()]));
    this.http.put<Perfil>('/api/v1/auth/perfil/datos', datos).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: perfil => {
        this.perfil.set(perfil); this.guardando.set(false); this.editando.set(null);
        this.mensaje.set('Tus datos se guardaron correctamente.');
      },
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
