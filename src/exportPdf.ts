import { jsPDF } from "jspdf";

interface DatosTranscripcion {
  tituloAudiencia: string;
  expediente?: string;
  fecha?: string;
  textoTranscripcion: string;
}

export const descargarTranscripcionPDF = ({
  tituloAudiencia,
  expediente = "S/N",
  fecha = new Date().toLocaleDateString("es-AR"),
  textoTranscripcion,
}: DatosTranscripcion) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margenIzquierdo = 20;
  const margenDerecho = 20;
  const anchoUtil = 210 - margenIzquierdo - margenDerecho; // Ancho A4 en mm
  const altoPagina = 297; // Alto A4 en mm
  let y = 25;

  // --- ENCABEZADO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ACTA DE TRANSCRIPCIÓN DE AUDIENCIA", margenIzquierdo, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Causa / Audiencia: ${tituloAudiencia}`, margenIzquierdo, y);
  y += 5;
  doc.text(`Expediente / Carpeta: ${expediente}  |  Emisión: ${fecha}`, margenIzquierdo, y);
  y += 6;

  // Línea separadora
  doc.setDrawColor(180, 180, 180);
  doc.line(margenIzquierdo, y, 210 - margenDerecho, y);
  y += 10;

  // --- CUERPO DE LA TRANSCRIPCIÓN ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);

  // Divide el texto automáticamente para que se adapte a los márgenes
  const lineas = doc.splitTextToSize(textoTranscripcion, anchoUtil);

  lineas.forEach((linea: string) => {
    // Salto de página automático si se acaba el espacio
    if (y > altoPagina - 25) {
      doc.addPage();
      y = 20;
    }
    doc.text(linea, margenIzquierdo, y);
    y += 6; // Espaciado entre líneas
  });

  // --- PIE DE PÁGINA INSTITUCIONAL EN TODAS LAS HOJAS ---
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    
    // Línea sutil arriba del pie
    doc.setDrawColor(210, 210, 210);
    doc.line(margenIzquierdo, altoPagina - 18, 210 - margenDerecho, altoPagina - 18);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    
    // Leyenda solicitada
    doc.text("Transcripcion realizada en el sistema LEX100", margenIzquierdo, altoPagina - 12);
    
    // Numeración de páginas a la derecha
    doc.text(`Página ${i} de ${totalPaginas}`, 210 - margenDerecho, altoPagina - 12, {
      align: "right",
    });
  }

  // Descarga automática del archivo
  const nombreArchivo = `Transcripcion_${tituloAudiencia.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(nombreArchivo);
};