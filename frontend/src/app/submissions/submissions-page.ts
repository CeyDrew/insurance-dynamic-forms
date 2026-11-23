import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-submissions-page',
  template: `
    <h1>Gelen Cevaplar</h1>
    <p>Cevap listesi Faz 4'te gelecek.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionsPage {}
