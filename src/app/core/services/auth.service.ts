import { computed, Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserInfoResponse,
} from '../interfaces/auth.interface';
import { User, UserRole } from '../interfaces/user.interface';
import { API_ENDPOINTS } from '../constants/api.constants';
import { AuthStorageService } from './auth-storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly roleRedirects: Record<UserRole, string> = {
    admin: '/admin',
    user: '/home',
  };

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStorage = inject(AuthStorageService);
  private readonly currentUserState = signal<User | null>(null);
  private readonly tokenState = signal<string | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenState() && !!this.currentUserState());
  readonly isAdmin = computed(() => this.currentUserState()?.rol === 'admin');

  constructor() {
    this.restoreSession();
    this.registerStorageSync();
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<AuthResponse>(API_ENDPOINTS.auth.login, credentials).pipe(
      switchMap(({ token }) => this.authenticateWithToken(token)),
    );
  }

  register(payload: RegisterRequest): Observable<User> {
    return this.http.post<AuthResponse>(API_ENDPOINTS.auth.register, payload).pipe(
      switchMap(({ token }) => this.authenticateWithToken(token)),
    );
  }

  logout(options: { redirectToLogin?: boolean; redirectToPath?: string | null } = {}): void {
    const { redirectToLogin = true, redirectToPath } = options;

    this.authStorage.clear();
    this.tokenState.set(null);
    this.currentUserState.set(null);

    if (redirectToPath) {
      void this.router.navigate([redirectToPath]);
      return;
    }

    if (redirectToLogin) {
      void this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this.tokenState();
  }

  getHomeRoute(): string {
    const role = this.currentUserState()?.rol;

    if (!role) {
      return '/home';
    }

    return this.roleRedirects[role];
  }

  restoreSession(): void {
    const token = this.authStorage.getToken();
    const user = this.authStorage.getUser<User>();

    if (!token) {
      this.authStorage.clear();
      this.tokenState.set(null);
      this.currentUserState.set(null);
      return;
    }

    this.tokenState.set(token);

    if (user) {
      this.currentUserState.set(user);
      return;
    }

    this.fetchCurrentUser().subscribe({
      next: (currentUser) => {
        this.authStorage.setUser(currentUser);
        this.currentUserState.set(currentUser);
      },
      error: () => {
        this.logout({ redirectToLogin: false });
      },
    });
  }

  private registerStorageSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('storage', (event) => {
      if (!this.authStorage.matchesStorageKey(event.key)) {
        return;
      }

      this.syncSessionFromStorage();
    });
  }

  private setSession(token: string, user: User): void {
    this.authStorage.setToken(token);
    this.authStorage.setUser(user);
    this.tokenState.set(token);
    this.currentUserState.set(user);
  }

  private authenticateWithToken(token: string): Observable<User> {
    this.authStorage.setToken(token);
    this.tokenState.set(token);

    return this.fetchCurrentUser().pipe(
      tap((user) => this.setSession(token, user)),
      catchError((error) => {
        this.logout({ redirectToLogin: false });
        return throwError(() => error);
      }),
    );
  }

  private fetchCurrentUser(): Observable<User> {
    return this.http.get<UserInfoResponse>(API_ENDPOINTS.auth.me).pipe(
      map((response) => this.mapUserInfoResponse(response)),
    );
  }

  private syncSessionFromStorage(): void {
    const token = this.authStorage.getToken();
    const user = this.authStorage.getUser<User>();

    if (!token) {
      this.tokenState.set(null);
      this.currentUserState.set(null);
      return;
    }

    this.tokenState.set(token);

    if (user) {
      this.currentUserState.set(user);
      return;
    }

    this.fetchCurrentUser().subscribe({
      next: (currentUser) => {
        this.authStorage.setUser(currentUser);
        this.currentUserState.set(currentUser);
      },
      error: () => {
        this.tokenState.set(null);
        this.currentUserState.set(null);
      },
    });
  }

  private mapUserInfoResponse(response: UserInfoResponse): User {
    return {
      id: null,
      email: response.email,
      nombre: response.nombre ?? response.firstName ?? response.name ?? null,
      apellidos: response.apellidos ?? response.lastName ?? null,
      rol: this.mapRole(response.role),
      telefono: response.telefono ?? response.phone ?? null,
      avatarUrl: response.avatarUrl ?? null,
    };
  }

  private mapRole(role: string | null | undefined): UserRole {
    if (!role) {
      return 'user';
    }

    return role.includes('ADMIN') ? 'admin' : 'user';
  }
}
