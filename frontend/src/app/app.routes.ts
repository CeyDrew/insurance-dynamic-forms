import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home').then((m) => m.Home), title: 'Ana Sayfa' },
  {
    path: 'designer',
    loadComponent: () => import('./designer/designer-page').then((m) => m.DesignerPage),
    title: 'Form Tasarımcısı',
  },
  {
    path: 'fill',
    loadComponent: () => import('./fill/fill-page').then((m) => m.FillPage),
    title: 'Form Doldur',
  },
  {
    path: 'submissions',
    loadComponent: () => import('./submissions/submissions-page').then((m) => m.SubmissionsPage),
    title: 'Gelen Cevaplar',
  },
  { path: '**', redirectTo: '' },
];
