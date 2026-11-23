import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly navItems: readonly NavItem[] = [
    { path: '/', label: 'Ana Sayfa', icon: 'home' },
    { path: '/designer', label: 'Form Tasarımcısı', icon: 'design_services' },
    { path: '/fill', label: 'Form Doldur', icon: 'edit_note' },
    { path: '/submissions', label: 'Gelen Cevaplar', icon: 'inbox' },
  ];
}
