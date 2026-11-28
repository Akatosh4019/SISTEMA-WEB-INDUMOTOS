import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { permissionGuard } from './core/permission.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/acceso/login.page').then(m => m.LoginPage) },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/estructura/shell.page').then(m => m.ShellPage),
    children: [
      { path: '', loadComponent: () => import('./pages/inicio/home.page').then(m => m.HomePage) },
      { path: 'llegadas', canActivate: [permissionGuard], data: { permissions: ['LLEGADAS_REGISTRAR', 'INVENTARIO_CONSULTAR'] }, loadComponent: () => import('./pages/llegadas/llegadas.page').then(m => m.LlegadasPage) },
      { path: 'fichas', redirectTo: 'inventario?registro=1' },
      { path: 'catalogo', canActivate: [permissionGuard], data: { permission: 'CATALOGO_GESTIONAR' }, loadComponent: () => import('./pages/catalogo/catalogo.page').then(m => m.CatalogoPage) },
      { path: 'inventario', canActivate: [permissionGuard], data: { permissions: ['INVENTARIO_CONSULTAR', 'DISPONIBILIDAD_CONSULTAR', 'FICHAS_REGISTRAR'] }, loadComponent: () => import('./pages/inventario/inventario.page').then(m => m.InventarioPage) },
      { path: 'compania', redirectTo: 'usuarios' },
      { path: 'control-datos', redirectTo: 'inventario', pathMatch: 'full' },
      { path: 'solicitudes', canActivate: [permissionGuard], data: { permission: 'SOLICITUDES_CONSULTAR' }, loadComponent: () => import('./pages/solicitudes/solicitudes.page').then(m => m.SolicitudesPage) },
      { path: 'ubicaciones', canActivate: [permissionGuard], data: { permission: 'UBICACIONES_CONSULTAR' }, loadComponent: () => import('./pages/ubicaciones/ubicaciones.page').then(m => m.UbicacionesPage) },
      { path: 'seguimiento', canActivate: [permissionGuard], data: { permission: 'SOLICITUDES_CONSULTAR' }, loadComponent: () => import('./pages/seguimiento/seguimiento.page').then(m => m.SeguimientoPage) },
      { path: 'usuarios', canActivate: [permissionGuard], data: { permissions: ['USUARIOS_CREAR', 'USUARIOS_CONSULTAR'] }, loadComponent: () => import('./pages/trabajadores/usuarios.page').then(m => m.UsuariosPage) },
      { path: 'permisos', canActivate: [permissionGuard], loadComponent: () => import('./pages/roles/permisos.page').then(m => m.PermisosPage) }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' }
];
