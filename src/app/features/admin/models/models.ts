import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ModelsService } from '../../../core/api';
import { ModelInventory, ModelVersion } from '../../../core/models';
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
 */
@Component({
  selector: 'app-admin-models',
  imports: [DatePipe, DecimalPipe, Icon],
  templateUrl: './models.html'
})
export class AdminModels implements OnInit {
  private readonly modelsService = inject(ModelsService);

  readonly inventory = signal<ModelInventory | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rows = computed<VersionRow[]>(() =>
    (this.inventory()?.versions ?? []).map((item) => ({ item, date: parseApiDate(item.registeredAt) }))
  );

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
  }
}
