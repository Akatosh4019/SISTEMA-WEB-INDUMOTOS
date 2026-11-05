import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.page').then(m => m.LoginPage) },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell.page').then(m => m.ShellPage),
    children: [
      { path: '', loadComponent: () => import('./pages/home.page').then(m => m.HomePage) },
      { path: 'llegadas', loadComponent: () => import('./pages/llegadas.page').then(m => m.LlegadasPage) },
      { path: 'fichas', loadComponent: () => import('./pages/fichas.page').then(m => m.FichasPage) },
      { path: 'usuarios', loadComponent: () => import('./pages/usuarios.page').then(m => m.UsuariosPage) },
      { path: 'permisos', loadComponent: () => import('./pages/permisos.page').then(m => m.PermisosPage) }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', redirectTo: 'app' }
];
