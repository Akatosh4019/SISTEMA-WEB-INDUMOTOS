import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => { localStorage.removeItem('indumotos-tema'); delete document.documentElement.dataset['theme']; TestBed.resetTestingModule(); });
  it('recupera la elección y la conserva al cambiar y volver a iniciar', () => {
    localStorage.setItem('indumotos-tema','oscuro');
    const theme=TestBed.inject(ThemeService);
    expect(theme.dark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    theme.toggle();
    expect(localStorage.getItem('indumotos-tema')).toBe('claro');
    expect(document.documentElement.dataset['theme']).toBe('light');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeService).dark()).toBe(false);
  });
});
