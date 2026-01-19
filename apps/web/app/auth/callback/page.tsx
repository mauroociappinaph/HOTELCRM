'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error.message)
          setStatus('error')
          setMessage('Error durante la autenticación: ' + error.message)
          return
        }

        if (data.session) {
          setStatus('success')
          setMessage('¡Autenticación exitosa! Redirigiendo...')

          // Redirect to dashboard or home after a short delay
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('No se pudo obtener la sesión de autenticación')
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        setStatus('error')
        setMessage('Error inesperado durante la autenticación')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12">
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            )}
            {status === 'success' && (
              <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {status === 'loading' && 'Verificando autenticación...'}
            {status === 'success' && '¡Bienvenido!'}
            {status === 'error' && 'Error de autenticación'}
          </h2>

          <p className="mt-2 text-center text-sm text-gray-600">
            {message}
          </p>

          {status === 'error' && (
            <div className="mt-6">
              <button
                onClick={() => router.push('/')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
