// API service functions for data operations

export interface Doctor {
  id: number;
  name: string;
  createdAt: string;
}

export interface Shift {
  id: number;
  date: string;
  shiftType: string;
  doctorId: number | null;
  doctorName: string | null;
}

export interface UnavailableDate {
  id: number;
  doctorId: number;
  date: string;
}

// Doctors API
export const doctorsApi = {
  getAll: async (): Promise<Doctor[]> => {
    const response = await fetch('/api/doctors');
    if (!response.ok) {
      throw new Error('Failed to fetch doctors');
    }
    return response.json();
  },

  create: async (data: { name: string; unavailableDates?: string[] }): Promise<Doctor> => {
    const response = await fetch('/api/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to create doctor');
    }
    return response.json();
  },
};

// Shifts API
export const shiftsApi = {
  getAll: async (): Promise<Shift[]> => {
    const response = await fetch('/api/shifts');
    if (!response.ok) {
      throw new Error('Failed to fetch shifts');
    }
    return response.json();
  },

  getByDate: async (date: string): Promise<Shift[]> => {
    const response = await fetch(`/api/shifts?date=${date}`);
    if (!response.ok) {
      throw new Error('Failed to fetch shifts for date');
    }
    return response.json();
  },

  assign: async (data: { date: string; shiftType: string; doctorId: number | null }): Promise<Shift> => {
    const response = await fetch('/api/shifts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to assign shift');
    }
    return response.json();
  },
};

// Unavailable Dates API
export const unavailableDatesApi = {
  getByDoctor: async (doctorId: number): Promise<UnavailableDate[]> => {
    const response = await fetch(`/api/doctors/${doctorId}/unavailable-dates`);
    if (!response.ok) {
      throw new Error('Failed to fetch unavailable dates');
    }
    return response.json();
  },

  update: async (doctorId: number, dates: string[]): Promise<{ success: boolean }> => {
    const response = await fetch(`/api/doctors/${doctorId}/unavailable-dates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dates }),
    });
    if (!response.ok) {
      throw new Error('Failed to update unavailable dates');
    }
    return response.json();
  },
}; 