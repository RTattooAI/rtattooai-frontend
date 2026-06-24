import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Clean styled placeholder for routed-but-not-yet-implemented features (kept gated per the backlog). */
@Component({
  selector: 'app-feature-placeholder',
  imports: [Icon],
  template: `
    <div class="screen-enter p-4 sm:p-6 lg:p-8">
      <div class="bg-white rounded-lg border border-slate-200 shadow-card max-w-2xl mx-auto p-10 text-center">
        <div class="w-14 h-14 rounded-full bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
          <app-icon [name]="icon()" [size]="26" [strokeWidth]="1.5" />
        </div>
        <h2 class="text-[18px] font-semibold text-navy-900">{{ title() }}</h2>
        <p class="text-[13px] text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">{{ description() }}</p>
        @if (badge()) {
          <span class="inline-block mt-4 text-[11px] font-medium uppercase tracking-wider text-navy-700 bg-navy-50 ring-1 ring-navy-100 px-2.5 py-1 rounded-full">
            {{ badge() }}
          </span>
        }
      </div>
    </div>
  `
})
export class FeaturePlaceholder {
  readonly icon = input<string>('layout-grid');
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly badge = input<string>('');
}
