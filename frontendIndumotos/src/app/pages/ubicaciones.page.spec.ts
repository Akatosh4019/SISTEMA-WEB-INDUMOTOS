import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UbicacionesPage } from './ubicaciones.page';

describe('UbicacionesPage', () => {
  it('consulta historial y registra un traslado con el destino seleccionado', () => {
    TestBed.configureTestingModule({imports:[UbicacionesPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture=TestBed.createComponent(UbicacionesPage);
    const http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/ubicaciones').flush([{id:3,codigo:'TIE',nombre:'Tienda',tipo:'TIENDA'}]);
    const page=fixture.componentInstance;
    page.motocicletaId=7;
    page.consultar();
    http.expectOne('/api/v1/motocicletas/7/envio-activo').flush(null);
    http.expectOne('/api/v1/motocicletas/7/ubicacion/historial').flush([
      {id:1,destinoId:2,destinoNombre:'Almacén',tipo:'UBICACION',registrador:'admin',fecha:'2026-11-19T09:00:00Z'}
    ]);
    expect(page.actual()?.destinoNombre).toBe('Almacén');
    page.destinoId=3;
    page.guardar(true);
    const traslado=http.expectOne('/api/v1/motocicletas/7/traslados');
    expect(traslado.request.method).toBe('POST');
    expect(traslado.request.body).toEqual({destinoId:3});
    traslado.flush({id:2,destinoId:3,destinoNombre:'Tienda',tipo:'TRASLADO',registrador:'admin',fecha:'2026-11-19T09:01:00Z'});
    http.expectOne('/api/v1/motocicletas/7/envio-activo').flush(null);
    http.expectOne('/api/v1/motocicletas/7/ubicacion/historial').flush([
      {id:1,destinoId:2,destinoNombre:'Almacén',tipo:'UBICACION',registrador:'admin',fecha:'2026-11-19T09:00:00Z'},
      {id:2,destinoId:3,destinoNombre:'Tienda',tipo:'TRASLADO',registrador:'admin',fecha:'2026-11-19T09:01:00Z'}
    ]);
    expect(page.actual()?.destinoNombre).toBe('Tienda');
    http.verify();
  });
});
