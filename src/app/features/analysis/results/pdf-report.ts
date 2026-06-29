import jsPDF from 'jspdf';
import { Analysis, Detection } from '../../../core/models';
import { detectionColor } from '../../../shared/ui';

const PAGE_MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const VALIDATION_LABELS: Record<Detection['validationStatus'], string> = {
  pending: 'Pendiente de validación',
  validated: 'Validada',
  review: 'En revisión',
  dismissed: 'Descartada'
};

const VERDICT_LABELS: Record<Detection['verdict'], string> = {
  match: 'Coincidencia',
  no_match: 'Sin coincidencia concluyente'
};

interface LoadedImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

async function loadImage(url: string): Promise<LoadedImage> {
  // no-store: la misma URL ya fue cargada por el <img> en modo no-cors (sin headers
  // CORS); si el fetch reutiliza esa respuesta cacheada, el navegador la bloquea.
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const format = blob.type === 'image/png' ? 'PNG' : 'JPEG';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
    img.src = dataUrl;
  });
  return { dataUrl, format, width, height };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_HEIGHT - PAGE_MARGIN) {
    return y;
  }
  doc.addPage();
  return PAGE_MARGIN;
}

export async function buildAnalysisPdf(analysis: Analysis): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RTattooAI — Reporte de análisis', PAGE_MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Análisis ${analysis.id}`, PAGE_MARGIN, y);
  doc.text(new Date(analysis.createdAt).toLocaleString('es-PE'), PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
  y += 5;

  if (analysis.personName || analysis.documentId) {
    doc.text([analysis.personName, analysis.documentId].filter(Boolean).join('  ·  '), PAGE_MARGIN, y);
    y += 5;
  }
  doc.setTextColor(0);
  y += 2;

  const disclaimerLines = doc.splitTextToSize(analysis.disclaimer, CONTENT_WIDTH - 6) as string[];
  const disclaimerHeight = disclaimerLines.length * 4 + 4;
  doc.setFillColor(255, 247, 230);
  doc.setDrawColor(245, 200, 120);
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, disclaimerHeight, 'FD');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 90, 20);
  doc.text(disclaimerLines, PAGE_MARGIN + 3, y + 5);
  doc.setTextColor(0);
  y += disclaimerHeight + 6;

  if (analysis.imageWidth && analysis.imageHeight) {
    try {
      const image = await loadImage(analysis.imageUrl);
      const maxWidth = CONTENT_WIDTH;
      const maxHeight = 95;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

      doc.addImage(image.dataUrl, image.format, PAGE_MARGIN, y, drawWidth, drawHeight);

      const bboxScale = drawWidth / analysis.imageWidth;
      analysis.detections.forEach((det, index) => {
        const [r, g, b] = hexToRgb(detectionColor(Math.round(det.confidence * 100)));
        const bx = PAGE_MARGIN + det.bbox.x * bboxScale;
        const by = y + det.bbox.y * bboxScale;
        const bw = det.bbox.width * bboxScale;
        const bh = det.bbox.height * bboxScale;

        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.7);
        doc.rect(bx, by, bw, bh);

        doc.setFillColor(r, g, b);
        doc.rect(bx, by - 4, 5, 4, 'F');
        doc.setFontSize(7);
        doc.setTextColor(255);
        doc.text(`${index + 1}`, bx + 1.3, by - 1);
        doc.setTextColor(0);
      });

      y += drawHeight + 8;
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(180, 0, 0);
      doc.text('No se pudo cargar la imagen original para incluirla en el reporte.', PAGE_MARGIN, y);
      doc.setTextColor(0);
      y += 8;
    }
  }

  analysis.detections.forEach((det, index) => {
    y = ensureSpace(doc, y, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `Detección ${index + 1} — ${VERDICT_LABELS[det.verdict]} (${Math.round(det.confidence * 100)}%)`,
      PAGE_MARGIN,
      y
    );
    y += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Validación pericial: ${VALIDATION_LABELS[det.validationStatus]}`, PAGE_MARGIN, y);
    y += 5;

    if (det.validationNotes) {
      const noteLines = doc.splitTextToSize(`Observaciones: ${det.validationNotes}`, CONTENT_WIDTH) as string[];
      y = ensureSpace(doc, y, noteLines.length * 4 + 2);
      doc.text(noteLines, PAGE_MARGIN, y);
      y += noteLines.length * 4 + 2;
    }

    const topMatches = [...det.matches].sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    if (topMatches.length > 0) {
      y = ensureSpace(doc, y, 5 + topMatches.length * 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Top coincidencias', PAGE_MARGIN, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      topMatches.forEach((match) => {
        y = ensureSpace(doc, y, 4.5);
        doc.text(
          `${match.catalogId}  ·  ${match.band || 'Sin banda asignada'}  ·  ${Math.round(match.similarity * 100)}%`,
          PAGE_MARGIN + 3,
          y
        );
        y += 4.5;
      });
    }

    y += 5;
  });

  return doc;
}
