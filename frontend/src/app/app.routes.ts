import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent),
  },
  {
    path: 'assets',
    loadComponent: () => import('./features/assets/assets.component').then((m) => m.AssetsComponent),
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'expenses',
    loadComponent: () => import('./features/expenses/expenses.component').then((m) => m.ExpensesComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
