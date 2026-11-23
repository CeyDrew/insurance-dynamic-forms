import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-fill-page',
  template: `
    <h1>Form Doldur</h1>
    <p>Form renderer Faz 3'te gelecek.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FillPage {}
