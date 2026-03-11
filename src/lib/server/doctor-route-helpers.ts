type DoctorWithUnavailableShiftTypes = {
  unavailableShiftTypes: unknown;
};

export function normalizeUnavailableShiftTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function withNormalizedUnavailableShiftTypes<
  T extends DoctorWithUnavailableShiftTypes,
>(doctor: T): Omit<T, "unavailableShiftTypes"> & { unavailableShiftTypes: string[] } {
  return {
    ...doctor,
    unavailableShiftTypes: normalizeUnavailableShiftTypes(
      doctor.unavailableShiftTypes,
    ),
  };
}
