import { SUPPORTED_LANGUAGES, TAX_RATES } from "@hotel-crm/shared";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🏨 Hotel CRM
          </h1>
          <p className="text-xl text-gray-600">
            Sistema de Gestión para Agencias de Viajes
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            ✅ Monorepo Inicializado Correctamente
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-700">Arquitectura</h3>
              <p className="text-gray-600">Turborepo + pnpm workspaces</p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-700">Microservicios</h3>
              <ul className="text-gray-600 list-disc list-inside">
                <li>Auth Service (Puerto 3001)</li>
                <li>IA & RAG Service (Puerto 3002)</li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-700">Paquetes Compartidos</h3>
              <p className="text-gray-600">
                Tipos, DTOs y constantes disponibles en @hotel-crm/shared
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-gray-700">Tasas Impositivas (Argentina)</h3>
              <ul className="text-gray-600">
                <li>Impuesto PAIS: {TAX_RATES.IMPUESTO_PAIS * 100}%</li>
                <li>Percepción Ganancias: {TAX_RATES.PERCEPCION_GANANCIAS * 100}%</li>
              </ul>
            </div>

            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-semibold text-gray-700">Idiomas Soportados</h3>
              <p className="text-gray-600">
                {SUPPORTED_LANGUAGES.join(', ').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white">
          <h2 className="text-2xl font-semibold mb-4">🚀 Próximos Pasos</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Configurar Supabase (crear proyecto y obtener credenciales)</li>
            <li>Implementar autenticación con Google OAuth</li>
            <li>Desarrollar sistema RAG con pgvector</li>
            <li>Integrar OpenRouter para LLMs</li>
            <li>Implementar videollamadas con Daily.co</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
