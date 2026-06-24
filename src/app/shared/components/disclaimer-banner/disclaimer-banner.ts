import { Component, input } from '@angular/core';
import { Icon } from '../../ui';

@Component({
  selector: 'app-disclaimer-banner',
  imports: [Icon],
  templateUrl: './disclaimer-banner.html'
})
export class DisclaimerBanner {
  readonly text = input<string>(
    'Resultado preliminar de apoyo. No constituye identificación definitiva y requiere validación de un analista.'
  );
}
