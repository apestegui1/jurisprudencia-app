'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Caso {
  id: string
  numero_expediente: string
  caratula: string
  juzgado_tribunal: string
  materia: string
  estado: string
  fecha_inicio: string
}

export default function Home() {
  const [casos, setCasos] = useState<Caso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCasos() {
      try {
        const { data, error } = await supabase.from('casos').select('*')
        if (error) throw error
        setCasos(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCasos()
  }, [])

  return (
    <main className="p-8 max-w-5xl mx-auto font-sans">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Sistema de Jurisprudencia y Audiencias
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Repositorio interno de expedientes, resoluciones y registros en video
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Estado de la Conexión</h2>
        {loading ? (
          <div className="p-4 bg-blue-50 text-blue-700 rounded-lg">
            Cargando expedientes desde Supabase...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <p className="font-semibold">Error al conectar con Supabase:</p>