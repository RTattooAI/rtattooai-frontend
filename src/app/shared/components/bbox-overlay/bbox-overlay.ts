import { Component, ElementRef, HostListener, computed, input, output, signal, viewChild } from '@angular/core';
import { Detection } from '../../../core/models';
import { detectionColor } from '../../ui';

interface ScaledBox {
  index: number;
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  confidencePct: number;
}

@Component({
  selector: 'app-bbox-overlay',
  templateUrl: './bbox-overlay.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class BboxOverlay {
  readonly imageUrl = input.required<string>();
  readonly imageWidth = input.required<number>();
  readonly imageHeight = input.required<number>();
  readonly detections = input<Detection[]>([]);
  readonly activeIndex = input<number>(0);
  readonly detectionSelected = output<number>();

  private readonly imgEl = viewChild<ElementRef<HTMLImageElement>>('imgEl');
  private readonly renderedSize = signal<{ width: number; height: number } | null>(null);

  readonly scaledBoxes = computed<ScaledBox[]>(() => {
    const size = this.renderedSize();
    if (!size) {
      return [];
    }
    const scaleX = size.width / this.imageWidth();
    const scaleY = size.height / this.imageHeight();
    return this.detections().map((detection, index) => {
      const confidencePct = Math.round(detection.confidence * 100);
      return {
        index,
        left: `${detection.bbox.x * scaleX}px`,
        top: `${detection.bbox.y * scaleY}px`,
        width: `${detection.bbox.width * scaleX}px`,
        height: `${detection.bbox.height * scaleY}px`,
        color: detectionColor(confidencePct),
        confidencePct
      };
    });
  });

  onImageLoad(event: Event): void {
    this.updateRenderedSize(event.target as HTMLImageElement);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const img = this.imgEl()?.nativeElement;
    if (img) {
      this.updateRenderedSize(img);
    }
  }

  select(index: number): void {
    this.detectionSelected.emit(index);
  }

  private updateRenderedSize(img: HTMLImageElement): void {
    this.renderedSize.set({ width: img.clientWidth, height: img.clientHeight });
  }
}
