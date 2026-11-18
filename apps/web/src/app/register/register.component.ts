import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterUser } from '../models/tag.model';
import { AuthService } from 'src/core/http/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  email: string = '';
  password: string = '';
  flname: string = '';
  confirmPassword: string = '';
  acceptedTerms: boolean = false;
  readonly termsUrl = 'https://ariyoo-docs.onrender.com/privacy/ariyoo-terms.html';
  readonly privacyUrl = 'https://ariyoo-docs.onrender.com/privacy/ariyoo.html';


  constructor(private router: Router, private authService: AuthService) {}

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (this.password.length < 12) {
      alert('Use a password of at least 12 characters');
      return;
    }
    if (!this.acceptedTerms) {
      alert('Please accept the Terms of Use and Privacy Policy');
      return;
    }

    const newUser:RegisterUser = {  
      email: this.email,
      password: this.password,
      flname: this.flname,
      isSeeker: true,
      isSolver: false,
      acceptedTerms: true
    }

    this.authService.register(newUser).subscribe(
      response => {
        this.router.navigate(['/login']);
      },
      error => {
        alert('Registration failed: ' + (error?.error?.message || error.message));
      }
    );
    
    
  }
}
