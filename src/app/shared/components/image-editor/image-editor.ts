import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { Icon } from '../../ui';

/** Lado máximo del lienzo de trabajo: acota la memoria y el coste de repintar. */
const PREVIEW_MAX_SIDE = 720;

/** Calidad del JPEG resultante: la misma que usa la captura por cámara. */
const OUTPUT_QUALITY = 0.92;

interface CropRect {
  /** Coordenadas normalizadas (0–1) sobre la imagen ya rotada. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ajuste de la fotografía antes de analizarla (RF-02): rotar, recortar y corregir
 * brillo y contraste.
 *
 * Todo ocurre en el navegador y sobre una copia: el archivo original que eligió el
 * usuario no se toca, y el análisis recibe un archivo nuevo. Esto importa para la
 * trazabilidad — lo que se guarda en el expediente es exactamente la imagen que se
 * analizó, no una que el servidor haya reinterpretado por su cuenta.
 *
 * Las correcciones son de encuadre y exposición. No se ofrece nada que invente
 * detalle (enfoque, superresolución): en un contexto pericial, un detalle que el
 * sensor no capturó no debe aparecer en la imagen que sustenta un informe.
 */
@Component({
  selector: 'app-image-editor',
  imports: [Icon],
  templateUrl: './image-editor.html'
})
export class ImageEditor implements OnDestroy {
  /** Fotografía a ajustar. Se lee una vez al abrirse el editor. */
  readonly file = input.required<File>();

  /** Imagen ya ajustada, lista para sustituir a la original. */
  readonly applied = output<File>();
  readonly cancelled = output<void>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly surfaceRef = viewChild<ElementRef<HTMLElement>>('surface');

  readonly rotation = signal(0);
  readonly brightness = signal(100);
  readonly contrast = signal(100);
  readonly crop = signal<CropRect | null>(null);

  readonly isReady = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  /** Rectángulo que se está dibujando ahora mismo, en coordenadas del lienzo. */
  readonly dragRect = signal<{ left: number; top: number; width: number; height: number } | null>(null);

  private image: HTMLImageElement | null = null;
  private objectUrl: string | null = null;
  private dragStart: { x: number; y: number } | null = null;

  readonly hasChanges = computed(
    () => this.rotation() !== 0 || this.brightness() !== 100 || this.contrast() !== 100 || this.crop() !== null
  );

  /** Recuadro del recorte sobre el lienzo mostrado, en porcentaje. */
  readonly cropStyle = computed(() => {
    const crop = this.crop();
    if (!crop) {
      return null;
    }
    return {
      left: `${crop.x * 100}%`,
      top: `${crop.y * 100}%`,
      width: `${crop.width * 100}%`,
      height: `${crop.height * 100}%`
    };
  });

  constructor() {
    effect(() => {
      const file = this.file();
      this.load(file);
    });

    // Cualquier ajuste vuelve a pintar el lienzo de vista previa.
    effect(() => {
      this.rotation();
      this.brightness();
      this.contrast();
      if (this.isReady()) {
        this.render();
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseObjectUrl();
  }

  rotateLeft(): void {
    this.rotation.set((this.rotation() + 270) % 360);
    // El recorte estaba expresado sobre la orientación anterior: dejarlo sería recortar otra zona.
    this.crop.set(null);
  }

  rotateRight(): void {
    this.rotation.set((this.rotation() + 90) % 360);
    this.crop.set(null);
  }

  onBrightnessInput(event: Event): void {
    this.brightness.set(Number((event.target as HTMLInputElement).value));
  }

  onContrastInput(event: Event): void {
    this.contrast.set(Number((event.target as HTMLInputElement).value));
  }

  clearCrop(): void {
    this.crop.set(null);
  }

  reset(): void {
    this.rotation.set(0);
    this.brightness.set(100);
    this.contrast.set(100);
    this.crop.set(null);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  onPointerDown(event: PointerEvent): void {
    const surface = this.surfaceRef()?.nativeElement;
    if (!surface) {
      return;
    }

    surface.setPointerCapture(event.pointerId);
    const rect = surface.getBoundingClientRect();
    this.dragStart = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.dragRect.set({ left: this.dragStart.x, top: this.dragStart.y, width: 0, height: 0 });
  }

  onPointerMove(event: PointerEvent): void {
    const surface = this.surfaceRef()?.nativeElement;
    const start = this.dragStart;
    if (!surface || !start) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);

    this.dragRect.set({
      left: Math.min(start.x, x),
      top: Math.min(start.y, y),
      width: Math.abs(x - start.x),
      height: Math.abs(y - start.y)
    });
  }

  onPointerUp(event: PointerEvent): void {
    const surface = this.surfaceRef()?.nativeElement;
    const drag = this.dragRect();
    this.dragStart = null;
    this.dragRect.set(null);

    if (!surface || !drag) {
      return;
    }

    surface.releasePointerCapture(event.pointerId);
    const rect = surface.getBoundingClientRect();

    // Un clic suelto no es un recorte: por debajo de este tamaño se ignora, para que
    // pulsar sobre la imagen no deje una selección degenerada.
    if (drag.width < 12 || drag.height < 12) {
      return;
    }

    this.crop.set({
      x: drag.left / rect.width,
      y: drag.top / rect.height,
      width: drag.width / rect.width,
      height: drag.height / rect.height
    });
  }

  /** Compone la imagen final y la devuelve como archivo nuevo. */
  apply(): void {
    const image = this.image;
    if (!image || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    const rotated = this.drawRotated(image);
    const crop = this.crop();

    const sx = crop ? Math.round(crop.x * rotated.width) : 0;
    const sy = crop ? Math.round(crop.y * rotated.height) : 0;
    const sw = crop ? Math.max(1, Math.round(crop.width * rotated.width)) : rotated.width;
    const sh = crop ? Math.max(1, Math.round(crop.height * rotated.height)) : rotated.height;

    const output = document.createElement('canvas');
    output.width = sw;
    output.height = sh;

    const ctx = output.getContext('2d');
    if (!ctx) {
      this.isSaving.set(false);
      this.error.set('El navegador no permitió procesar la imagen.');
      return;
    }

    ctx.filter = this.cssFilter();
    ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, sw, sh);

    output.toBlob(
      (blob) => {
        this.isSaving.set(false);
        if (!blob) {
          this.error.set('No se pudo generar la imagen ajustada.');
          return;
        }

        this.applied.emit(new File([blob], this.editedName(), { type: 'image/jpeg' }));
      },
      'image/jpeg',
      OUTPUT_QUALITY
    );
  }

  private editedName(): string {
    const original = this.file().name.replace(/\.[^.]+$/, '');
    return `${original}-ajustada.jpg`;
  }

  private cssFilter(): string {
    return `brightness(${this.brightness()}%) contrast(${this.contrast()}%)`;
  }

  private load(file: File): void {
    this.releaseObjectUrl();
    this.isReady.set(false);
    this.error.set(null);

    const url = URL.createObjectURL(file);
    this.objectUrl = url;

    const image = new Image();
    image.onload = () => {
      this.image = image;
      this.isReady.set(true);
      this.render();
    };
    image.onerror = () => {
      this.error.set('No se pudo abrir la imagen para editarla.');
    };
    image.src = url;
  }

  /** Dibuja la imagen con la rotación aplicada, a resolución completa. */
  private drawRotated(image: HTMLImageElement): HTMLCanvasElement {
    const rotation = this.rotation();
    const swap = rotation === 90 || rotation === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swap ? image.naturalHeight : image.naturalWidth;
    canvas.height = swap ? image.naturalWidth : image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    }

    return canvas;
  }

  /** Vista previa reducida: lo que se ve mientras se ajusta. */
  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const image = this.image;
    if (!canvas || !image) {
      return;
    }

    const rotated = this.drawRotated(image);
    const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(rotated.width, rotated.height));

    canvas.width = Math.max(1, Math.round(rotated.width * scale));
    canvas.height = Math.max(1, Math.round(rotated.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = this.cssFilter();
    ctx.drawImage(rotated, 0, 0, canvas.width, canvas.height);
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
