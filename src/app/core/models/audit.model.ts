/** Entrada del registro de auditoría (HU0014). */
export interface AuditEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resource: string | null;
  statusCode: number;
  ipAddress: string | null;
  occurredAt: string;
}
