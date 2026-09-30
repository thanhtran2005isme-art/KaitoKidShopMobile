export interface AuthenticatedUser {
  id: number;
  name: string;
  email?: string;
  role?: string;
  claims: Record<string, unknown>;
}
