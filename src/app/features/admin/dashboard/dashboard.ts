import { Component } from '@angular/core';
import { FeaturePlaceholder } from '../../../shared/ui';

@Component({
  selector: 'app-admin-dashboard',
  imports: [FeaturePlaceholder],
  template: `
    <app-feature-placeholder
      icon="layout-grid"
      title="Panel de control"
      description="El tablero de métricas e indicadores de uso, con exportación de datos, estará disponible en una fase posterior."
      badge="Fase 3 · HU-10"
    />
  `
})
export class AdminDashboard {}
