import { Component, computed, input } from '@angular/core';

const PATTERNS = [
  'radial-gradient(circle at 30% 30%, #475569, #1E293B)',
  'linear-gradient(135deg, #1E2761, #0E1438)',
  'conic-gradient(from 45deg at 50% 50%, #334155, #1E293B, #334155)',
  'radial-gradient(ellipse at 70% 30%, #3B82F6 0%, #1E2761 60%, #0E1438 100%)'
];

/** Deterministic placeholder tile for a catalogue tattoo; shows the real reference image when available. */
@Component({
  selector: 'app-tattoo-thumb',
  template: `
    <div
      class="rounded-md grid place-items-center text-white/40 font-mono text-[10px] shrink-0 ring-1 ring-black/10 overflow-hidden relative"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="background()"
    >
      @if (imageUrl(); as url) {
        <img [src]="url" alt="" class="absolute inset-0 w-full h-full object-cover" />
      } @else {
        <div
          class="absolute inset-0"
          style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 4px, transparent 4px 8px);"
        ></div>
        <span class="relative px-1 truncate max-w-full">{{ id() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `
})
export class TattooThumb {
  readonly id = input<string>('');
  readonly size = input<number>(56);
  readonly imageUrl = input<string | null>(null);

  readonly background = computed(() => {
    const seed = (this.id() || 'x').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return PATTERNS[seed % PATTERNS.length];
  });
}
