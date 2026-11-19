import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { LlegadasPage } from './llegadas.page';

describe('LlegadasPage', () => {
  it('lista todas las guías en páginas de diez y conserva el filtro', () => {
    TestBed.configureTestingModule({imports:[LlegadasPage],providers:[provideHttpClient(),provideHttpClientTesting(),
      provideRouter([]),{provide:AuthService,useValue:{can:(permiso:string) => permiso === 'INVENTARIO_CONSULTAR'}}]});
    const fixture = TestBed.createComponent(LlegadasPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(req => req.url === '/api/v1/llegadas/pagina' && req.params.get('pagina') === '0'
      && req.params.get('numeroGuia') === '').flush({items:[],pagina:0,tamano:10,totalElementos:21,totalPaginas:3});
    const page = fixture.componentInstance;
    expect(page.paginaLlegadas()?.totalPaginas).toBe(3);
    page.numeroGuia = 'GR-'; page.buscarGuia();
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '0')
      .flush({items:[],pagina:0,tamano:10,totalElementos:11,totalPaginas:2});
    page.listar(1);
    http.expectOne(req => req.params.get('numeroGuia') === 'GR-' && req.params.get('pagina') === '1')
      .flush({items:[],pagina:1,tamano:10,totalElementos:11,totalPaginas:2});
    expect(page.paginaLlegadas()?.pagina).toBe(1);
    http.verify();
  });
});
