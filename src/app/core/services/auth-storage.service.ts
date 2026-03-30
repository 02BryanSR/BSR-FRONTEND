import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthStorageService {
  private readonly tokenKey = 'vibood.auth.token';
  private readonly userKey = 'vibood.auth.user';

  private get storage(): Storage | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage;
  }

  getToken(): string | null {
    return this.read(this.tokenKey);
  }

  setToken(token: string): void {
    this.write(this.tokenKey, token);
  }

  removeToken(): void {
    this.remove(this.tokenKey);
  }

  getUser<T>(): T | null {
    const user = this.read(this.userKey);

    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user) as T;
    } catch {
      this.remove(this.userKey);
      return null;
    }
  }

  setUser<T>(user: T): void {
    this.write(this.userKey, JSON.stringify(user));
  }

  removeUser(): void {
    this.remove(this.userKey);
  }

  clear(): void {
    this.removeToken();
    this.removeUser();
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      this.remove(key);
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {}
  }
}
