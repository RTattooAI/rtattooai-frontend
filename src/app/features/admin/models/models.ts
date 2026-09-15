import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ModelsService } from '../../../core/api';
import { AuthService } from '../../../core/auth';
import { GalleryConsistency, GalleryRepairResult, ModelInventory, ModelVersion } from '../../../core/models';
import { parseApiDate } from '../../../core/utils/parse-api-date';
import { Icon } from '../../../shared/ui';

interface VersionRow {
  item: ModelVersion;
  date: Date;
}

/**
 * Versiones del modelo y sus métricas (RF-16).
 *
 * Cada consulta guarda la versión con la que se resolvió. Esta pantalla es lo que
 * permite leer un resultado antiguo con las cifras que le corresponden y no con las
 * del modelo que esté cargado hoy, que es justamente el riesgo cuando se reentrena.
 *
 * También muestra si el catálogo y la galería siguen describiendo los mismos tatuajes.
 * Cuando dejan de hacerlo el sistema no falla: reconoce un tatuaje con el código, y la
 * banda, de otro. Pasó el 11/09/2026 y nadie lo vio hasta que un análisis lo mostró.
 */
@Component({
  selector: 'app-admin-models',
  imports: [DatePipe, DecimalPipe, Icon],
  templateUrl: './models.html'
})
export class AdminModels implements OnInit {
  private readonly modelsService = inject(ModelsService);
  private readonly authService = inject(AuthService);

  readonly inventory = signal<ModelInventory | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly gallery = signal<GalleryConsistency | null>(null);
  readonly galleryError = signal<string | null>(null);
  readonly canRepair = this.authService.hasRole('admin');
  readonly confirmingRepair = signal(false);
  readonly isRepairing = signal(false);
  readonly repairResult = signal<GalleryRepairResult | null>(null);
  readonly repairError = signal<string | null>(null);

  readonly rows = computed<VersionRow[]>(() =>
    (this.inventory()?.versions ?? []).map((item) => ({ item, date: parseApiDate(item.registeredAt) }))
  );

  /** Códigos que la reparación tocaría, sin contar dos veces los que aparecen en varias listas. */
  readonly affectedCodes = computed(() => {
    const g = this.gallery();
    if (!g) {
      return 0;
    }
    return new Set([...g.missingInGallery, ...g.orphansInGallery, ...g.imageMismatch, ...g.sharedVectors.flat()])
      .size;
  });

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  /** Las métricas se guardan en tanto por uno; en pantalla se leen mejor en porcentaje. */
  pct(value: number | null): number | null {
    return value == null ? null : value * 100;
  }

  askRepair(): void {
    this.repairError.set(null);
    this.confirmingRepair.set(true);
  }

  cancelRepair(): void {
    this.confirmingRepair.set(false);
  }

  repair(): void {
    if (!this.canRepair || this.isRepairing()) {
      return;
    }

    this.isRepairing.set(true);
    this.repairError.set(null);

    this.modelsService.repairGallery().subscribe({
      next: (result) => {
        this.isRepairing.set(false);
        this.confirmingRepair.set(false);
        this.repairResult.set(result);
        this.gallery.set(result.after);
      },
      error: (err) => {
        this.isRepairing.set(false);
        this.repairError.set(err.error?.error ?? 'No se pudo reparar la galería.');
      }
    });
  }

  private load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.modelsService.inventory().subscribe({
      next: (inventory) => {
        this.inventory.set(inventory);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el inventario de modelos.');
      }
    });

    this.galleryError.set(null);
    this.modelsService.galleryConsistency().subscribe({
      next: (gallery) => this.gallery.set(gallery),
      error: () => this.galleryError.set('No se pudo comprobar la coherencia entre catálogo y galería.')
    });
  }
}
