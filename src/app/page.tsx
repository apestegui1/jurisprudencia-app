'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import NuevaAudienciaModal from '@/components/NuevaAudienciaModal'
import EditarAudienciaModal from '@/components/EditarAudienciaModal'
import LoginModal from '@/components/LoginModal'

interface Audiencia {
  id: string
  titulo: string
  fecha_audiencia: string
  youtube_video_id: string
  duracion_segundos: number
  resumen: string
}

interface UsuarioSesion {
  nombre: string
  rol: string
  dni: string
}

export default function Home() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Filtros avanzados
  const [selectedSede, setSelectedSede] = useState('Todas las sedes')
  const [selectedEtapa, setSelectedEtapa] = useState('Todas las etapas')
  const [selectedDelito, setSelectedDelito] = useState('Todos los delitos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [audienciaAEditar, setAudienciaAEditar] = useState<Audiencia | null>(null)

  // Reproductor por tarjeta
  const [playingAudienciaId, setPlayingAudienciaId] = useState<string | null>(null)
  const playerRef = useRef<any>(null)

  // Verificar sesión activa al cargar
  useEffect(() => {
    const sesionGuardada = localStorage.getItem('usuario_actual')
    if (sesionGuardada) {
      try {
        setUsuario(JSON.parse(sesionGuardada))
      } catch (e) {
        localStorage.removeItem('usuario_actual')
        setIsLoginOpen(true)
      }
    } else {
      setIsLoginOpen(true)
    }
  }, [])

  const fetchAudiencias = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('audiencias')
        .select('*')
        .order('fecha_audiencia', { ascending: false })

      if (error) throw error
      setAudiencias(data || [])
    } catch (err: any) {
      console.error('Error al cargar audiencias:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (usuario) {
      fetchAudiencias()
    }
  }, [usuario])

  // Cargar SDK de YouTube IFrame Player API
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }
  }, [])

  const initPlayer = (videoId: string, audienciaId: string) => {
    const containerId = `youtube-player-${audienciaId}`
    const container = document.getElementById(containerId)
    if (!container) return

    container.innerHTML = ''

    if ((window as any).YT && (window as any).YT.Player) {
      playerRef.current = new (window as any).YT.Player(containerId, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
        },
      })
    }
  }

  const handleTogglePlay = (aud: Audiencia) => {
    if (playingAudienciaId === aud.id) {
      setPlayingAudienciaId(null)
      playerRef.current = null
      return
    }

    setPlayingAudienciaId(aud.id)

    setTimeout(() => {
      initPlayer(aud.youtube_video_id, aud.id)
    }, 300)
  }

  const handleSeek = (timeStr: string, aud: Audiencia) => {
    const parts = timeStr.split(':').map(Number)
    let totalSeconds = 0
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1]
    }

    if (playingAudienciaId !== aud.id) {
      setPlayingAudienciaId(aud.id)
      setTimeout(() => {
        initPlayer(aud.youtube_video_id, aud.id)
        setTimeout(() => {
          if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(totalSeconds, true)
            playerRef.current.playVideo()
          }
        }, 800)
      }, 300)
    } else {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(totalSeconds, true)
        playerRef.current.playVideo()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta audiencia permanentemente?')) return

    try {
      const { error } = await supabase.from('audiencias').delete().eq('id', id)
      if (error) throw error
      alert('Audiencia eliminada con éxito.')
      fetchAudiencias()
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('usuario_actual')
    setUsuario(null)
    setIsLoginOpen(true)
  }

  // Filtrado de audiencias
  const filteredAudiencias = audiencias.filter((item) => {
    const resumen = item.resumen || ''
    const matchSearch =
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resumen.toLowerCase().includes(searchTerm.toLowerCase())

    const sedeMatch = selectedSede === 'Todas las sedes' || resumen.includes(selectedSede)
    const etapaMatch = selectedEtapa === 'Todas las etapas' || resumen.includes(selectedEtapa)
    const delitoMatch = selectedDelito === 'Todos los delitos' || resumen.includes(selectedDelito)

    let fechaMatch = true
    if (item.fecha_audiencia) {
      const itemDate = item.fecha_audiencia.split('T')[0]
      if (fechaDesde && itemDate < fechaDesde) fechaMatch = false
      if (fechaHasta && itemDate > fechaHasta) fechaMatch = false
    }

    return matchSearch && sedeMatch && etapaMatch && delitoMatch && fechaMatch
  })

  // Extraer listas únicas para los selects de filtro
  const sedesList = Array.from(new Set(audiencias.map(a => {
    const m = a.resumen?.match(/\[Sede:\s*([^\]]+)\]/)
    return m ? m[1] : null
  }).filter(Boolean)))

  const etapasList = Array.from(new Set(audiencias.map(a => {
    const m = a.resumen?.match(/\[Etapa:\s*([^\]]+)\]/)
    return m ? m[1] : null
  }).filter(Boolean)))

  const delitosList = Array.from(new Set(audiencias.map(a => {
    const m = a.resumen?.match(/\[Delito:\s*([^\]]+)\]/)
    return m ? m[1] : null
  }).filter(Boolean)))

  // Si no hay usuario logueado, sólo mostramos el Modal de Login
  if (!usuario) {
    return <LoginModal isOpen={isLoginOpen} onLoginSuccess={(u) => { setUsuario(u); setIsLoginOpen(false); }} />
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                {usuario.rol}
              </span>
              <span className="text-xs text-gray-500">Conectado: {usuario.nombre} (DNI: {usuario.dni})</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Buscador de Audiencias y Jurisprudencia
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Consulta registros en video, transcripciones y criterios judiciales oficiales
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Solo Operadores e Instructores pueden dar de alta nuevas audiencias */}
            {usuario.rol !== 'JUEZ' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition shadow-sm flex items-center gap-2 whitespace-nowrap"
              >
                + Alta de Audiencia
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-2.5 rounded-xl text-sm transition"
              title="Cerrar Sesión"
            >
              Salir ⎋
            </button>
          </div>
        </div>

        {/* Panel de Filtros y Búsqueda */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por palabras clave, jurisprudencia, causa, juez, resumen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sede / Subsede</label>
              <select
                value={selectedSede}
                onChange={(e) => setSelectedSede(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Todas las sedes">Todas las sedes</option>
                {sedesList.map((s, idx) => (
                  <option key={idx} value={s!}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Etapa</label>
              <select
                value={selectedEtapa}
                onChange={(e) => setSelectedEtapa(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Todas las etapas">Todas las etapas</option>
                {etapasList.map((et, idx) => (
                  <option key={idx} value={et!}>{et}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Categoría Delito</label>
              <select
                value={selectedDelito}
                onChange={(e) => setSelectedDelito(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Todos los delitos">Todos los delitos</option>
                {delitosList.map((d, idx) => (
                  <option key={idx} value={d!}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Fecha Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Listado de Resultados */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Resultados ({filteredAudiencias.length})
          </h2>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Cargando registros...</div>
          ) : filteredAudiencias.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-gray-400">
              No se encontraron audiencias con los filtros seleccionados.
            </div>
          ) : (
            filteredAudiencias.map((aud) => {
              const pdfMatch = aud.resumen?.match(/\[PDF Resolución \/ Acta:\s*(https?:\/\/[^\]]+)\]/)
              const pdfUrl = pdfMatch ? pdfMatch[1] : null
              const resumenLimpio = aud.resumen ? aud.resumen.replace(/\[PDF Resolution[^\]]+\]\n?/g, '') : ''
              const isPlayingThis = playingAudienciaId === aud.id

              return (
                <div key={aud.id} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                        {aud.fecha_audiencia ? new Date(aud.fecha_audiencia).toLocaleDateString() : 'Sin fecha'}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-2">{aud.titulo}</h3>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {aud.youtube_video_id && (
                        <button
                          onClick={() => handleTogglePlay(aud)}
                          className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 ${
                            isPlayingThis
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-red-50 hover:bg-red-100 text-red-600'
                          }`}
                        >
                          {isPlayingThis ? '✕ Ocultar Video' : '▶ Reproducir Video'}
                        </button>
                      )}

                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
                        >
                          📄 Ver Acta PDF
                        </a>
                      )}

                      {/* INSTRUCTOR y OPERADOR pueden Editar */}
                      {(usuario.rol === 'INSTRUCTOR' || usuario.rol === 'OPERADOR') && (
                        <button
                          onClick={() => {
                            setAudienciaAEditar(aud)
                            setIsEditModalOpen(true)
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition"
                        >
                          ✏️ Editar
                        </button>
                      )}

                      {/* Únicamente el OPERADOR puede Eliminar */}
                      {usuario.rol === 'OPERADOR' && (
                        <button
                          onClick={() => handleDelete(aud.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-lg transition"
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reproductor embebido dentro de la tarjeta */}
                  {isPlayingThis && (
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner border border-slate-800 space-y-2">
                      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                        <div id={`youtube-player-${aud.id}`} className="w-full h-full" />
                      </div>
                    </div>
                  )}

                  {/* Renderizado de transcripción con marcas de tiempo y resaltado de búsqueda */}
                  <div className="bg-gray-50 border rounded-xl p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {resumenLimpio.split('\n').map((line, idx) => {
                      const timeRegex = /\[(\d{2}:\d{2}(?::\d{2})?)\]/g

                      const highlightText = (text: string) => {
                        if (!searchTerm.trim()) return text
                        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
                        const parts = text.split(regex)
                        return parts.map((part, pIdx) =>
                          regex.test(part) ? (
                            <mark key={pIdx} className="bg-yellow-200 text-yellow-900 font-bold px-0.5 rounded">
                              {part}
                            </mark>
                          ) : (
                            part
                          )
                        )
                      }

                      if (timeRegex.test(line)) {
                        const parts = line.split(/(\[\d{2}:\d{2}(?::\d{2})?\])/g)
                        return (
                          <div key={idx} className="my-1">
                            {parts.map((part, pIdx) => {
                              const match = part.match(/\[(\d{2}:\d{2}(?::\d{2})?)\]/)
                              if (match) {
                                const timeStr = match[1]
                                return (
                                  <button
                                    key={pIdx}
                                    onClick={() => handleSeek(timeStr, aud)}
                                    className="inline-flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded mx-1 transition cursor-pointer"
                                  >
                                    ▶ {timeStr}
                                  </button>
                                )
                              }
                              return <span key={pIdx}>{highlightText(part)}</span>
                            })}
                          </div>
                        )
                      }
                      return <div key={idx}>{highlightText(line)}</div>
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal de Alta */}
        <NuevaAudienciaModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchAudiencias}
        />

        {/* Modal de Edición */}
        <EditarAudienciaModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setAudienciaAEditar(null)
          }}
          onSuccess={fetchAudiencias}
          audiencia={audienciaAEditar}
        />

      </div>
    </main>
  )
}