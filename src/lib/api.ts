import type { VacationColor } from "@/lib/vacations";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface Doctor {
  id: number;
  name: string;
  color?: string | null;
  unavailableShiftTypes: string[];
  disabled: boolean;
  oa: boolean;
  createdAt: string;
}

export interface ShiftDoctor {
  id: number;
  name: string;
  color?: string | null;
}

export interface Shift {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: number[];
  doctors: ShiftDoctor[];
}

export interface UnavailableDate {
  id: number;
  doctorId: number;
  date: string;
}

export interface VacationDay {
  id?: number;
  doctorId?: number;
  date: string;
  color: VacationColor;
  approved?: boolean;
  doctorName?: string | null;
}

export interface Notification {
  id: number;
  message: string;
  createdAt?: number | string | null;
}

async function readError(response: Response, fallback: string) {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await readError(response, fallback));
  }

  return response.json();
}

export function createApiClient(apiFetch: ApiFetch = fetch) {
  const doctorsApi = {
    getAll: async (): Promise<Doctor[]> => {
      const response = await apiFetch("/api/doctors");
      return readJson(response, "Failed to fetch doctors");
    },

    create: async (data: {
      name: string;
      unavailableDates?: string[];
    }): Promise<Doctor> => {
      const response = await apiFetch("/api/doctors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return readJson(response, "Failed to create doctor");
    },
    updateColor: async (id: number, color: string | null): Promise<Doctor> => {
      const response = await apiFetch("/api/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, color }),
      });
      return readJson(response, "Failed to update doctor color");
    },
    update: async (
      id: number,
      payload: Partial<
        Pick<
          Doctor,
          "name" | "color" | "unavailableShiftTypes" | "disabled" | "oa"
        >
      >,
    ): Promise<Doctor> => {
      const response = await apiFetch("/api/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      return readJson(response, "Failed to update doctor");
    },
  };

  const shiftsApi = {
    getAll: async (): Promise<Shift[]> => {
      const response = await apiFetch("/api/shifts");
      return readJson(response, "Failed to fetch shifts");
    },

    getByDate: async (date: string): Promise<Shift[]> => {
      const response = await apiFetch(`/api/shifts?date=${date}`);
      return readJson(response, "Failed to fetch shifts for date");
    },

    assign: async (data: {
      date: string;
      shiftType: string;
      doctorIds: number[];
    }): Promise<Shift> => {
      const response = await apiFetch("/api/shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return readJson(response, "Failed to assign shift");
    },

    assignBatch: async (
      shifts: { date: string; shiftType: string; doctorIds: number[] }[],
    ): Promise<Shift[]> => {
      const response = await apiFetch("/api/shifts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shifts }),
      });
      return readJson(response, "Failed to batch assign shifts");
    },
  };

  const unavailableDatesApi = {
    getByDoctor: async (doctorId: number): Promise<UnavailableDate[]> => {
      const response = await apiFetch(`/api/doctors/${doctorId}/unavailable-dates`);
      return readJson(response, "Failed to fetch unavailable dates");
    },

    update: async (
      doctorId: number,
      dates: string[],
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch(
        `/api/doctors/${doctorId}/unavailable-dates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dates }),
        },
      );
      return readJson(response, "Failed to update unavailable dates");
    },
  };

  const vacationsApi = {
    getByYear: async (year: number): Promise<VacationDay[]> => {
      const response = await apiFetch(`/api/vacations?year=${year}`);
      return readJson(response, "Failed to fetch vacation days");
    },
    updateYear: async (
      year: number,
      days: VacationDay[],
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year, days }),
      });
      return readJson(response, "Failed to update vacation days");
    },
    updateApproval: async (
      id: number,
      approved: boolean,
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, approved }),
      });
      return readJson(response, "Failed to update vacation approval");
    },
    deny: async (id: number): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      return readJson(response, "Failed to deny vacation");
    },
  };

  const notificationsApi = {
    getUnread: async (): Promise<Notification[]> => {
      const response = await apiFetch("/api/notifications");
      return readJson(response, "Failed to fetch notifications");
    },
    markAllRead: async (): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return readJson(response, "Failed to update notifications");
    },
  };

  return {
    doctorsApi,
    shiftsApi,
    unavailableDatesApi,
    vacationsApi,
    notificationsApi,
  };
}

export const {
  doctorsApi,
  shiftsApi,
  unavailableDatesApi,
  vacationsApi,
  notificationsApi,
} = createApiClient();
