import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { catchError, map, of } from 'rxjs';

type BackendStatus = 'checking' | 'up' | 'down';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly http = inject(HttpClient);

  protected readonly backendStatus = toSignal(
    this.http.get<{ status: string }>('/actuator/health').pipe(
      map((res): BackendStatus => (res.status === 'UP' ? 'up' : 'down')),
      catchError(() => of<BackendStatus>('down')),
    ),
    { initialValue: 'checking' as BackendStatus },
  );
}
