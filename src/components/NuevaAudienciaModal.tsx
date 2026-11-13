'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { jsPDF } from 'jspdf'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function extractYouTubeId(input: string): string {
  if (!input) return ''
  const cleanInput = input.trim()
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = cleanInput.match(regExp)

  if (match && match[2].length === 11) {
    return match[2]
  }
  if (cleanInput.length === 11) {
    return cleanInput
  }
  return cleanInput
}

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

export default function NuevaAudienciaModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [fetchingYT, setFetchingYT] = useState(false)
  const [fetchingTranscript, setFetchingTranscript] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  // Listas dinámicas para los selects
  const [sedesDisponibles, setSedesDisponibles] = useState<string[]>([
    'Posadas',
    'Eldorado',
    'Oberá',
    'Puerto Iguazú',
      ])
  const [juecesDisponibles, setJuecesDisponibles] = useState<string[]>([
    'Dr. Juan Pérez',
    'Dra. María González',
    'Dr. Carlos Alberto Silva',
    'Dra. Ana Sofía Ramírez',
  ])
  
  const [formData, setFormData] = useState({
    sede_subsede: 'Posadas',
    carpeta: 'FPO',
    etapa: 'Garantias',
    caratula: '',
    categoria_delito: 'DELITOS CONTRA LAS PERSONAS',
    juez: 'Dr. Juan Pérez',
    palabras_clave: '',
    fecha_audiencia: '',
    duracion_segundos: '',
    youtube_video_id: '',
    resumen: '',
  })

  // Cargar opciones existentes desde la base de datos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      setFormData((prev) => ({
        ...prev,
        fecha_audiencia: now.toISOString().slice(0, 16),
        carpeta: prev.carpeta.startsWith('FPO') ? prev.carpeta : 'FPO',
      }))

      }
  }, [isOpen])

  const fetchSedesYJuecesExistentes = async () => {
    try {
      const { data, error } = await supabase.from('audiencias').select('resumen')
      if (error) throw error

      if (data) {
        const sedesSet = new Set<string>(['Posadas', 'Eldorado', 'Oberá', 'Puerto Iguazú'])
        const juecesSet = new Set<string>(['Dr. Juan Pérez', 'Dra. María González'])

        data.forEach((item) => {
          const mSede = item.resumen?.match(/\[Sede:\s*([^\]]+)\]/)
          if (mSede && mSede[1]) sedesSet.add(mSede[1].trim())

          const mJuez = item.resumen?.match(/\[Juez\/a:\s*([^\]]+)\]/)
          if (mJuez && mJuez[1]) juecesSet.add(mJuez[1].trim())
        })

        setSedesDisponibles(Array.from(sedesSet))
        setJuecesDisponibles(Array.from(juecesSet))
      }
    } catch (err) {
      console.error('Error al cargar opciones dinámicas:', err)
    }
  }

  if (!isOpen) return null

  // Validación de carpeta sin espacio tras FPO
  const handleCarpetaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value
    if (!valor.startsWith('FPO')) {
      valor = 'FPO' + valor.replace(/^FPO\s*/i, '')
    }
    const limpio = valor.replace(/[^FPO0-9/]/gi, '')
    setFormData({ ...formData, carpeta: limpio })
  }

  const handleDownloadPDF = () => {
    if (!formData.resumen.trim()) {
      alert('No hay texto de transcripción para descargar.')
      return
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const margenIzquierdo = 20
    const margenDerecho = 20
    const anchoUtil = 210 - margenIzquierdo - margenDerecho
    const altoPagina = 297
    let y = 25

    // --- ENCABEZADO INSTITUCIONAL ---
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text('ACTA DE TRANSCRIPCIÓN DE AUDIENCIA', margenIzquierdo, y)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(70, 70, 70)

    const caratulaTexto = formData.caratula.trim() || 'Sin carátula especificada'
    const carpetaTexto = formData.carpeta.trim() || 'S/N'
    const sedeTexto = formData.sede_subsede.trim() || 'No especificada'
    const juezTexto = formData.juez.trim() || 'No especificado'
    const fechaFormateada = formData.fecha_audiencia
      ? new Date(formData.fecha_audiencia).toLocaleString('es-AR')
      : new Date().toLocaleDateString('es-AR')

    doc.text(`Carátula: ${caratulaTexto}`, margenIzquierdo, y)
    y += 5
    doc.text(`Carpeta: ${carpetaTexto}  |  Sede: ${sedeTexto}  |  Etapa: ${formData.etapa}`, margenIzquierdo, y)
    y += 5
    doc.text(`Juez/a: ${juezTexto}  |  Fecha Audiencia: ${fechaFormateada}`, margenIzquierdo, y)
    y += 6

    doc.setDrawColor(180, 180, 180)
    doc.line(margenIzquierdo, y, 210 - margenDerecho, y)
    y += 10

    // --- CUERPO DE LA TRANSCRIPCIÓN ---
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 20)

    const lineas = doc.splitTextToSize(formData.resumen, anchoUtil)

    lineas.forEach((linea: string) => {
      if (y > altoPagina - 25) {
        doc.addPage()
        y = 20
      }
      doc.text(linea, margenIzquierdo, y)
      y += 6
    })

    // --- PIE DE PÁGINA EN TODAS LAS HOJAS ---
    const totalPaginas = doc.getNumberOfPages()
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i)

      doc.setDrawColor(210, 210, 210)
      doc.line(margenIzquierdo, altoPagina - 18, 210 - margenDerecho, altoPagina - 18)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)

      doc.text('Transcripcion realizada en el sistema LEX100', margenIzquierdo, altoPagina - 12)
      doc.text(`Página ${i} de ${totalPaginas}`, 210 - margenDerecho, altoPagina - 12, {
        align: 'right',
      })
    }

    const baseNombre = formData.carpeta.trim() || formData.caratula.trim() || 'Audiencia'
    const nombreLimpio = baseNombre.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`Transcripcion_${nombreLimpio}.pdf`)
  }

  const handleFetchYouTubeMetadata = async () => {
    const videoId = extractYouTubeId(formData.youtube_video_id)
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY

    if (!videoId || videoId.length !== 11) {
      alert('Por favor, ingresa un ID o URL de YouTube válido (11 caracteres).')
      return
    }

    if (!apiKey) {
      alert('Falta configurar NEXT_PUBLIC_YOUTUBE_API_KEY en el archivo .env.local')
      return
    }

    try {
      setFetchingYT(true)
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
      )
      const data = await res.json()

      if (data.items && data.items.length > 0) {
        const item = data.items[0]
        const ytTitle = item.snippet.title
        const rawDuration = item.contentDetails.duration
        const totalSeconds = parseISO8601Duration(rawDuration)

        setFormData((prev) => ({
          ...prev,
          youtube_video_id: videoId,
          duracion_segundos: totalSeconds.toString(),
          caratula: prev.caratula || ytTitle,
        }))
        alert('¡Datos de YouTube obtenidos correctamente!')
      } else {
        alert('No se encontró información del video. Verifica el ID y la API Key.')
      }
    } catch (err: any) {
      alert('Error al consultar la API de YouTube: ' + err.message)
    } finally {
      setFetchingYT(false)
    }
  }

  const handleFetchTranscript = async () => {
    const videoId = extractYouTubeId(formData.youtube_video_id)
    if (!videoId || videoId.length !== 11) {
      alert('Ingresa un ID o URL de YouTube válido primero.')
      return
    }

    try {
      setFetchingTranscript(true)
      const res = await fetch(`/api/transcripcion?videoId=${videoId}`)
      const data = await res.json()

      if (data.success) {
        setFormData((prev) => ({
          ...prev,
          resumen: prev.resumen ? `${prev.resumen}\n\n${data.transcript}` : data.transcript,
        }))
        alert('¡Transcripción obtenida e integrada con éxito!')
      } else {
        alert(data.error || 'No se pudo obtener la transcripción.')
      }
    } catch (err: any) {
      alert('Error al conectar con el servidor de transcripciones.')
    } finally {
      setFetchingTranscript(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const cleanVideoId = extractYouTubeId(formData.youtube_video_id)

      if (cleanVideoId) {
        const { data: existenteVideo, error: errVideo } = await supabase
          .from('audiencias')
          .select('id, resumen')
          .eq('youtube_video_id', cleanVideoId)

        if (errVideo) throw errVideo

        if (existenteVideo && existenteVideo.length > 0) {
          alert(`⚠️ Atención: El video de YouTube ingresado ya se encuentra registrado en el sistema.`)
          setLoading(false)
          return
        }
      }

      if (formData.carpeta.trim()) {
        const { data: existenteCarpeta, error: errCarpeta } = await supabase
          .from('audiencias')
          .select('id, resumen')
          .ilike('resumen', `%[Carpeta: ${formData.carpeta.trim()}]%`)

        if (errCarpeta) throw errCarpeta

        if (existenteCarpeta && existenteCarpeta.length > 0) {
          alert(`⚠️ Atención: La carpeta "${formData.carpeta.trim()}" ya cuenta con una audiencia registrada en el sistema.`)
          setLoading(false)
          return
        }
      }

      let pdfUrl = null

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage
          .from('documentos')
          .getPublicUrl(filePath)

        pdfUrl = publicData.publicUrl
      }

      let { data: casosData } = await supabase
        .from('casos')
        .select('id')
        .limit(1)

      let casoIdToUse = null
      if (casosData && casosData.length > 0) {
        casoIdToUse = casosData[0].id
      } else {
        const { data: nuevoCaso, error: errorCrearCaso } = await supabase
          .from('casos')
          .insert([
            {
              numero_expediente: formData.carpeta || 'EXP-AUTO/2026',
              caratula: formData.caratula || 'Audiencia General',
              juzgado_tribunal: formData.sede_subsede || 'Oficina Judicial',
              materia: 'Penal',
              estado: 'En Tramite',
              fecha_inicio: new Date().toISOString().split('T')[0],
            },
          ])
          .select('id')
          .single()

        if (errorCrearCaso) throw errorCrearCaso
        if (nuevoCaso) casoIdToUse = nuevoCaso.id
      }

      const resumenConPdf = pdfUrl 
        ? `[PDF Resolución / Acta: ${pdfUrl}]\n${formData.resumen}` 
        : formData.resumen

      const { error } = await supabase.from('audiencias').insert([
        {
          caso_id: casoIdToUse,
          titulo: formData.caratula || 'Audiencia General',
          fecha_audiencia: formData.fecha_audiencia ? new Date(formData.fecha_audiencia).toISOString() : null,
          youtube_video_id: cleanVideoId,
          duracion_segundos: formData.duracion_segundos ? parseInt(formData.duracion_segundos) : null,
          resumen: `[Sede: ${formData.sede_subsede}] [Carpeta: ${formData.carpeta}] [Etapa: ${formData.etapa}] [Delito: ${formData.categoria_delito}] [Juez/a: ${formData.juez}] [Palabras Clave: ${formData.palabras_clave}]\n\n${resumenConPdf}`,
        },
      ])

      if (error) throw error

      setFormData({
        sede_subsede: sedesDisponibles[0] || 'Posadas',
        carpeta: 'FPO',
        etapa: 'Garantias',
        caratula: '',
        categoria_delito: 'DELITOS CONTRA LAS PERSONAS',
        juez: juecesDisponibles[0] || 'Dr. Juan Pérez',
        palabras_clave: '',
        fecha_audiencia: '',
        duracion_segundos: '',
        youtube_video_id: '',
        resumen: '',
      })
      setFile(null)
      onSuccess()
      onClose()
    } catch (err: any) {
      alert('Error al guardar la audiencia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
          Alta de Audiencia con Transcripción Automática
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                SEDE / Subsede
              </label>
              <select
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.sede_subsede}
                onChange={(e) => setFormData({ ...formData, sede_subsede: e.target.value })}
              >
                {sedesDisponibles.map((sede, idx) => (
                  <option key={idx} value={sede}>
                    {sede}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Carpeta
              </label>
              <input
                type="text"
                required
                placeholder="FPO1234/2026"
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                value={formData.carpeta}
                onChange={handleCarpetaChange}
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Formato automático: FPO[números]/[año]
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                ETAPA
              </label>
              <select
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.etapa}
                onChange={(e) => setFormData({ ...formData, etapa: e.target.value })}
              >
                <option value="Garantias">Garantias</option>
                <option value="Revisión">Revisión</option>
                <option value="Juicio">Juicio</option>
                <option value="Ejecución">Ejecución</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Carátula
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Perez c/ Gonzalez s/ ..."
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.caratula}
                onChange={(e) => setFormData({ ...formData, caratula: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Categoria Delito
            </label>
            <select
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={formData.categoria_delito}
              onChange={(e) => setFormData({ ...formData, categoria_delito: e.target.value })}
            >
              <option value="DELITOS CONTRA LAS PERSONAS">DELITOS CONTRA LAS PERSONAS</option>
              <option value="DELITOS CONTRA EL HONOR">DELITOS CONTRA EL HONOR</option>
              <option value="DELITOS CONTRA LA INTEGRIDAD SEXUAL">DELITOS CONTRA LA INTEGRIDAD SEXUAL</option>
              <option value="DELITOS CONTRA EL ESTADO CIVIL">DELITOS CONTRA EL ESTADO CIVIL</option>
              <option value="TRATA DE PERSONAS -explotación sexual-">TRATA DE PERSONAS -explotación sexual-</option>
              <option value="TRATA DE PERSONAS -explotación laboral-">TRATA DE PERSONAS -explotación laboral-</option>
              <option value="TRATA DE PERSONAS -explotación laboral y sexual-">TRATA DE PERSONAS -explotación laboral y sexual-</option>
              <option value="OTROS DELITOS CONTRA LA LIBERTAD">OTROS DELITOS CONTRA LA LIBERTAD</option>
              <option value="DELITOS CONTRA LA PROPIEDAD">DELITOS CONTRA LA PROPIEDAD</option>
              <option value="DELITOS CONTRA LA SEGURIDAD PÚBLICA">DELITOS CONTRA LA SEGURIDAD PÚBLICA</option>
              <option value="DELITOS CONTRA LA SALUD PÚBLICA">DELITOS CONTRA LA SALUD PÚBLICA</option>
              <option value="DELITOS CONTRA EL ORDEN PÚBLICO">DELITOS CONTRA EL ORDEN PÚBLICO</option>
              <option value="DELITOS CONTRA LA SEGURIDAD DE LA NACIÓN">DELITOS CONTRA LA SEGURIDAD DE LA NACIÓN</option>
              <option value="DELITOS CONTRA LA ADMINISTRACIÓN PÚBLICA">DELITOS CONTRA LA ADMINISTRACIÓN PÚBLICA</option>
              <option value="DELITOS CONTRA LOS PODERES PÚBLICOS Y EL ORDEN CONSTITUCIONAL">DELITOS CONTRA LOS PODERES PÚBLICOS Y EL ORDEN CONSTITUCIONAL</option>
              <option value="DELITOS CONTRA LA FE PÚBLICA">DELITOS CONTRA LA FE PÚBLICA</option>
              <option value="DELITOS CONTRA EL ORDEN ECONÓMICO Y FINANCIERO">DELITOS CONTRA EL ORDEN ECONÓMICO Y FINANCIERO</option>
              <option value="CÓDIGO ADUANERO">CÓDIGO ADUANERO</option>
              <option value="CÓDIGO ADUANERO -estupefacientes-">CÓDIGO ADUANERO -estupefacientes-</option>
              <option value="ESTUPEFACIENTES -LEY 23737-">ESTUPEFACIENTES -LEY 23737-</option>
              <option value="OTRAS LEYES ESPECIALES">OTRAS LEYES ESPECIALES</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Juez / a
              </label>
              <select
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={formData.juez}
                onChange={(e) => setFormData({ ...formData, juez: e.target.value })}
              >
                {juecesDisponibles.map((juez, idx) => (
                  <option key={idx} value={juez}>
                    {juez}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Palabras Clave
              </label>
              <input
                type="text"
                placeholder="Ej: prisión preventiva, peligro de fuga"
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.palabras_clave}
                onChange={(e) => setFormData({ ...formData, palabras_clave: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Fecha y Hora de Audiencia
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.fecha_audiencia}
                onChange={(e) => setFormData({ ...formData, fecha_audiencia: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Duración (en segundos)
              </label>
              <input
                type="number"
                placeholder="Ej: 3600 (Autocompletado)"
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                value={formData.duracion_segundos}
                onChange={(e) => setFormData({ ...formData, duracion_segundos: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              ID o URL del Video de YouTube
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: https://www.youtube.com/watch?v=..."
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.youtube_video_id}
                onChange={(e) => setFormData({ ...formData, youtube_video_id: e.target.value })}
              />
              <button
                type="button"
                onClick={handleFetchYouTubeMetadata}
                disabled={fetchingYT}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg whitespace-nowrap shadow-sm transition disabled:opacity-50"
              >
                {fetchingYT ? 'Consultando...' : '✨ Autocompletar'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Adjuntar Acta / Resolución (PDF)
            </label>
            <input
              type="file"
              accept="application/pdf"
              className="w-full border rounded-lg p-1.5 text-xs text-gray-500 bg-white file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            />
          </div>

          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase">
                Resumen / Transcripción (para búsqueda de jurisprudencia)
              </label>
              <div className="flex items-center gap-2">
                {formData.resumen.trim() && (
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 shadow-sm"
                  >
                    📄 Descargar Transcripción (PDF)
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFetchTranscript}
                  disabled={fetchingTranscript}
                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-md font-semibold transition disabled:opacity-50 flex items-center gap-1"
                >
                  {fetchingTranscript ? 'Extrayendo...' : '📝 Extraer Transcripción de YouTube'}
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              placeholder="Pega aquí el contenido del acta o usa el botón de extracción automática..."
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
              value={formData.resumen}
              onChange={(e) => setFormData({ ...formData, resumen: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {loading ? 'Subiendo y guardando...' : 'Guardar Audiencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}