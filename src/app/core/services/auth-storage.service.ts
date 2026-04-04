import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthStorageService {
  private readonly tokenKey = 'bsr.auth.token';
  private readonly userKey = 'bsr.auth.user';
  private readonly legacyTokenKey = 'vibood.auth.token';
  private readonly legacyUserKey = 'vibood.auth.user';

  private get storage(): Storage | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage;
  }

  getToken(): string | null {
    return this.readWithLegacyFallback(this.tokenKey, this.legacyTokenKey);
  }

  setToken(token: string): void {
    this.write(this.tokenKey, token);
  }

  removeToken(): void {
    this.remove(this.tokenKey);
  }

  getUser<T>(): T | null {
    const user = this.readWithLegacyFallback(this.userKey, this.legacyUserKey);

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

  matchesStorageKey(key: string | null): boolean {
    return (
      key === this.tokenKey ||
      key === this.userKey ||
      key === this.legacyTokenKey ||
      key === this.legacyUserKey
    );
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private readWithLegacyFallback(primaryKey: string, legacyKey: string): string | null {
    const primaryValue = this.read(primaryKey);

    if (primaryValue !== null) {
      return primaryValue;
    }

    const legacyValue = this.read(legacyKey);

    if (legacyValue === null) {
      return null;
    }

    this.write(primaryKey, legacyValue);
    this.remove(legacyKey);
    return legacyValue;
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
