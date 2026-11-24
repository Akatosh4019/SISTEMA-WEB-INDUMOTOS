export interface DatosPersonales {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  dni: string;
}

export function datosPersonalesValidos(datos: DatosPersonales): boolean {
  return !!datos.nombres.trim() && datos.nombres.trim().length <= 80
    && !!datos.apellidos.trim() && datos.apellidos.trim().length <= 80
    && datos.correo.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim())
    && /^[0-9]{9}$/.test(datos.telefono.trim()) && /^[0-9]{8}$/.test(datos.dni.trim());
}
