import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TiendaPage } from './tienda.page';

describe('TiendaPage',()=>{
  it('registra una venta para una moto del stock y vuelve a cargar los datos',()=>{
    TestBed.configureTestingModule({imports:[TiendaPage],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]});
    const fixture=TestBed.createComponent(TiendaPage);
    const http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/modos/tienda').flush({id:4,nombre:'Tienda Puruchuco',disponibles:1,vendidas:0});
    http.expectOne(req=>req.url==='/api/v1/modos/tienda/stock' && req.params.get('pagina')==='0')
      .flush({items:[{id:8,chasis:'DEMO-0008',marca:'Ronco',modelo:'RZ',color:'Negro'}],pagina:0,totalElementos:1});
    http.expectOne(req=>req.url==='/api/v1/modos/tienda/ventas' && req.params.get('pagina')==='0')
      .flush({items:[],pagina:0,totalElementos:0});
    const page=fixture.componentInstance;
    page.seleccionar(page.stock()!.items[0]);page.referenciaPago='YAPE-25';page.referencia='F001-25';page.importe=1200;page.guardar();
    const venta=http.expectOne('/api/v1/modos/tienda/ventas');
    expect(venta.request.method).toBe('POST');
    expect(venta.request.body).toEqual({motocicletaId:8,referenciaPago:'YAPE-25',referenciaComprobante:'F001-25',importe:1200});
    venta.flush({mensaje:'Venta registrada'});
    http.expectOne('/api/v1/modos/tienda').flush({id:4,nombre:'Tienda Puruchuco',disponibles:0,vendidas:1});
    http.expectOne(req=>req.url==='/api/v1/modos/tienda/stock').flush({items:[],pagina:0,totalElementos:0});
    http.expectOne(req=>req.url==='/api/v1/modos/tienda/ventas').flush({items:[],pagina:0,totalElementos:1});
    expect(page.stock()?.totalElementos).toBe(0);
    http.verify();
  });
});
