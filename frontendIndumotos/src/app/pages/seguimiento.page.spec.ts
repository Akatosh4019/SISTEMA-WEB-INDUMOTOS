import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
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

  it('pide el motivo de la anulación en una ventana propia y conserva la trazabilidad', () => {
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
    http.expectOne('/api/v1/solicitudes/12/seguimiento').flush([{id:1,estado:'PENDIENTE',fecha:'2026-11-24T10:00:00Z',registrador:'comercial',motivo:null}]);
    http.expectOne('/api/v1/solicitudes/12/envios').flush([]);
    expect(page.eventos().map(e => e.estado)).toEqual(['PENDIENTE']);
    const prompt=vi.spyOn(window,'prompt');
    page.anular();
    fixture.detectChanges();
    expect(prompt).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Anular solicitud');
    page.confirmarMotivo();
    http.expectNone('/api/v1/solicitudes/12/anulacion');
    page.motivo='  Solicitud duplicada  ';
    page.confirmarMotivo();
    const anulacion=http.expectOne('/api/v1/solicitudes/12/anulacion');
    expect(anulacion.request.method).toBe('POST');
    expect(anulacion.request.body).toEqual({motivo:'  Solicitud duplicada  '});
    anulacion.flush({id:2,estado:'ANULADA',registrador:'comercial',motivo:'Solicitud duplicada'});
    expect(page.motivoAbierto()).toBeNull();
    http.expectOne('/api/v1/solicitudes/12').flush({id:12,estado:'ANULADA',solicitante:'comercial',lineas:[]});
    http.expectOne('/api/v1/solicitudes/12/seguimiento').flush([
      {id:1,estado:'PENDIENTE',fecha:'2026-11-24T10:00:00Z',registrador:'comercial',motivo:null},
      {id:2,estado:'ANULADA',fecha:'2026-11-24T10:05:00Z',registrador:'comercial',motivo:'Solicitud duplicada'}
    ]);
    http.expectOne('/api/v1/solicitudes/12/envios').flush([]);
    expect(page.solicitud()?.estado).toBe('ANULADA');
    expect(page.eventos().length).toBe(2);
    prompt.mockRestore();
    http.verify();
  });

  it('muestra el recorrido de una moto y registra su traslado', () => {
    TestBed.configureTestingModule({imports:[SeguimientoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const auth=TestBed.inject(AuthService);
    auth.access.set({usuarioId:1,nombreUsuario:'almacen',rolCodigo:'ALMACEN',permisos:[
      {codigo:'UBICACIONES_CONSULTAR',permitido:true},{codigo:'TRASLADOS_REGISTRAR',permitido:true}]});
    const fixture=TestBed.createComponent(SeguimientoPage);
    const page=fixture.componentInstance;
    const http=TestBed.inject(HttpTestingController);
    expect(page.vistaActual()).toBe('recorrido');
    page.seleccionar({id:7,marca:'Honda',modelo:'CB 190R',color:'Rojo',chasisVista:'****0001'});
    http.expectOne('/api/v1/motocicletas/7/recorrido').flush({
      moto:{id:7,marca:'Honda',modelo:'CB 190R',color:'Rojo',chasis:'IND-0001'}, ubicacionActual:'Almacén central',
      enCamino:null, vendida:false, eventos:[
        {tipo:'LLEGADA',titulo:'Llegó al almacén',detalle:'Guía de remisión G-1',origen:null,destino:null,responsable:'almacen',fecha:'2026-11-19T09:00:00Z'},
        {tipo:'UBICACION',titulo:'Ubicación registrada',detalle:null,origen:null,destino:'Almacén central',responsable:'almacen',fecha:'2026-11-19T09:05:00Z'}]});
    fixture.detectChanges();
    const texto=fixture.nativeElement.textContent as string;
    expect(texto).toContain('Llegó al almacén');
    expect(texto).toContain('Almacén central');
    expect(page.pasosRecientes()[0].tipo).toBe('UBICACION');
    expect(page.puedeMover(page.recorrido()!)).toBe(true);
    page.abrirMovimiento();
    http.expectOne('/api/v1/ubicaciones').flush([{id:3,nombre:'Tienda Puruchuco',tipo:'TIENDA'}]);
    page.destinoId=3;
    page.guardarMovimiento();
    const traslado=http.expectOne('/api/v1/motocicletas/7/traslados');
    expect(traslado.request.body).toEqual({destinoId:3});
    traslado.flush({});
    http.expectOne('/api/v1/motocicletas/7/recorrido').flush({
      moto:{id:7,marca:'Honda',modelo:'CB 190R',color:'Rojo',chasis:'IND-0001'}, ubicacionActual:'Tienda Puruchuco',
      enCamino:null, vendida:false, eventos:[]});
    expect(page.recorrido()?.ubicacionActual).toBe('Tienda Puruchuco');
    expect(page.mensaje()).toBe('Movimiento registrado.');
    http.verify();
  });

  it('no ofrece mover una moto vendida o en camino', () => {
    TestBed.configureTestingModule({imports:[SeguimientoPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    TestBed.inject(AuthService).access.set({usuarioId:1,nombreUsuario:'admin',rolCodigo:'ADMIN',permisos:[
      {codigo:'UBICACIONES_CONSULTAR',permitido:true},{codigo:'TRASLADOS_REGISTRAR',permitido:true}]});
    const page=TestBed.createComponent(SeguimientoPage).componentInstance;
    const base={moto:{id:1,marca:'A',modelo:'B',color:'C',chasis:'X'},ubicacionActual:'Tienda',eventos:[]};
    expect(page.puedeMover({...base,enCamino:null,vendida:true})).toBe(false);
    expect(page.puedeMover({...base,enCamino:{origen:'A',destino:'B',desde:''},vendida:false})).toBe(false);
  });
});
