import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { version } from '../../../../package.json';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './manual.component.html',
  styleUrl: './manual.component.scss',
})
export class ManualComponent implements OnDestroy {
  readonly version = version;
  private fragmentSub: Subscription;

  constructor(route: ActivatedRoute) {
    this.fragmentSub = route.fragment.subscribe((fragment) => {
      if (!fragment) return;
      setTimeout(() => {
        document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  ngOnDestroy() {
    this.fragmentSub.unsubscribe();
  }
}
