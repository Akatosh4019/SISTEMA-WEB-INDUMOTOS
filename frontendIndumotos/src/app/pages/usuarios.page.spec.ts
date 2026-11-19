import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsuariosPage } from './usuarios.page';

describe('UsuariosPage', () => {
  it('muestra todas las cuentas por páginas y actualiza el filtro al escribir', async () => {
    TestBed.configureTestingModule({imports:[UsuariosPage],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture = TestBed.createComponent(UsuariosPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 300));
    http.expectOne(req => req.url === '/api/v1/usuarios' && req.params.get('pagina') === '0'
      && req.params.get('buscar') === '').flush({items:[{id:1,nombreCompleto:'Ana',nombreUsuario:'ana',rolCodigo:'ALMACEN',estado:'ACTIVO'}],pagina:0,tamano:10,totalElementos:11});
    const page = fixture.componentInstance;
    expect(page.totalPaginas(page.cuentas()!)).toBe(2);
    page.irPagina(1); await new Promise(resolve => setTimeout(resolve, 300));
    http.expectOne(req => req.params.get('pagina') === '1').flush({items:[{id:2,nombreCompleto:'Beto',nombreUsuario:'beto',rolCodigo:'INVENTARIOS',estado:'ACTIVO'}],pagina:1,tamano:10,totalElementos:11});
    page.busqueda='ana'; page.buscar(); await new Promise(resolve => setTimeout(resolve, 300));
    http.expectOne(req => req.params.get('pagina') === '0' && req.params.get('buscar') === 'ana')
      .flush({items:[{id:1,nombreCompleto:'Ana',nombreUsuario:'ana',rolCodigo:'ALMACEN',estado:'ACTIVO'}],pagina:0,tamano:10,totalElementos:1});
    expect(page.cuentas()?.items.map(c => c.nombreUsuario)).toEqual(['ana']);
    http.verify();
  });
});
