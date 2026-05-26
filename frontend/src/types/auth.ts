export interface User {
  id: number;
  username: string;
  email: string;
  avatar_emoji?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  avatar_emoji?: string;
}

