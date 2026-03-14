"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-client";
import type { AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { useAdminUsersQueries } from "@/components/admin/useAdminUsersQueries";
import { USER_ROLES, ROLE_LABELS, type UserRole } from "@/lib/roles";

const UNASSIGNED_DOCTOR_VALUE = "none";

const formatDate = (value?: number | string | null) => {
  if (!value) return "-";

  const date = typeof value === "number" ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString();
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canManage = user?.admin === true;
  const { usersQuery, doctorsQuery, updateUserMutation, deleteUserMutation } =
    useAdminUsersQueries(canManage);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [isDoctorDialogOpen, setIsDoctorDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    UNASSIGNED_DOCTOR_VALUE,
  );

  useEffect(() => {
    if (!isLoading && !canManage) {
      router.replace("/");
    }
  }, [canManage, isLoading, router]);

  const users = usersQuery.data ?? [];
  const doctors = doctorsQuery.data ?? [];
  const queryError = useMemo(() => {
    if (error) {
      return error;
    }

    if (usersQuery.isError) {
      return "Benutzer konnten nicht geladen werden";
    }

    if (doctorsQuery.isError) {
      return "Ärzte konnten nicht geladen werden";
    }

    return null;
  }, [doctorsQuery.isError, error, usersQuery.isError]);

  const formatLastOnline = useCallback((value?: number | string | null) => {
    if (!value) return "Nie aktiv";

    const date = typeof value === "number" ? new Date(value) : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }, []);

  const openDoctorDialog = (row: AdminUser) => {
    setSelectedUser(row);
    setSelectedDoctorId(
      row.doctorId ? String(row.doctorId) : UNASSIGNED_DOCTOR_VALUE,
    );
    setIsDoctorDialogOpen(true);
  };

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setBusyUserId(userId);
    setError(null);

    try {
      await updateUserMutation.mutateAsync({
        userId,
        payload: { role },
      });
    } catch (updateError) {
      console.error(updateError);
      setError("Rolle konnte nicht aktualisiert werden");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleAdminChange = async (userId: number, admin: boolean) => {
    setBusyUserId(userId);
    setError(null);

    try {
      await updateUserMutation.mutateAsync({
        userId,
        payload: { admin },
      });
    } catch (updateError) {
      console.error(updateError);
      setError("Admin-Status konnte nicht aktualisiert werden");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: number) => {
    const confirmed = window.confirm("Diesen Benutzer löschen?");

    if (!confirmed) {
      return;
    }

    setBusyUserId(userId);
    setError(null);

    try {
      await deleteUserMutation.mutateAsync(userId);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Benutzer konnte nicht gelöscht werden");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDoctorSave = async () => {
    if (!selectedUser) return;

    const doctorId =
      selectedDoctorId === UNASSIGNED_DOCTOR_VALUE
        ? null
        : Number(selectedDoctorId);

    if (doctorId !== null && !Number.isInteger(doctorId)) {
      return;
    }

    setBusyUserId(selectedUser.id);
    setError(null);

    try {
      await updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        payload: { doctorId },
      });
      setIsDoctorDialogOpen(false);
    } catch (updateError) {
      console.error(updateError);
      setError("Arztzuordnung konnte nicht aktualisiert werden");
    } finally {
      setBusyUserId(null);
    }
  };

  if (!isLoading && !canManage) {
    return null;
  }

  if (isLoading || usersQuery.isLoading) {
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

      {queryError && <div className="text-sm text-destructive">{queryError}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Rolle</th>
              <th className="px-4 py-3 text-left font-medium">Admin</th>
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
                        void handleRoleChange(row.id, value as UserRole)
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
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={row.admin}
                        onCheckedChange={(checked) =>
                          void handleAdminChange(row.id, checked)
                        }
                        disabled={isBusy}
                        aria-label={`Admin-Zugriff fuer ${row.email}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {row.admin ? "Ja" : "Nein"}
                      </span>
                    </div>
                  </td>
                  <td className="px-0 py-3">
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
                            row.isOnline
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/50"
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
                      onClick={() => void handleDelete(row.id)}
                      disabled={isBusy}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !usersQuery.isFetching && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={7}
                >
                  Keine Benutzer gefunden.
                </td>
              </tr>
            )}
            {usersQuery.isFetching && users.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={7}
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
              disabled={doctorsQuery.isFetching}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    doctorsQuery.isFetching
                      ? "Ärzte werden geladen..."
                      : "Arzt auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_DOCTOR_VALUE}>
                  Keine Zuordnung
                </SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={String(doctor.id)}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {doctors.length === 0 && !doctorsQuery.isFetching && (
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
              onClick={() => void handleDoctorSave()}
              disabled={busyUserId === selectedUser?.id || doctorsQuery.isFetching}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
