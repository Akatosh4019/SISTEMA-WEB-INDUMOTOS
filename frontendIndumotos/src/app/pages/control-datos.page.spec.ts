import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { ControlDatosPage } from './control-datos.page';

describe('ControlDatosPage',()=>{
  it('busca por chasis y envía la diferencia al área de inventarios',()=>{
    TestBed.configureTestingModule({imports:[ControlDatosPage],providers:[
      provideHttpClient(),provideHttpClientTesting(),
      {provide:AuthService,useValue:{can:(p:string)=>p==='DIFERENCIAS_CONSULTAR'||p==='DIFERENCIAS_REPORTAR'}}
    ]});
    const fixture=TestBed.createComponent(ControlDatosPage);
    const http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req=>req.url==='/api/v1/diferencias').flush({items:[],pagina:0,totalElementos:0});
    const page=fixture.componentInstance;
    page.chasis='0004';page.buscar(0);
    http.expectOne(req=>req.url==='/api/v1/disponibilidad'&&req.params.get('chasis')==='0004')
      .flush({items:[{id:4,chasis:'IND-0004',marca:'Ronco',modelo:'RZ',color:'Negro',ubicacion:'Tienda',estado:'DISPONIBLE',motivo:'Sin bloqueo'}],pagina:0,totalElementos:1});
    page.abrir(page.resultados()!.items[0]);
    http.expectOne('/api/v1/motocicletas/4/disponibilidad/historial').flush([]);
    page.campoReporte='chasisCompleto';page.valorObservado='IND-0005';page.descripcion='No coincide con la DUA';page.reportar();
    const report=http.expectOne('/api/v1/diferencias');
    expect(report.request.body).toEqual({motocicletaId:4,campo:'chasisCompleto',valorObservado:'IND-0005',descripcion:'No coincide con la DUA'});
    report.flush(null);
    http.expectOne(req=>req.url==='/api/v1/diferencias').flush({items:[],pagina:0,totalElementos:1});
    expect(page.moto()).toBeNull();
    http.verify();
  });
});
