import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "La password deve avere almeno 8 caratteri.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "La password deve contenere lettere e numeri.";
  return null;
}
