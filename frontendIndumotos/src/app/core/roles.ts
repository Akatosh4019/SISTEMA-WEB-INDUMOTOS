/** Nombres de los roles tal como están registrados en la base de datos (tabla rol). */
export const ROLES: { codigo: string; nombre: string }[] = [
  { codigo: 'ADMIN', nombre: 'Administrador' },
  { codigo: 'ALMACEN', nombre: 'Almacén' },
  { codigo: 'INVENTARIOS', nombre: 'Inventarios' },
  { codigo: 'COMERCIAL', nombre: 'Comercial' },
  { codigo: 'FACTURACION', nombre: 'Facturación' },
  { codigo: 'ENSAMBLAJE', nombre: 'Ensamblaje' }
];

export function nombreRol(codigo: string | null | undefined, porDefecto = 'Usuario'): string {
  if (!codigo) return porDefecto;
  return ROLES.find(rol => rol.codigo === codigo)?.nombre ?? codigo.replaceAll('_', ' ');
}
