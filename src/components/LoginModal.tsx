'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Props {
  isOpen: boolean
  onLoginSuccess: (user: { nombre: string; rol: string; dni: string }) => void
}

export default function LoginModal({ isOpen, onLoginSuccess }: Props) {
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Buscar el usuario por DNI en Supabase
      const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('dni', dni.trim())
        .single()

      if (error || !data) {
        alert('DNI no encontrado en el sistema.')
        setLoading(false)
        return
      }

      // 2. Validar que la contraseña sean los últimos 4 dígitos del DNI
      const ultimosCuatro = data.dni.slice(-4)
      if (password.trim() !== ultimosCuatro) {
        alert('Contraseña incorrecta. Recuerde que son los últimos 4 dígitos de su DNI.')
        setLoading(false)
        return
      }

      // 3. Login exitoso -> Guardar sesión localmente y notificar al componente padre
      const userData = { nombre: data.nombre, rol: data.rol, dni: data.dni }
      localStorage.setItem('usuario_actual', JSON.stringify(userData))
      onLoginSuccess(userData)
    } catch (err: any) {
      alert('Error al iniciar sesión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6">
        
        {/* Logo / Encabezado Institucional */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100">
            {/* Opción A: Si prefieres un ícono SVG de balanza / justicia */}
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006 001M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006 0m0 0l3 9m-3-9h-6m-6 0h6" />
            </svg>
            
            {/* Opción B (Si prefieres usar una imagen tuya en vez del SVG):
               <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" /> 
            */}
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Acceso al Sistema</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ingrese su DNI y contraseña 
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Número de DNI
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 12345678"
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              maxLength={4}
              placeholder="••••"
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 tracking-widest text-center text-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-sm disabled:opacity-50 text-sm"
          >
            {loading ? 'Validando...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}