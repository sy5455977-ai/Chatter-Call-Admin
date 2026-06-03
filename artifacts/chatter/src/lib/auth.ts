import { useState, useEffect } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react/custom-fetch';
import { User } from '@workspace/api-client-react/generated/api.schemas';

export function getAuthToken() {
  return localStorage.getItem('chatter_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('chatter_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('chatter_token');
}

export function getAuthUser(): User | null {
  const user = localStorage.getItem('chatter_user');
  return user ? JSON.parse(user) : null;
}

export function setAuthUser(user: User) {
  localStorage.setItem('chatter_user', JSON.stringify(user));
}

export function clearAuthUser() {
  localStorage.removeItem('chatter_user');
}

// Configure custom-fetch to use our token
setAuthTokenGetter(getAuthToken);

export function useAuth() {
  const [user, setUser] = useState<User | null>(getAuthUser());
  const [token, setToken] = useState<string | null>(getAuthToken());

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getAuthUser());
      setToken(getAuthToken());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { user, token };
}
