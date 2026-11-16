export const avatarUrl = (avatar?: string | null): string | null => {
  if (!avatar) return null;
  const value = String(avatar).trim();
  if (!value || ["none", "null", "undefined"].includes(value.toLowerCase())) return null;
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return value;
  if (/^data:image\//i.test(value)) return value;
  if (/^blob:/i.test(value)) return value;
  return null;
};
