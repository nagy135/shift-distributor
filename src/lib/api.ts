// API service functions for data operations
import type { VacationColor } from "@/lib/vacations";

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

// Doctors API
export const doctorsApi = {
  getAll: async (): Promise<Doctor[]> => {
    const response = await fetch("/api/doctors");
    if (!response.ok) {
      throw new Error("Failed to fetch doctors");
    }
    return response.json();
  },

  create: async (data: {
    name: string;
    unavailableDates?: string[];
  }): Promise<Doctor> => {
    const response = await fetch("/api/doctors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to create doctor");
    }
    return response.json();
  },
  updateColor: async (id: number, color: string | null): Promise<Doctor> => {
    const response = await fetch("/api/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, color }),
    });
    if (!response.ok) {
      throw new Error("Failed to update doctor color");
    }
    return response.json();
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
    const response = await fetch("/api/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!response.ok) {
      throw new Error("Failed to update doctor");
    }
    return response.json();
  },
};

// Shifts API
export const shiftsApi = {
  getAll: async (): Promise<Shift[]> => {
    const response = await fetch("/api/shifts");
    if (!response.ok) {
      throw new Error("Failed to fetch shifts");
    }
    return response.json();
  },

  getByDate: async (date: string): Promise<Shift[]> => {
    const response = await fetch(`/api/shifts?date=${date}`);
    if (!response.ok) {
      throw new Error("Failed to fetch shifts for date");
    }
    return response.json();
  },

  assign: async (
    data: {
      date: string;
      shiftType: string;
      doctorIds: number[];
    },
    accessToken?: string | null,
  ): Promise<Shift> => {
    const response = await fetch("/api/shifts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to assign shift");
    }
    return response.json();
  },

  assignBatch: async (
    shifts: { date: string; shiftType: string; doctorIds: number[] }[],
    accessToken?: string | null,
  ): Promise<Shift[]> => {
    const response = await fetch("/api/shifts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ shifts }),
    });
    if (!response.ok) {
      throw new Error("Failed to batch assign shifts");
    }
    return response.json();
  },
};

// Unavailable Dates API
export const unavailableDatesApi = {
  getByDoctor: async (doctorId: number): Promise<UnavailableDate[]> => {
    const response = await fetch(`/api/doctors/${doctorId}/unavailable-dates`);
    if (!response.ok) {
      throw new Error("Failed to fetch unavailable dates");
    }
    return response.json();
  },

  update: async (
    doctorId: number,
    dates: string[],
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`/api/doctors/${doctorId}/unavailable-dates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dates }),
    });
    if (!response.ok) {
      throw new Error("Failed to update unavailable dates");
    }
    return response.json();
  },
};

export const vacationsApi = {
  getByYear: async (
    year: number,
    accessToken?: string | null,
  ): Promise<VacationDay[]> => {
    const response = await fetch(`/api/vacations?year=${year}`, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch vacation days");
    }
    return response.json();
  },
  updateYear: async (
    year: number,
    days: VacationDay[],
    accessToken?: string | null,
  ): Promise<{ success: boolean }> => {
    const response = await fetch("/api/vacations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ year, days }),
    });
    if (!response.ok) {
      throw new Error("Failed to update vacation days");
    }
    return response.json();
  },
  updateApproval: async (
    id: number,
    approved: boolean,
    accessToken?: string | null,
  ): Promise<{ success: boolean }> => {
    const response = await fetch("/api/vacations", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ id, approved }),
    });
    if (!response.ok) {
      throw new Error("Failed to update vacation approval");
    }
    return response.json();
  },
  deny: async (
    id: number,
    accessToken?: string | null,
  ): Promise<{ success: boolean }> => {
    const response = await fetch("/api/vacations", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      throw new Error("Failed to deny vacation");
    }
    return response.json();
  },
};

export const notificationsApi = {
  getUnread: async (accessToken?: string | null): Promise<Notification[]> => {
    const response = await fetch("/api/notifications", {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch notifications");
    }
    return response.json();
  },
  markAllRead: async (
    accessToken?: string | null,
  ): Promise<{ success: boolean }> => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to update notifications");
    }
    return response.json();
  },
};
