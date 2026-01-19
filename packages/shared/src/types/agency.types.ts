/**
 * Interfaz de agencia de viajes.
 * Representa la entidad raíz del sistema multi-tenant.
 */
export interface Agency {
  id: string;
  name: string;
  taxId: string; // CUIT/CUIL para Argentina
  createdAt: Date;
  updatedAt: Date;
}
