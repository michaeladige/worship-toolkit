import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { version } from '../../../../package.json';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './manual.component.html',
  styleUrl: './manual.component.scss',
})
export class ManualComponent {
  readonly version = version;
}
