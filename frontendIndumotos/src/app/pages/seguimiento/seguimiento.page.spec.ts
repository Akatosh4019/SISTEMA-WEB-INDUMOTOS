import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SeguimientoPage } from './seguimiento.page';

describe('SeguimientoPage', () => {
  it('separa salida física y recepción de cada motocicleta', () => {
    TestBed.configureTestingModule({imports:[SeguimientoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const page=TestBed.createComponent(SeguimientoPage).componentInstance;
    const http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/solicitudes?pagina=0&tamano=20').flush([]);
    page.solicitudId=21;
    page.consultar();
    http.expectOne('/api/v1/solicitudes/21').flush({id:21,estado:'ATENDIDA',solicitante:'comercial',lineas:[]});
    http.expectOne('/api/v1/solicitudes/21/seguimiento').flush([]);
    http.expectOne('/api/v1/solicitudes/21/envios').flush([]);
    page.despachar();
    const salida=http.expectOne('/api/v1/solicitudes/21/envios/despacho');
    expect(salida.request.method).toBe('POST');
    salida.flush([{motocicletaId:9,chasis:'CHASIS-9',origen:'Almacén',destino:'Tienda',estado:'EN_TRANSITO'}]);
    expect(page.envios()[0].estado).toBe('EN_TRANSITO');
    page.recibir(9);
    const recepcion=http.expectOne('/api/v1/solicitudes/21/envios/recepcion');
    expect(recepcion.request.body).toEqual({motocicletaId:9});
    recepcion.flush([{motocicletaId:9,chasis:'CHASIS-9',origen:'Almacén',destino:'Tienda',estado:'RECIBIDA'}]);
    expect(page.envios()[0].estado).toBe('RECIBIDA');
    http.verify();
  });

  it('consulta una solicitud y mantiene la trazabilidad después de anularla', () => {
    TestBed.configureTestingModule({imports:[SeguimientoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture=TestBed.createComponent(SeguimientoPage);
    const http=TestBed.inject(HttpTestingController);
    const page=fixture.componentInstance;
    http.expectOne('/api/v1/solicitudes?pagina=0&tamano=20').flush([
      {id:12,estado:'PENDIENTE',solicitante:'comercial',lineas:[]}
    ]);
    expect(page.solicitudes().map(s => s.id)).toEqual([12]);
    page.solicitudId=12;
    page.consultar();
    http.expectOne('/api/v1/solicitudes/12').flush({id:12,estado:'PENDIENTE',solicitante:'comercial',lineas:[]});
    http.expectOne('/api/v1/solicitudes/12/seguimiento').flush([{id:1,estado:'PENDIENTE',fecha:'hoy',registrador:'comercial',motivo:null}]);
    http.expectOne('/api/v1/solicitudes/12/envios').flush([]);
    expect(page.eventos().map(e => e.estado)).toEqual(['PENDIENTE']);
    page.anular();
    expect(page.dialogo()?.accion).toBe('ANULAR');
    page.motivo='  Solicitud duplicada  ';
    page.confirmarMotivo();
    const anulacion=http.expectOne('/api/v1/solicitudes/12/anulacion');
    expect(anulacion.request.method).toBe('POST');
    expect(anulacion.request.body).toEqual({motivo:'Solicitud duplicada'});
    anulacion.flush({id:2,estado:'ANULADA',registrador:'comercial',motivo:'Solicitud duplicada'});
    http.expectOne('/api/v1/solicitudes/12').flush({id:12,estado:'ANULADA',solicitante:'comercial',lineas:[]});
    http.expectOne('/api/v1/solicitudes/12/seguimiento').flush([
      {id:1,estado:'PENDIENTE',fecha:'hoy',registrador:'comercial',motivo:null},
      {id:2,estado:'ANULADA',fecha:'hoy',registrador:'comercial',motivo:'Solicitud duplicada'}
    ]);
    http.expectOne('/api/v1/solicitudes/12/envios').flush([]);
    expect(page.solicitud()?.estado).toBe('ANULADA');
    expect(page.eventos().length).toBe(2);
    expect(page.dialogo()).toBeNull();
    http.verify();
  });

  it('cancela la anulación sin enviar una petición', () => {
    TestBed.configureTestingModule({imports:[SeguimientoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const page=TestBed.createComponent(SeguimientoPage).componentInstance;
    const http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/solicitudes?pagina=0&tamano=20').flush([]);
    page.anular();
    page.motivo='No se enviará';
    page.cerrarMotivo();
    expect(page.dialogo()).toBeNull();
    expect(page.motivo).toBe('');
    http.verify();
  });
});
