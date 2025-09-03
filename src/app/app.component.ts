import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'angular-msal-refactored';
  isIframe = false; // ✅ Add this property

  ngOnInit(): void {
    // Check if running in iframe (MSAL compatibility)
    this.isIframe = window !== window.parent && !window.opener;
  }
}