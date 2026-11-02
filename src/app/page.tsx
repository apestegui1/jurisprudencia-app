'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import NuevaAudienciaModal from '@/components/NuevaAudienciaModal'

interface Audiencia {
  id: string
  titulo: string
  fecha_audiencia: string
  youtube_video_id: string
  duracion_segundos: number
  resumen: string
  created_at: string
}

function extractYouTubeId(input: string): string | null {
  if (!input) return null
  const cleanInput = input.trim()
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = cleanInput.match(regExp)

  if (match && match[2].length === 11) {
    return match[2]
  }
  if (cleanInput.length === 11) {
    return cleanInput
  }
  return null
}

function extractPdfUrl(resumen: string): string | null {
  if (!resumen) return null
  const match = resumen.match(/\[PDF Resolución \/ Acta: (.*?)\]/)
  return match ? match[1] : null
}

export default function Home() {
  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSede, setSelectedSede] = useState('TODAS')
  const [selectedEtapa, setSelectedEtapa] = useState('TODAS')
  const [selectedDelito, setSelectedDelito] = useState('TODOS')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  
  // Estado para controlar qué tarjeta tiene desplegado el video embebido
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const playerRef = useRef<any>(null)

  const fetchAudiencias = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('audiencias')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAudiencias(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAudiencias()
    
    // Cargar la API oficial de iframe de YouTube
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [])

  // Inicializa el reproductor embebido dinámicamente cuando el usuario despliega la tarjeta
  const loadYouTubePlayer = (videoId: string) => {
    setTimeout(() => {
      if (window.YT && window.YT.Player) {
        if (playerRef.current) {
          playerRef.current.destroy()
        }
        playerRef.current = new window.YT.Player(`embedded-player-${videoId}`, {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
          },
        })
      }
    }, 300)
  }

  // Permite saltar a un segundo específico al hacer clic en marcas de tiempo del resumen
  const jumpToTime = (seconds: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }

  const renderInteractiveResumen = (resumenText: string) => {
    if (!resumenText) return null

    const parts = resumenText.split(/(\[[\d:]+\])/g)

    return parts.map((part, index) => {
      const match = part.match(/^\[([\d:]+)\]$/)
      if (match) {
        const timeStr = match[1]
        const timeParts = timeStr.split(':').map(Number)
        let totalSeconds = 0
        if (timeParts.length === 3) {
          totalSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
        } else if (timeParts.length === 2) {
          totalSeconds = timeParts[0] * 60 + timeParts[1]
        }

        return (
          <button
            key={index}
            onClick={() => jumpToTime(totalSeconds)}
            className="inline-block mx-1 px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded text-xs transition shadow-sm cursor-pointer"
            title="Hacer clic para saltar a este minuto en el video embebido"
          >
            ▶ {timeStr}
          </button>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  const filteredAudiencias = audiencias.filter((aud) => {
    const textoCompleto = `${aud.titulo} ${aud.resumen}`.toLowerCase()
    const matchesSearch = textoCompleto.includes(searchTerm.toLowerCase())
    
    const matchesSede =
      selectedSede === 'TODAS' ||
      aud.resumen?.toLowerCase().includes(`[sede: ${selectedSede.toLowerCase()}]`)

    const matchesEtapa =
      selectedEtapa === 'TODAS' ||
      aud.resumen?.toLowerCase().includes(`[etapa: ${selectedEtapa.toLowerCase()}]`)

    const matchesDelito =
      selectedDelito === 'TODOS' ||
      aud.resumen?.toLowerCase().includes(`[delito: ${selectedDelito.toLowerCase()}]`)

    let matchesFechas = true
    if (aud.fecha_audiencia) {
      const fechaAud = aud.fecha_audiencia.split('T')[0]
      if (fechaDesde && fechaAud < fechaDesde) matchesFechas = false
      if (fechaHasta && fechaAud > fechaHasta) matchesFechas = false
    } else if (fechaDesde || fechaHasta) {
      matchesFechas = false
    }

    return matchesSearch && matchesSede && matchesEtapa && matchesDelito && matchesFechas
  })

  return (
    <main className="p-8 max-w-6xl mx-auto font-sans bg-gray-50 min-h-screen">
      <header className="border-b pb-4 mb-6 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Buscador de Audiencias y Jurisprudencia
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Consulta registros en video, transcripciones y criterios judiciales
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
          + Alta de Audiencia
        </button>
      </header>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Buscar por palabras clave, jurisprudencia, causa, juez, resumen..."
            className="w-full border rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none pl-4 pr-10 shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Sede / Subsede
            </label>
            <select
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
            >
              <option value="TODAS">Todas las sedes</option>
              <option value="Posadas">Posadas</option>
              <option value="Obera">Oberá</option>
              <option value="Eldorado">Eldorado</option>
              <option value="Puerto Iguazu">Puerto Iguazú</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Etapa
            </label>
            <select
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={selectedEtapa}
              onChange={(e) => setSelectedEtapa(e.target.value)}
            >
              <option value="TODAS">Todas las etapas</option>
              <option value="Garantias">Garantías</option>
              <option value="Revisión">Revisión</option>
              <option value="Juicio">Juicio</option>
              <option value="Ejecución">Ejecución</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Categoría Delito
            </label>
            <select
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={selectedDelito}
              onChange={(e) => setSelectedDelito(e.target.value)}
            >
              <option value="TODOS">Todos los delitos</option>
              <option value="DELITOS CONTRA LAS PERSONAS">DELITOS CONTRA LAS PERSONAS</option>
              <option value="DELITOS CONTRA EL HONOR">DELITOS CONTRA EL HONOR</option>
              <option value="DELITOS CONTRA LA INTEGRIDAD SEXUAL">DELITOS CONTRA LA INTEGRIDAD SEXUAL</option>
              <option value="DELITOS CONTRA LA PROPIEDAD">DELITOS CONTRA LA PROPIEDAD</option>
              <option value="DELITOS CONTRA LA SEGURIDAD PÚBLICA">DELITOS CONTRA LA SEGURIDAD PÚBLICA</option>
              <option value="DELITOS CONTRA LA ADMINISTRACIÓN PÚBLICA">DELITOS CONTRA LA ADMINISTRACIÓN PÚBLICA</option>
              <option value="ESTUPEFACIENTES -LEY 23737-">ESTUPEFACIENTES -LEY 23737-</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg font-semibold text-gray-800">
            Resultados ({filteredAudiencias.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-blue-600 bg-blue-50 rounded-xl">
            Cargando registros...
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            Error: {error}
          </div>
        ) : filteredAudiencias.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed text-gray-500">
            No se encontraron audiencias que coincidan con la búsqueda o filtros aplicados.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAudiencias.map((aud) => {
              const ytId = extractYouTubeId(aud.youtube_video_id)
              const pdfUrl = extractPdfUrl(aud.resumen)
              const isExpanded = expandedVideoId === aud.id

              return (
                <div
                  key={aud.id}
                  className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {aud.titulo}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        📅 {aud.fecha_audiencia ? new Date(aud.fecha_audiencia).toLocaleString('es-AR') : 'Sin fecha'}
                        {aud.duracion_segundos && ` • ⏱️ ${Math.floor(aud.duracion_segundos / 60)} min`}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                        >
                          📄 Ver Acta / Resolución PDF
                        </a>
                      )}

                      {ytId && (
                        <button
                          onClick={() => {
                            const nextState = isExpanded ? null : aud.id
                            setExpandedVideoId(nextState)
                            if (nextState) {
                              loadYouTubePlayer(ytId)
                            }
                          }}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                            isExpanded
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                          }`}
                        >
                          {isExpanded ? 'Ocultar Video' : '▶ Ver Video Embebido'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contenedor del video embebido directamente dentro de la tarjeta */}
                  {isExpanded && ytId && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border bg-black mt-2 relative">
                      <div id={`embedded-player-${ytId}`} className="w-full h-full" />
                    </div>
                  )}

                  {aud.resumen && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {renderInteractiveResumen(aud.resumen)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <NuevaAudienciaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchAudiencias}
      />
    </main>
  )
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}