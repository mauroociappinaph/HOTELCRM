/**
 * Interfaz de cliente/viajero.
 * Almacena información demográfica y preferencias de viaje.
 */
export interface Client {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passportNumber?: string;
  preferences?: ClientPreferences;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Preferencias de viaje del cliente.
 * Utilizado por el sistema de IA para recomendaciones personalizadas.
 */
export interface ClientPreferences {
  destinations?: string[];
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };
  travelStyle?: 'luxury' | 'budget' | 'adventure' | 'family' | 'business';
  accommodationType?: 'hotel' | 'hostel' | 'apartment' | 'resort';
}
