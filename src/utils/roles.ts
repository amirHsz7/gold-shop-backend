import type { UserRole } from "../generated/prisma/client.js";

export const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}