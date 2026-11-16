import { environment } from 'src/environments/environment';
import { Injectable } from '@angular/core';
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse 
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class RequestInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let modifiedReq = req;
    const userData = localStorage.getItem('loggedin_user');

    const apiOrigin = new URL(environment.api, window.location.origin).origin;
    const requestOrigin = new URL(req.url, window.location.origin).origin;
    if (userData && requestOrigin === apiOrigin) {
      let token: string | undefined;
      try { token = JSON.parse(userData).token; } catch { localStorage.removeItem('loggedin_user'); }
      if (token) {
        modifiedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    }

    return next.handle(modifiedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          localStorage.removeItem('loggedin_user');
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
