export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "analyst";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
