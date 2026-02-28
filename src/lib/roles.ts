export const USER_ROLES = ["doctor", "shift_assigner", "secretary"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_USER_ROLE: UserRole = "doctor";
