'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { jsPDF } from 'jspdf'

interface Audiencia {
  id: string
  titulo: string
  fecha_audiencia: string
  youtube_video_id: string
  duracion_segundos: number
  resumen: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  audiencia: Audiencia | null
}

// --- LISTAS OFICIALES CERRADAS ---
const SEDES_OFICIALES = [
  'Posadas',
  'Eldorado',
  'Oberá',
  'Puerto Iguazú',
  ]

const JUECES_OFICIALES = [
  'Dr. Juan Pérez',
  'Dra. María González',
  'Dr. Carlos Alberto Silva',
  'Dra. Ana Sofía Ramírez',
]

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

export default function EditarAudienciaModal({ isOpen, onClose, onSuccess, audiencia }: Props) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    sede_subsede: SEDES_OFICIALES[0],
    carpeta: 'FPO',
    etapa: 'Garantias',
    caratula: '',
    categoria_delito: 'DELITOS CONTRA LAS PERSONAS',
    juez: JUECES_OFICIALES[0],
    palabras_clave: '',
    fecha_audiencia: '',
    duracion_segundos: '',
    youtube_video_id: '',
    resumen: '',
  })

  useEffect(() => {
    if (audiencia) {
      const resumenTexto = audiencia.resumen || ''
      
      let sede = SEDES_OFICIALES[0]
      let carpeta = 'FPO'
      let etapa = 'Garantias'
      let delito = 'DELITOS CONTRA LAS PERSONAS'
      let juez = JUECES_OFICIALES[0]
      let palabras = ''

      const matchSede = resumenTexto.match(/\[Sede:\s*([^\]]+)\]/)
      if (matchSede && matchSede[1]) {
        const sedeEncontrada = matchSede[1].trim()
        sede = SEDES_OFICIALES.includes(sedeEncontrada) ? sedeEncontrada : SEDES_OFICIALES[0]
      }

      const matchCarpeta = resumenTexto.match(/\[Carpeta:\s*([^\]]+)\]/)
      if (matchCarpeta) carpeta = matchCarpeta[1]

      const matchEtapa = resumenTexto.match(/\[Etapa:\s*([^\]]+)\]/)
      if (matchEtapa) etapa = matchEtapa[1]

      const matchDelito = resumenTexto.match(/\[Delito:\s*([^\]]+)\]/)
      if (matchDelito) delito = matchDelito[1]

      const matchJuez = resumenTexto.match(/\[Juez\/a:\s*([^\]]+)\]/)
      if (matchJuez && matchJuez[1]) {
        const juezEncontrado = matchJuez[1].trim()
        juez = JUECES_OFICIALES.includes(juezEncontrado) ? juezEncontrado : JUECES_OFICIALES[0]
      }

      const matchPalabras = resumenTexto.match(/\[Palabras Clave:\s*([^\]]+)\]/)
      if (matchPalabras) palabras = matchPalabras[1]

      const partesResumen = resumenTexto.split('\n\n')
      const resumenLimpio = partesResumen.length > 1 ? partesResumen.slice(1).join('\n\n') : resumenTexto

      let fechaFormateada = ''
      if (audiencia.fecha_audiencia) {
        const d = new Date(audiencia.fecha_audiencia)
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
        fechaFormateada = d.toISOString().slice(0, 16)
      }

      setFormData({
        sede_subsede: sede,
        carpeta: carpeta.startsWith('FPO') ? carpeta : 'FPO' + carpeta,
        etapa: etapa,
        caratula: audiencia.titulo ? audiencia.titulo.split(' - ')[1]?.split(' (')[0] || '' : '',
        categoria_delito: delito,
        juez: juez,
        palabras_clave: palabras,
        fecha_audiencia: fechaFormateada,
        duracion_segundos: audiencia.duracion_segundos ? audiencia.duracion_segundos.toString() : '',
        youtube_video_id: audiencia.youtube_video_id || '',
        resumen: resumenLimpio,
      })
    }
  }, [audiencia])

  if (!isOpen || !audiencia) return null

  // Función para validar y formatear el campo Carpeta sin espacio tras FPO
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
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

      const resumenConPdf = pdfUrl 
        ? `[PDF Resolución / Acta: ${pdfUrl}]\n${formData.resumen}` 
        : formData.resumen

      const cleanVideoId = extractYouTubeId(formData.youtube_video_id)

      const { error } = await supabase
        .from('audiencias')
        .update({
          titulo: `${formData.carpeta} - ${formData.caratula} (${formData.etapa})`,
          fecha_audiencia: formData.fecha_audiencia ? new Date(formData.fecha_audiencia).toISOString() : null,
          youtube_video_id: cleanVideoId,
          duracion_segundos: formData.duracion_segundos ? parseInt(formData.duracion_segundos) : null,
          resumen: `[Sede: ${formData.sede_subsede}] [Carpeta: ${formData.carpeta}] [Etapa: ${formData.etapa}] [Delito: ${formData.categoria_delito}] [Juez/a: ${formData.juez}] [Palabras Clave: ${formData.palabras_clave}]\n\n${resumenConPdf}`,
        })
        .eq('id', audiencia.id)

      if (error) throw error

      alert('¡Audiencia actualizada con éxito!')
      onSuccess()
      onClose()
    } catch (err: any) {
      alert('Error al actualizar la audiencia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl my-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
          Editar Audiencia
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
                {SEDES_OFICIALES.map((sede, idx) => (
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
                {JUECES_OFICIALES.map((juez, idx) => (
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
            <input
              type="text"
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.youtube_video_id}
              onChange={(e) => setFormData({ ...formData, youtube_video_id: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Reemplazar / Adjuntar Acta (PDF Opcional)
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
                Resumen / Transcripción
              </label>
              {formData.resumen.trim() && (
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 shadow-sm"
                >
                  📄 Descargar Transcripción (PDF)
                </button>
              )}
            </div>
            <textarea
              rows={4}
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
              {loading ? 'Guardando cambios...' : 'Actualizar Audiencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}