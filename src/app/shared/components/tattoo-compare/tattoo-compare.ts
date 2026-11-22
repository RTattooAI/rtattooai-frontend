import { Component, computed, HostListener, input, output, signal } from '@angular/core';
import { BBox, Match } from '../../../core/models';
import { Icon, TattooThumb } from '../../ui';

/** Margen alrededor de la caja para que se vea el contorno del tatuaje y no solo su interior. */
const CROP_MARGIN = 0.12;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
/** Alto de cada panel; debe coincidir con la clase h-[52vh] de la plantilla. */
const PANEL_HEIGHT = '52vh';

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Comparación lado a lado (observación de la validación con la DIRCRI): el tatuaje
 * detectado en la fotografía consultada junto a la imagen de referencia del candidato,
 * con el mismo nivel de acercamiento en ambos lados para cotejar trazos y detalles.
 *
 * El recorte se hace con CSS sobre la imagen original: no se descarga ni se procesa
 * nada adicional, y la imagen que se ve es exactamente la que quedó en el expediente.
 */
@Component({
  selector: 'app-tattoo-compare',
  imports: [Icon, TattooThumb],
  templateUrl: './tattoo-compare.html'
})
export class TattooCompare {
  readonly imageUrl = input.required<string>();
  readonly imageWidth = input.required<number>();
  readonly imageHeight = input.required<number>();
  readonly bbox = input.required<BBox>();
  readonly match = input.required<Match>();
  readonly detectionLabel = input<string>('Detección');

  readonly closed = output<void>();

  readonly zoom = signal(ZOOM_MIN);
  /** Muestra la fotografía completa en lugar del recorte, para ver el contexto. */
  readonly showFullImage = signal(false);

  readonly zoomMin = ZOOM_MIN;
  readonly zoomMax = ZOOM_MAX;

  readonly similarityPct = computed(() => Math.round(this.match().similarity * 100));

  /** Caja ampliada con margen y recortada a los límites de la imagen. */
  readonly crop = computed<CropBox>(() => {
    const b = this.bbox();
    const w = Math.max(1, this.imageWidth());
    const h = Math.max(1, this.imageHeight());
    const mx = b.width * CROP_MARGIN;
    const my = b.height * CROP_MARGIN;
    const x = Math.max(0, b.x - mx);
    const y = Math.max(0, b.y - my);
    const right = Math.min(w, b.x + b.width + mx);
    const bottom = Math.min(h, b.y + b.height + my);
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  });

  /** Estilo de la imagen original para que solo el recorte llene el contenedor. */
  readonly cropImageStyle = computed(() => {
    const c = this.crop();
    return {
      width: `${(this.imageWidth() / c.width) * 100}%`,
      height: `${(this.imageHeight() / c.height) * 100}%`,
      left: `${(-c.x / c.width) * 100}%`,
      top: `${(-c.y / c.height) * 100}%`
    };
  });

  readonly cropAspect = computed(() => `${this.crop().width} / ${this.crop().height}`);

  /**
   * Ancho del recorte: llena el panel sin pasarse de su alto (PANEL_HEIGHT) y sin
   * deformarse, porque el alto lo da aspect-ratio.
   */
  readonly cropWidth = computed(() => `min(100%, calc(${PANEL_HEIGHT} * ${this.crop().width / this.crop().height}))`);

  /** Caja de la detección sobre la fotografía completa, en porcentajes. */
  readonly fullBoxStyle = computed(() => {
    const b = this.bbox();
    const w = Math.max(1, this.imageWidth());
    const h = Math.max(1, this.imageHeight());
    return {
      left: `${(b.x / w) * 100}%`,
      top: `${(b.y / h) * 100}%`,
      width: `${(b.width / w) * 100}%`,
      height: `${(b.height / h) * 100}%`
    };
  });

  readonly fullAspect = computed(() => `${Math.max(1, this.imageWidth())} / ${Math.max(1, this.imageHeight())}`);

  readonly fullWidth = computed(
    () => `min(100%, calc(${PANEL_HEIGHT} * ${Math.max(1, this.imageWidth()) / Math.max(1, this.imageHeight())}))`
  );

  zoomIn(): void {
    this.zoom.update((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }

  zoomOut(): void {
    this.zoom.update((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }

  onZoomInput(event: Event): void {
    this.zoom.set(Number((event.target as HTMLInputElement).value));
  }

  resetZoom(): void {
    this.zoom.set(ZOOM_MIN);
  }

  toggleFullImage(): void {
    this.showFullImage.update((v) => !v);
    this.zoom.set(ZOOM_MIN);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
