"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-client";
import { useAuthorizedFetch } from "@/lib/use-authorized-fetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLES, type UserRole } from "@/lib/roles";

const ROLE_LABELS: Record<UserRole, string> = {
  doctor: "Arzt",
  shift_assigner: "Dienstplaner",
  secretary: "Sekretariat",
};

type AdminUser = {
  id: number;
  email: string;
  role: UserRole;
  doctorId?: number | null;
  doctorName?: string | null;
  lastOnlineAt?: number | string | null;
  isOnline?: boolean;
  createdAt?: number | string | null;
};

type DoctorOption = {
  id: number;
  name: string;
};

const formatDate = (value?: number | string | null) => {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

export default function AdminUsersPage() {
  const { user, accessToken, isLoading } = useAuth();
  const authorizedFetch = useAuthorizedFetch();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isDoctorsFetching, setIsDoctorsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [isDoctorDialogOpen, setIsDoctorDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const canManage = user?.role === "shift_assigner";

  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    setError(null);
    try {
      const res = await authorizedFetch("/api/admin/users", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as AdminUser[];
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError("Benutzer konnten nicht geladen werden");
    } finally {
      setIsFetching(false);
    }
  }, [accessToken, authorizedFetch]);

  const loadDoctors = useCallback(async () => {
    setIsDoctorsFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/doctors");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as DoctorOption[];
      setDoctors(data.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error(err);
      setError("Ärzte konnten nicht geladen werden");
    } finally {
      setIsDoctorsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (canManage && accessToken) {
      loadUsers();
      loadDoctors();
    }
  }, [canManage, accessToken, loadUsers, loadDoctors]);

  useEffect(() => {
    if (!canManage || !accessToken) return;

    const interval = window.setInterval(() => {
      void loadUsers();
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [canManage, accessToken, loadUsers]);

  const formatLastOnline = useCallback((value?: number | string | null) => {
    if (!value) return "Nie aktiv";
    const date = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, []);

  const handleRoleChange = async (userId: number, role: UserRole) => {
    if (!accessToken) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const updated = (await res.json()) as Pick<AdminUser, "id" | "role">;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, role: updated.role } : item,
        ),
      );
    } catch (err) {
      console.error(err);
      setError("Rolle konnte nicht aktualisiert werden");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!accessToken) return;
    const confirmed = window.confirm("Diesen Benutzer löschen?");
    if (!confirmed) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setUsers((prev) => prev.filter((item) => item.id !== userId));
    } catch (err) {
      console.error(err);
      setError("Benutzer konnte nicht gelöscht werden");
    } finally {
      setBusyUserId(null);
    }
  };

  const openDoctorDialog = (row: AdminUser) => {
    setSelectedUser(row);
    setSelectedDoctorId(row.doctorId ? String(row.doctorId) : "");
    setIsDoctorDialogOpen(true);
  };

  const handleDoctorSave = async () => {
    if (!accessToken || !selectedUser) return;
    if (!selectedDoctorId) return;
    setBusyUserId(selectedUser.id);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId: Number(selectedDoctorId) }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const updated = (await res.json()) as Pick<
        AdminUser,
        "id" | "doctorId" | "doctorName"
      >;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                doctorId: updated.doctorId ?? null,
                doctorName: updated.doctorName ?? null,
              }
            : item,
        ),
      );
      setIsDoctorDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError("Arztzuordnung konnte nicht aktualisiert werden");
    } finally {
      setBusyUserId(null);
    }
  };

  if (!isLoading && !canManage) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Benutzer</h2>
        <p className="text-sm text-muted-foreground">
          Sie haben keine Berechtigung, diese Seite zu sehen.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center">Lädt...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Benutzer</h2>
          <p className="text-sm text-muted-foreground">
            Benutzerrollen und Zugriffe verwalten.
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Rolle</th>
              <th className="px-4 py-3 text-left font-medium">Arzt</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Erstellt</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const isBusy = busyUserId === row.id;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={row.role}
                      onValueChange={(value) =>
                        handleRoleChange(row.id, value as UserRole)
                      }
                      disabled={isBusy}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="Rolle auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {row.doctorName ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => openDoctorDialog(row)}
                        disabled={isBusy}
                      >
                        {row.doctorName}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDoctorDialog(row)}
                        disabled={isBusy}
                      >
                        Arzt zuordnen
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${
                          row.isOnline
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            row.isOnline ? "bg-emerald-500" : "bg-muted-foreground/50"
                          }`}
                        />
                        {row.isOnline ? "Online" : "Offline"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.isOnline
                          ? "In den letzten 30 Sek. aktiv"
                          : formatLastOnline(row.lastOnlineAt)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      disabled={isBusy}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !isFetching && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={6}
                >
                  Keine Benutzer gefunden.
                </td>
              </tr>
            )}
            {isFetching && users.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={6}
                >
                  Benutzer werden geladen...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDoctorDialogOpen} onOpenChange={setIsDoctorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Arzt zuordnen</DialogTitle>
            <DialogDescription>
              Wählen Sie den Arzt aus, der diesem Benutzer zugeordnet ist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select
              value={selectedDoctorId}
              onValueChange={setSelectedDoctorId}
              disabled={isDoctorsFetching || doctors.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isDoctorsFetching
                      ? "Ärzte werden geladen..."
                      : "Arzt auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={String(doctor.id)}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {doctors.length === 0 && !isDoctorsFetching && (
              <p className="text-sm text-muted-foreground">
                Keine Ärzte verfügbar.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDoctorDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleDoctorSave}
              disabled={
                !selectedDoctorId ||
                busyUserId === selectedUser?.id ||
                isDoctorsFetching ||
                doctors.length === 0
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
