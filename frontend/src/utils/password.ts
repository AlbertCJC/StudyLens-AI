export interface PasswordRule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lower", label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", label: "One number (0-9)", test: (pw) => /\d/.test(pw) },
  { key: "special", label: "One special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const checkPasswordStrength = (password: string): string | null => {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return null;
};

export const passwordRuleStates = (password: string): Record<string, boolean> => {
  const states: Record<string, boolean> = {};
  for (const rule of PASSWORD_RULES) {
    states[rule.key] = rule.test(password);
  }
  return states;
};
