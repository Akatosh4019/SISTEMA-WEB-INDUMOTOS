import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthService } from '../core/auth.service';
import { FichasPage } from './fichas.page';

describe('HU-01-T04: ficha seleccionada y permisos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('abre el ID elegido y oculta el registro a una cuenta de consulta', () => {
    TestBed.configureTestingModule({ imports: [FichasPage], providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: AuthService, useValue: {can: (code: string) => code === 'INVENTARIO_CONSULTAR'}},
      {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap({id: '9'})}}}
    ]});
    const fixture = TestBed.createComponent(FichasPage); fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/motocicletas/9').flush({id: 9, llegadaId: 1,
      marca: 'Marca', modelo: 'Modelo B', color: 'Rojo', chasisCompleto: 'DEMO-B-0042', numeroMotor: 'Ficticio', dua: 'Ficticia', itemDua: '02', creadorUsuario: 'ficticio', creadoEn: '2026-11-05T12:00:00Z'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Modelo B');
    expect(fixture.nativeElement.textContent).toContain('DEMO-B-0042');
    expect(fixture.nativeElement.textContent).not.toContain('Nueva ficha');
  });
  it('conserva el formulario de registro para quien tiene ese permiso', () => {
    TestBed.configureTestingModule({ imports: [FichasPage], providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: AuthService, useValue: {can: (code: string) => code === 'FICHAS_REGISTRAR'}},
      {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap({})}}}
    ]});
    const fixture = TestBed.createComponent(FichasPage); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nueva ficha');
    expect(fixture.nativeElement.textContent).not.toContain('Consultar ficha');
  });
});
