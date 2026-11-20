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
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:guia,fichas:[],cantidadFichas:3,diferenciaInformativa:16});
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
    http.expectNone('/api/v1/motocicletas');
    const bloque = fixture.componentInstance.bloques()[0];
    bloque.marca = 'RONCO'; bloque.modelo = 'RZ 250'; bloque.color = 'VERDE';
    bloque.dua = '118-2026-10-269348-00'; bloque.itemDua = '128';
    fixture.componentInstance.guardarBloque(0);
    const registro = http.expectOne('/api/v1/motocicletas');
    expect(registro.request.body.llegadaId).toBe(7);
    expect(registro.request.body.chasisCompleto).toBe('L2BB3322XVMD12128');
    registro.flush({id:42,llegadaId:7,chasisCompleto:'L2BB3322XVMD12128'});
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:guia,cantidadFichas:4,
      diferenciaInformativa:15,fichas:[]});
    expect(fixture.componentInstance.bloques()[0].guardada).toBe(true);
    expect(fixture.componentInstance.detalleLlegada()?.cantidadFichas).toBe(4);
    http.verify();
  });
});
