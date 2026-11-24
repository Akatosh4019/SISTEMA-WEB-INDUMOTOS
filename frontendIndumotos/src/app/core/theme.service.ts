import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);

  constructor() {
    let saved: string | null = null;
    try { saved = this.document.defaultView?.localStorage.getItem('indumotos-tema') ?? null; } catch { /* El tema funciona también sin almacenamiento. */ }
    this.dark.set(saved === 'oscuro' || (saved !== 'claro' && !!this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches));
    this.apply();
  }

  toggle(): void {
    this.dark.update(value => !value);
    this.apply();
    try { this.document.defaultView?.localStorage.setItem('indumotos-tema', this.dark() ? 'oscuro' : 'claro'); } catch { /* Se conserva la elección durante esta sesión. */ }
  }

  private apply(): void {
    this.document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
  }
}
