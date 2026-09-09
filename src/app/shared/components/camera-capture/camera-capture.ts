import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnalysisService } from '../../../core/api';
import { AnalysisPreview, PreviewDetection } from '../../../core/models';
import { Icon } from '../../ui';
import { confidenceBand, detectionColor } from '../../ui/confidence';

/** Lado más largo del fotograma que se envía en el modo en vivo. */
const LIVE_FRAME_MAX_SIDE = 640;
const LIVE_FRAME_QUALITY = 0.6;

/** Pausa mínima entre fotogramas, para no saturar al servicio cuando responde rápido. */
const LIVE_MIN_INTERVAL_MS = 250;

/** Espera tras un rechazo por límite de peticiones. */
const LIVE_BACKOFF_MS = 3000;

const PHOTO_QUALITY = 0.92;

interface LiveBox {
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  label: string;
  verdict: PreviewDetection['verdict'];
}

/**
 * Captura fotografías con la cámara del dispositivo y, opcionalmente, muestra en vivo
 * lo que el modelo reconoce en el encuadre.
 *
 * El modo en vivo no guarda nada: envía un fotograma reducido, dibuja el resultado y lo
 * descarta. Sirve para encuadrar bien antes de capturar, no para sustentar conclusiones.
 * Un fotograma por vez, en serie: sin esta disciplina el navegador encolaría peticiones
 * más rápido de lo que el servicio puede resolverlas.
 */
@Component({
  selector: 'app-camera-capture',
  imports: [Icon],
  templateUrl: './camera-capture.html'
})
export class CameraCapture {
  private readonly analysisService = inject(AnalysisService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  /** Fotografías capturadas, en el orden en que se tomaron. */
  readonly captured = output<File[]>();
  readonly closed = output<void>();

  readonly isStarting = signal(false);
  readonly isActive = signal(false);
  readonly error = signal<string | null>(null);

  readonly shots = signal<File[]>([]);
  readonly shotPreviews = signal<string[]>([]);

  readonly liveMode = signal(false);
  readonly liveResult = signal<AnalysisPreview | null>(null);
  readonly liveError = signal<string | null>(null);

  readonly facingMode = signal<'environment' | 'user'>('environment');
  readonly hasMultipleCameras = signal(false);

  readonly shotCount = computed(() => this.shots().length);

  /** Cajas del modo en vivo, ya escaladas al tamaño en que se está viendo el vídeo. */
  readonly liveBoxes = computed<LiveBox[]>(() => {
    const result = this.liveResult();
    const video = this.videoRef()?.nativeElement;
    if (!result || !video || !result.imageWidth || !result.imageHeight) {
      return [];
    }

    const scaleX = video.clientWidth / result.imageWidth;
    const scaleY = video.clientHeight / result.imageHeight;

    return result.detections.map((detection) => {
      const best = detection.matches[0];
      const pct = best ? Math.round(best.similarity * 100) : 0;
      const label =
        detection.verdict === 'no_match' || !best
          ? 'Sin coincidencia'
          : `${best.band} · ${pct}% (${confidenceBand(pct).label})`;

      return {
        left: `${detection.bbox.x * scaleX}px`,
        top: `${detection.bbox.y * scaleY}px`,
        width: `${detection.bbox.width * scaleX}px`,
        height: `${detection.bbox.height * scaleY}px`,
        color: detectionColor(Math.round(detection.confidence * 100)),
        label,
        verdict: detection.verdict
      };
    });
  });

  private stream: MediaStream | null = null;
  private liveRunning = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopStream());
  }

  async start(): Promise<void> {
    if (this.isActive() || this.isStarting()) {
      return;
    }

    // getUserMedia solo existe en contextos seguros (HTTPS o localhost).
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        'Este navegador no permite usar la cámara desde esta página. Verifique que accede por HTTPS.'
      );
      return;
    }

    this.isStarting.set(true);
    this.error.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode(), width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });

      const video = this.videoRef()?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }

      this.isActive.set(true);
      await this.detectMultipleCameras();
    } catch (err) {
      this.error.set(describeCameraError(err));
      this.stopStream();
    } finally {
      this.isStarting.set(false);
    }
  }

  stop(): void {
    this.stopStream();
    this.closed.emit();
  }

  async switchCamera(): Promise<void> {
    this.facingMode.set(this.facingMode() === 'environment' ? 'user' : 'environment');
    const estabaEnVivo = this.liveMode();
    this.stopStream();
    await this.start();
    if (estabaEnVivo && this.isActive()) {
      this.toggleLive();
    }
  }

  /** Toma una fotografía a la resolución nativa del vídeo. */
  async capture(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.isActive()) {
      return;
    }

    const blob = await grabFrame(video, video.videoWidth, PHOTO_QUALITY);
    if (!blob) {
      this.error.set('No se pudo capturar la fotografía. Intente de nuevo.');
      return;
    }

    const file = new File([blob], `captura-${this.shots().length + 1}-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });

    this.shots.set([...this.shots(), file]);
    this.shotPreviews.set([...this.shotPreviews(), URL.createObjectURL(blob)]);
  }

  removeShot(index: number): void {
    const previews = this.shotPreviews();
    URL.revokeObjectURL(previews[index]);

    this.shots.set(this.shots().filter((_, i) => i !== index));
    this.shotPreviews.set(previews.filter((_, i) => i !== index));
  }

  /** Entrega las capturas a la pantalla de análisis y cierra la cámara. */
  useShots(): void {
    if (this.shots().length === 0) {
      return;
    }

    this.captured.emit(this.shots());
    this.shots.set([]);
    this.shotPreviews.set([]);
    this.stopStream();
  }

  toggleLive(): void {
    if (this.liveMode()) {
      this.liveMode.set(false);
      return;
    }

    this.liveMode.set(true);
    this.liveError.set(null);
    void this.runLiveLoop();
  }

  /**
   * Bucle del modo en vivo: un fotograma a la vez, esperando siempre la respuesta
   * anterior. Así el ritmo lo marca el servicio y no se acumulan peticiones.
   */
  private async runLiveLoop(): Promise<void> {
    if (this.liveRunning) {
      return;
    }
    this.liveRunning = true;

    try {
      while (this.liveMode() && this.isActive()) {
        const video = this.videoRef()?.nativeElement;
        if (!video) {
          break;
        }

        const blob = await grabFrame(video, LIVE_FRAME_MAX_SIDE, LIVE_FRAME_QUALITY);
        if (!blob) {
          await delay(LIVE_MIN_INTERVAL_MS);
          continue;
        }

        try {
          const result = await firstValueFrom(this.analysisService.preview(blob));
          this.liveResult.set(result);
          this.liveError.set(null);
          await delay(LIVE_MIN_INTERVAL_MS);
        } catch (err) {
          const status = (err as { status?: number }).status;
          this.liveError.set(
            status === 429
              ? 'Demasiadas consultas seguidas; el modo en vivo se está conteniendo.'
              : 'El servicio de análisis no responde en este momento.'
          );
          await delay(LIVE_BACKOFF_MS);
        }
      }
    } finally {
      this.liveRunning = false;
      this.liveResult.set(null);
    }
  }

  private async detectMultipleCameras(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.hasMultipleCameras.set(devices.filter((d) => d.kind === 'videoinput').length > 1);
    } catch {
      this.hasMultipleCameras.set(false);
    }
  }

  private stopStream(): void {
    this.liveMode.set(false);
    this.liveResult.set(null);

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }

    this.isActive.set(false);
  }
}

/** Dibuja el fotograma actual en un canvas y lo devuelve como JPEG. */
async function grabFrame(video: HTMLVideoElement, maxSide: number, quality: number): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeCameraError(err: unknown): string {
  const name = (err as { name?: string }).name;

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permiso de cámara denegado. Habilítelo en el navegador y vuelva a intentarlo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró ninguna cámara disponible en este equipo.';
    case 'NotReadableError':
      return 'La cámara está siendo usada por otra aplicación.';
    default:
      return 'No se pudo iniciar la cámara.';
  }
}
