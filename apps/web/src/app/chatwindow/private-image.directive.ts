import { Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';

/** Fetch private chat bytes through the authenticated HTTP client; revoke them on navigation. */
@Directive({ selector: 'img[privateImage]', standalone: true })
export class PrivateImageDirective implements OnChanges, OnDestroy {
  @Input() privateImage = '';
  private request?: Subscription;
  private objectUrl?: string;
  constructor(private http: HttpClient, private element: ElementRef<HTMLImageElement>) {}
  ngOnChanges() {
    this.clear();
    if (!this.privateImage) return;
    const base = new URL(environment.api, window.location.origin);
    let url: URL;
    try { url = new URL(this.privateImage, base); } catch { return; }
    if (url.origin !== base.origin || !url.pathname.startsWith('/uploads/')) return;
    this.request = this.http.get(url.href, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.objectUrl = URL.createObjectURL(blob);
        this.element.nativeElement.src = this.objectUrl;
      },
      error: () => { this.element.nativeElement.alt = 'Image unavailable'; },
    });
  }
  private clear() {
    this.request?.unsubscribe();
    this.element.nativeElement.removeAttribute('src');
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
  ngOnDestroy() { this.clear(); }
}
