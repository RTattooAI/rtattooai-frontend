import { Component } from '@angular/core';
import { FeaturePlaceholder } from '../../../shared/ui';

@Component({
  selector: 'app-admin-users',
  imports: [FeaturePlaceholder],
  template: `
    <app-feature-placeholder
      icon="users"
      title="Gestión de usuarios"
      description="La administración de cuentas, roles y permisos del personal autorizado estará disponible en una fase posterior."
      badge="Fase 3 · HU-09"
    />
  `
})
export class AdminUsers {}
