import { Component } from '@angular/core';
import { FeaturePlaceholder } from '../../shared/ui';

@Component({
  selector: 'app-reports',
  imports: [FeaturePlaceholder],
  template: `
    <app-feature-placeholder
      icon="file-text"
      title="Reportes"
      description="La generación y descarga de reportes PDF de los análisis estará disponible en una fase posterior."
      badge="Fase 2 · HU-07"
    />
  `
})
export class Reports {}
