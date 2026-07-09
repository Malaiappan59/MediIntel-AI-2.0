import type { roles } from "@/lib/constants";

export type UserRole = (typeof roles)[number];

export type AuthState = {
  isAuthenticated: boolean;
  role: UserRole | null;
  username: string | null;
  email: string | null;
  token: string | null;
  refreshToken: string | null;
  permissions: string[];
};

export type LoginPayload = {
  username: string;
  password: string;
  role: UserRole;
};

export type AuthContextValue = AuthState & {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
};
