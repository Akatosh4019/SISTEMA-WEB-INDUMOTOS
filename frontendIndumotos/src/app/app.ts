import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly theme = inject(ThemeService);
}
