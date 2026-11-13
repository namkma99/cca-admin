import { z } from 'zod';

export const auditActions = {
  create_user: 'User created',
  disable_user: 'Account disabled',
  enable_user: 'Account enabled',
  reset_password: 'Password reset',
  reset_exam_cycle: 'Exam cycle reset',
} as const;

export const auditFiltersSchema = z.object({
  query: z.string().trim().max(64).default(''),
  action: z
    .enum(
      Object.keys(auditActions) as [
        keyof typeof auditActions,
        ...Array<keyof typeof auditActions>,
      ],
    )
    .optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditEntry = {
  id: string;
  action: keyof typeof auditActions;
  createdAt: string;
  actorUserId: string;
  targetUserId: string;
  metadata: Record<string, unknown>;
  actorUsername?: string;
  targetUsername?: string;
};
export type AuditPage = {
  logs: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};
