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
    http.expectOne('/api/v1/llegadas/7/detalle').flush({llegada:guia,cantidadFichas:3,diferenciaInformativa:16});
    fixture.detectChanges();
    expect(fixture.componentInstance.form.llegadaId).toBe(7);
    expect(fixture.nativeElement.textContent).toContain('19 recibidas');
    expect(fixture.nativeElement.textContent).toContain('3 fichas registradas');
    http.verify();
  });
});
