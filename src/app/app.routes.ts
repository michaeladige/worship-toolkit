import { Routes } from '@angular/router';
import { WorkspaceComponent } from './components/workspace/workspace.component';
import { ManualComponent } from './components/manual/manual.component';

export const routes: Routes = [
  { path: '', component: WorkspaceComponent },
  { path: 'manual', component: ManualComponent },
  { path: '**', redirectTo: '' },
];
