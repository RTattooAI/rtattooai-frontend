import { Component, input } from '@angular/core';

/** Branded shield + scan-lines mark, inlined so it carries no icon-font dependency. */
@Component({
  selector: 'app-logo-mark',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="rtg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3B82F6" />
          <stop offset="1" stop-color="#1E2761" />
        </linearGradient>
      </defs>
      <path d="M16 2 L28 6 V14 C28 22 22 28 16 30 C10 28 4 22 4 14 V6 Z" fill="url(#rtg)" />
      <path d="M10 13 H22 M10 17 H22 M10 21 H18" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.9" />
      <circle cx="16" cy="11" r="1.6" fill="#fff" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `
})
export class LogoMark {
  readonly size = input<number>(32);
}
