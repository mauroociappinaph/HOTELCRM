'use client'

import { useAuth } from '../lib/auth-context'
import { SUPPORTED_LANGUAGES, TAX_RATES } from "@hotel-crm/shared";

export default function HomePage() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

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

        {/* Auth Section */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            🔐 Autenticación
          </h2>

          {user ? (
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-700">✅ Usuario autenticado</h3>
                <p className="text-gray-600">{user.email}</p>
                {profile?.profile?.full_name && (
                  <p className="text-sm text-gray-500">Nombre: {profile.profile.full_name}</p>
                )}
                {profile?.agency && (
                  <p className="text-sm text-gray-500">Agencia: {profile.agency.name}</p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={signOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium"
                >
                  Cerrar Sesión
                </button>
                <a
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
                >
                  Ir al Dashboard
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-semibold text-gray-700">⚠️ No autenticado</h3>
                <p className="text-gray-600">Inicia sesión con Google para continuar</p>
              </div>

              <button
                onClick={signInWithGoogle}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Iniciar Sesión con Google
              </button>
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            ✅ Sistema Inicializado Correctamente
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold text-gray-700">Arquitectura</h3>
              <p className="text-gray-600">Turborepo + pnpm workspaces + Quality Gates</p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-700">Microservicios</h3>
              <ul className="text-gray-600 list-disc list-inside">
                <li>Auth Service (NestJS + Supabase)</li>
                <li>Web App (Next.js + React)</li>
                <li>Shared Packages (TypeScript)</li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold text-gray-700">Base de Datos</h3>
              <p className="text-gray-600">
                Supabase con PostgreSQL + Auth integrado + RLS
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

        {/* Next Steps */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white">
          <h2 className="text-2xl font-semibold mb-4">🚀 Próximos Pasos</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li className="line-through">✅ Configurar monorepo y quality gates</li>
            <li className="line-through">✅ Implementar Auth Service con Supabase</li>
            <li className="line-through">✅ Crear autenticación frontend con Google OAuth</li>
            <li>Aplicar migración Supabase completa</li>
            <li>Configurar RLS policies por agencia</li>
            <li>Implementar dashboard de agencia</li>
            <li>Desarrollar sistema RAG con pgvector</li>
            <li>Integrar OpenRouter para LLMs</li>
            <li>Implementar videollamadas con Daily.co</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
