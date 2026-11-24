import { Component, inject } from '@angular/core';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-theme-toggle',
  template: `<button type="button" class="theme-toggle" (click)="theme.toggle()" [attr.aria-pressed]="theme.dark()" [attr.aria-label]="theme.dark() ? 'Activar modo claro' : 'Activar modo oscuro'"><span aria-hidden="true">{{ theme.dark() ? '☀' : '☾' }}</span> {{ theme.dark() ? 'Modo claro' : 'Modo oscuro' }}</button>`
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
