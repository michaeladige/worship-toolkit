import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './manual.component.html',
  styleUrl: './manual.component.scss',
})
export class ManualComponent {}
