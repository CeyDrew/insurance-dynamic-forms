import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-designer-page',
  template: `
    <h1>Form Tasarımcısı</h1>
    <p>Sürükle-bırak tasarımcı Faz 5'te gelecek.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerPage {}
