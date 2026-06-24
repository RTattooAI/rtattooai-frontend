import { Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

/**
 * Thin wrapper around lucide's generic icon component so templates can write
 * `<app-icon name="scan-search" [size]="18" class="text-slate-400" />` — matching
 * the lucide usage of the Claude Design source. Icons are registered globally via
 * `provideLucideIcons` in app.config. `name` is the kebab-case lucide id.
 *
 * Utility classes set on the host cascade to the SVG: colour flows through
 * `currentColor`, and the inline-flex host keeps it aligned / positionable.
 */
@Component({
  selector: 'app-icon',
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="name()" [size]="size()" [strokeWidth]="strokeWidth()"></svg>`,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
  `
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input<number | string>(18);
  readonly strokeWidth = input<number | string>(1.75);
}
