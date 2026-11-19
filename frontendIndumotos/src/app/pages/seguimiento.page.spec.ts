import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SeguimientoPage } from './seguimiento.page';

describe('SeguimientoPage', () => {
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
    expect(page.eventos().map(e => e.estado)).toEqual(['PENDIENTE']);
    const prompt=vi.spyOn(window,'prompt').mockReturnValue('  Solicitud duplicada  ');
    page.anular();
    const anulacion=http.expectOne('/api/v1/solicitudes/12/anulacion');
    expect(anulacion.request.method).toBe('POST');
    expect(anulacion.request.body).toEqual({motivo:'  Solicitud duplicada  '});
    anulacion.flush({id:2,estado:'ANULADA',registrador:'comercial',motivo:'Solicitud duplicada'});
    http.expectOne('/api/v1/solicitudes/12').flush({id:12,estado:'ANULADA',solicitante:'comercial',lineas:[]});
    http.expectOne('/api/v1/solicitudes/12/seguimiento').flush([
      {id:1,estado:'PENDIENTE',fecha:'hoy',registrador:'comercial',motivo:null},
      {id:2,estado:'ANULADA',fecha:'hoy',registrador:'comercial',motivo:'Solicitud duplicada'}
    ]);
    expect(page.solicitud()?.estado).toBe('ANULADA');
    expect(page.eventos().length).toBe(2);
    prompt.mockRestore();
    http.verify();
  });
});
