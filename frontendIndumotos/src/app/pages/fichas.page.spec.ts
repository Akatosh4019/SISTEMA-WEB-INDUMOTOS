import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { FichasPage } from './fichas.page';

describe('FichasPage', () => {
  it('lista guías para seleccionar y muestra el avance de sus fichas', () => {
    TestBed.configureTestingModule({imports:[FichasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) =>
        ['FICHAS_REGISTRAR','INVENTARIO_CONSULTAR'].includes(permiso)}}]});
    const fixture = TestBed.createComponent(FichasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/catalogo-motocicletas').flush([]);
    const guia = {id:7,numeroGuia:'TG01-38337',fechaLlegada:'2026-11-20T09:00:00Z',
      receptorUsuario:'almacen',cantidadDeclarada:19,cantidadRecibida:19};
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina' && req.params.get('pagina') === '0'
      && req.params.get('numeroGuia') === '').flush({items:[guia],pagina:0,totalPaginas:1,totalElementos:1});
    fixture.componentInstance.seleccionarLlegada(guia);
    const crearUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:guia-1').mockReturnValueOnce('blob:guia-2');
    http.expectOne('/api/v1/llegadas/7/guias').flush([
      {id:11,orden:1,nombreArchivo:'pagina-1.jpg'}, {id:12,orden:2,nombreArchivo:'pagina-2.jpg'}]);
    http.expectOne('/api/v1/llegadas/7/guias/11').flush(new Blob(['foto 1'], {type:'image/jpeg'}));
    http.expectOne('/api/v1/llegadas/7/guias/12').flush(new Blob(['foto 2'], {type:'image/jpeg'}));
    expect(fixture.componentInstance.fotosGuia().length).toBe(2);
    fixture.componentInstance.cambiarPaginaFoto(1);
    expect(fixture.componentInstance.paginaFoto()).toBe(1);
    crearUrl.mockRestore();
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:guia,fichas:[],cantidadFichas:3,diferenciaInformativa:16});
    http.expectOne('/api/v1/llegadas/7/registro').flush({terminado:false,recibidas:19,registradas:3,borradores:[]});
    fixture.detectChanges();
    expect(fixture.componentInstance.form.llegadaId).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('19 recibidas');
    expect(fixture.componentInstance.bloques().length).toBe(16);
    expect(fixture.nativeElement.textContent).toContain('Fichas registradas');
    fixture.componentInstance.autocompletar();
    http.expectOne('/api/v1/llegadas/7/sugerencias-ocr').flush({fotosAnalizadas:2,sugerencias:[{
      pagina:1,marca:'RONCO',modelo:'RZ 250',color:'VERDE',chasisCompleto:'L2BB3322XVMD12128',
      numeroMotor:'167YMMVZ212128',dua:'',itemDua:''
    }]});
    expect(fixture.componentInstance.bloques()[0].chasisCompleto).toBe('L2BB3322XVMD12128');
    expect(fixture.componentInstance.bloques()[0].sugerida).toBe(true);
    http.expectNone(req => req.method === 'POST' && req.url === '/api/v1/motocicletas');
    fixture.componentInstance.bloques()[0].numeroMotor = '';
    fixture.componentInstance.bloques()[0].dua = 'DUA CORREGIDO MANUALMENTE';
    fixture.componentInstance.autocompletar();
    http.expectOne('/api/v1/llegadas/7/sugerencias-ocr').flush({fotosAnalizadas:2,sugerencias:[{
      pagina:1,marca:'RONCO',modelo:'RZ 250',color:'VERDE',chasisCompleto:'L2BB3322XVMD12128',
      numeroMotor:'167YMMVZ212128',dua:'118-2026-10-269348-00',itemDua:'128'
    }]});
    expect(fixture.componentInstance.bloques()[0].numeroMotor).toBe('167YMMVZ212128');
    expect(fixture.componentInstance.bloques()[0].dua).toBe('DUA CORREGIDO MANUALMENTE');
    const bloque = fixture.componentInstance.bloques()[0];
    bloque.marca = 'RONCO'; bloque.modelo = 'RZ 250'; bloque.color = 'VERDE';
    bloque.dua = '118-2026-10-269348-00'; bloque.itemDua = '128';
    fixture.componentInstance.guardarBloque(0);
    const registro = http.expectOne('/api/v1/llegadas/7/registro/borradores/1');
    expect(registro.request.method).toBe('PUT');
    expect(registro.request.body.chasisCompleto).toBe('L2BB3322XVMD12128');
    registro.flush({terminado:false,recibidas:19,registradas:3,borradores:[registro.request.body]});
    expect(fixture.componentInstance.bloques()[0].guardada).toBe(true);
    expect(fixture.componentInstance.detalleLlegada()?.cantidadFichas).toBe(3);
    expect(fixture.componentInstance.totalPaginasBloques()).toBe(4);
    http.verify();
  });

  it('recupera borradores y solo finaliza cuando todos están guardados', () => {
    TestBed.configureTestingModule({imports:[FichasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) =>
        ['FICHAS_REGISTRAR','INVENTARIO_CONSULTAR'].includes(permiso)}}]});
    const fixture = TestBed.createComponent(FichasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/catalogo-motocicletas').flush([]);
    const guia = {id:8,numeroGuia:'TG01-38359',fechaLlegada:'2026-11-20T09:00:00Z',
      receptorUsuario:'almacen',cantidadDeclarada:2,cantidadRecibida:2};
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina').flush({items:[guia],pagina:0,totalPaginas:1,totalElementos:1});
    fixture.componentInstance.seleccionarLlegada(guia);
    http.expectOne('/api/v1/llegadas/8/guias').flush([]);
    http.expectOne('/api/v1/llegadas/8/detalle').flush({llegada:guia,fichas:[],cantidadFichas:0,diferenciaInformativa:2});
    const borrador = {posicion:1,marca:'RONCO',modelo:'RZ 250',color:'VERDE',
      chasisCompleto:'L2BB3322XVMD12128',numeroMotor:'167YMMVZ212128',dua:'118-2026-10-269348-00',itemDua:'128'};
    http.expectOne('/api/v1/llegadas/8/registro').flush({terminado:false,recibidas:2,registradas:0,borradores:[borrador]});
    expect(fixture.componentInstance.bloques()[0].guardada).toBe(true);
    expect(fixture.componentInstance.borradoresCompletos()).toBe(false);
    fixture.componentInstance.finalizarRegistro();
    http.expectNone('/api/v1/llegadas/8/registro/finalizar');
    fixture.componentInstance.bloques()[1] = {...borrador,chasisCompleto:'L2BB33221VMD12132',guardada:true,error:'',fieldErrors:{}};
    expect(fixture.componentInstance.borradoresCompletos()).toBe(true);
    fixture.componentInstance.finalizarRegistro();
    const cierre = http.expectOne('/api/v1/llegadas/8/registro/finalizar');
    expect(cierre.request.method).toBe('POST');
    cierre.flush({terminado:true,recibidas:2,registradas:2,borradores:[]});
    http.expectOne('/api/v1/llegadas/8/detalle').flush({llegada:guia,fichas:[],cantidadFichas:2,diferenciaInformativa:0});
    expect(fixture.componentInstance.registroTerminado()).toBe(true);
    expect(fixture.componentInstance.bloques().length).toBe(0);
    http.verify();
  });
});
