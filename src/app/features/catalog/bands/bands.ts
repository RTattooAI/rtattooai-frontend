import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BandsService } from '../../../core/api';
import { Band, DangerLevel, SaveBandRequest } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';
import { Icon } from '../../../shared/ui';

const DANGER_LABELS: Record<DangerLevel, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto'
};

const DANGER_BADGES: Record<DangerLevel, string> = {
  bajo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medio: 'bg-amber-50 text-amber-700 ring-amber-200',
  alto: 'bg-rose-50 text-rose-700 ring-rose-200'
};

interface BandRow {
  item: Band;
  date: Date;
  dangerLabel: string | null;
  dangerBadge: string | null;
}

/**
 * Mantenimiento de bandas criminales (RF-10). La banda es la unidad con la que el
 * sistema expresa una coincidencia, así que hasta ahora se creaban de rebote al
 * enrolar un tatuaje y quedaban como texto suelto, sin alias, región ni nivel.
 */
@Component({
  selector: 'app-bands',
  imports: [DatePipe, Icon],
  templateUrl: './bands.html'
})
export class Bands implements OnInit {
  private readonly bandsService = inject(BandsService);

  readonly dangerLabels = DANGER_LABELS;
  readonly dangerBadges = DANGER_BADGES;
  readonly dangerLevels: DangerLevel[] = ['bajo', 'medio', 'alto'];

  readonly items = signal<Band[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly search = signal('');

  // Formulario: sirve tanto para el alta como para la edición.
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly alias = signal('');
  readonly region = signal('');
  readonly dangerLevel = signal<DangerLevel | ''>('');
  readonly description = signal('');
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly busyId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly deleteTarget = signal<Band | null>(null);

  readonly rows = computed<BandRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    return this.items()
      .filter(
        (item) =>
          term === '' ||
          item.name.toLowerCase().includes(term) ||
          (item.alias ?? '').toLowerCase().includes(term) ||
          (item.region ?? '').toLowerCase().includes(term)
      )
      .map((item) => ({
        item,
        date: parseApiDate(item.createdAt),
        dangerLabel: item.dangerLevel ? DANGER_LABELS[item.dangerLevel] : null,
        dangerBadge: item.dangerLevel ? DANGER_BADGES[item.dangerLevel] : null
      }));
  });

  readonly activeCount = computed(() => this.items().filter((b) => b.active).length);

  ngOnInit(): void {
    this.load();
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.name.set('');
    this.alias.set('');
    this.region.set('');
    this.dangerLevel.set('');
    this.description.set('');
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(band: Band): void {
    this.editingId.set(band.id);
    this.name.set(band.name);
    this.alias.set(band.alias ?? '');
    this.region.set(band.region ?? '');
    this.dangerLevel.set(band.dangerLevel ?? '');
    this.description.set(band.description ?? '');
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onAliasInput(event: Event): void {
    this.alias.set((event.target as HTMLInputElement).value);
  }

  onRegionInput(event: Event): void {
    this.region.set((event.target as HTMLInputElement).value);
  }

  onDangerChange(event: Event): void {
    this.dangerLevel.set((event.target as HTMLSelectElement).value as DangerLevel | '');
  }

  onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  submit(): void {
    const name = this.name().trim();
    if (!name || this.isSubmitting()) {
      return;
    }

    const request: SaveBandRequest = {
      name,
      alias: this.alias().trim() || null,
      region: this.region().trim() || null,
      dangerLevel: this.dangerLevel() || null,
      description: this.description().trim() || null
    };

    this.isSubmitting.set(true);
    this.formError.set(null);

    const editingId = this.editingId();
    const request$ = editingId
      ? this.bandsService.update(editingId, request)
      : this.bandsService.create(request);

    request$.subscribe({
      next: (saved) => {
        this.isSubmitting.set(false);
        this.showForm.set(false);
        this.items.set(
          editingId
            ? this.items().map((item) => (item.id === saved.id ? saved : item))
            : [...this.items(), saved].sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.formError.set(err.error?.error ?? 'No se pudo guardar la banda.');
      }
    });
  }

  isBusy(id: string): boolean {
    return this.busyId() === id;
  }

  toggleActive(band: Band): void {
    if (this.busyId()) {
      return;
    }

    this.busyId.set(band.id);
    this.actionError.set(null);

    this.bandsService.setActive(band.id, !band.active).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.items.set(this.items().map((item) => (item.id === updated.id ? updated : item)));
      },
      error: () => {
        this.busyId.set(null);
        this.actionError.set('No se pudo cambiar el estado de la banda.');
      }
    });
  }

  askDelete(band: Band): void {
    this.actionError.set(null);
    this.deleteTarget.set(band);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const band = this.deleteTarget();
    if (!band || this.busyId()) {
      return;
    }

    this.busyId.set(band.id);

    this.bandsService.remove(band.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.deleteTarget.set(null);
        this.items.set(this.items().filter((item) => item.id !== band.id));
      },
      error: (err) => {
        this.busyId.set(null);
        this.deleteTarget.set(null);
        // 409: la banda todavía sustenta entradas del catálogo.
        this.actionError.set(err.error?.error ?? 'No se pudo borrar la banda.');
      }
    });
  }

  private load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.bandsService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadError.set('No se pudo cargar la lista de bandas.');
      }
    });
  }
}
