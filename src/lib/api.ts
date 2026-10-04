import type { UserRole } from "@/lib/roles";
import type { VacationColor } from "@/lib/vacations";
import { ApiError } from "./api-error";
import type {
  AdminUser,
  Doctor,
  MonthCalendarEmailResult,
  MonthPublication,
  NightShift,
  Notification,
  Shift,
  UnavailableDate,
  UnavailableDateChangeLog,
  VacationDay,
} from "./contracts";

type ApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type * from "./contracts";

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error ?? fallback,
      response.status,
      body?.code ?? "REQUEST_FAILED",
    );
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
    getAll: async (range?: {
      start: string;
      end: string;
    }): Promise<Shift[]> => {
      const response = await apiFetch(
        range ? `/api/shifts?${new URLSearchParams(range)}` : "/api/shifts",
      );
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
      expectedVersion?: number;
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
      shifts: {
        date: string;
        shiftType: string;
        doctorIds: number[];
        expectedVersion?: number;
      }[],
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

  const nightShiftsApi = {
    getByYear: async (year: number): Promise<NightShift[]> => {
      const response = await apiFetch(`/api/night-shifts?year=${year}`);
      return readJson(response, "Failed to fetch night shifts");
    },
    update: async (
      date: string,
      doctorIds: number[],
      expectedVersion?: number,
    ): Promise<NightShift> => {
      const response = await apiFetch("/api/night-shifts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date, doctorIds, expectedVersion }),
      });
      return readJson(response, "Failed to update night shifts");
    },
  };

  const unavailableDatesApi = {
    getAll: async (doctorIds?: number[]): Promise<UnavailableDate[]> => {
      const params = new URLSearchParams();

      if (doctorIds && doctorIds.length > 0) {
        params.set("doctorIds", doctorIds.join(","));
      }

      const query = params.toString();
      const response = await apiFetch(
        query ? `/api/unavailable-dates?${query}` : "/api/unavailable-dates",
      );
      return readJson(response, "Failed to fetch unavailable dates");
    },
    getByDoctor: async (doctorId: number): Promise<UnavailableDate[]> => {
      const response = await apiFetch(
        `/api/doctors/${doctorId}/unavailable-dates`,
      );
      return readJson(response, "Failed to fetch unavailable dates");
    },

    getLogs: async (doctorId: number): Promise<UnavailableDateChangeLog[]> => {
      const response = await apiFetch(
        `/api/doctors/${doctorId}/unavailable-dates/logs`,
      );
      return readJson(response, "Failed to fetch unavailable date logs");
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
    edit: async (
      changes: {
        doctorId: number;
        date: string;
        color: VacationColor | null;
      }[],
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      return readJson(response, "Urlaub konnte nicht gespeichert werden.");
    },
    updateApproval: async (
      id: number,
      approved: boolean,
      expectedColor?: string,
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, approved, expectedColor }),
      });
      return readJson(response, "Failed to update vacation approval");
    },
    deny: async (
      id: number,
      expectedColor?: string,
    ): Promise<{ success: boolean }> => {
      const response = await apiFetch("/api/vacations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, expectedColor }),
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

  const monthPublicationsApi = {
    getByMonth: async (month: string): Promise<MonthPublication> => {
      const response = await apiFetch(`/api/month-publications/${month}`);
      return readJson(response, "Failed to fetch month publication");
    },
    update: async (
      month: string,
      isPublished: boolean,
    ): Promise<MonthPublication> => {
      const response = await apiFetch(`/api/month-publications/${month}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublished }),
      });
      return readJson(response, "Failed to update month publication");
    },
  };

  const monthCalendarEmailsApi = {
    preview: async (
      month: string,
      scope: "shifts" | "departments",
    ): Promise<MonthCalendarEmailResult> => {
      const response = await apiFetch(
        `/api/month-calendar-emails/${month}?scope=${scope}`,
      );
      return readJson(response, "Failed to preview month calendar emails");
    },
    send: async (
      month: string,
      scope: "shifts" | "departments",
      revision: string,
    ): Promise<MonthCalendarEmailResult> => {
      const response = await apiFetch(
        `/api/month-calendar-emails/${month}?scope=${scope}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision }),
        },
      );
      return readJson(response, "Failed to send month calendar emails");
    },
  };

  const adminUsersApi = {
    getAll: async (): Promise<AdminUser[]> => {
      const response = await apiFetch("/api/admin/users", {
        cache: "no-store",
      });
      return readJson(response, "Failed to fetch users");
    },
    update: async (
      userId: number,
      payload: { role?: UserRole; admin?: boolean; doctorId?: number | null },
    ): Promise<AdminUser> => {
      const response = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return readJson(response, "Failed to update user");
    },
    remove: async (userId: number): Promise<{ success: boolean }> => {
      const response = await apiFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      return readJson(response, "Failed to delete user");
    },
  };

  return {
    doctorsApi,
    shiftsApi,
    nightShiftsApi,
    unavailableDatesApi,
    vacationsApi,
    notificationsApi,
    monthPublicationsApi,
    monthCalendarEmailsApi,
    adminUsersApi,
  };
}
