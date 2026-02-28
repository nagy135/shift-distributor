export const USER_ROLES = ["doctor", "admin", "secretary"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_USER_ROLE: UserRole = "doctor";
