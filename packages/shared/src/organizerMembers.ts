import { z } from "zod";

export const organizerMemberRoleSchema = z.enum(["owner", "admin", "staff", "scanner"]);
export type OrganizerMemberRole = z.infer<typeof organizerMemberRoleSchema>;

export const mutableOrganizerMemberRoleSchema = z.enum(["admin", "staff", "scanner"]);
export type MutableOrganizerMemberRole = z.infer<typeof mutableOrganizerMemberRoleSchema>;

export const organizerMemberListItemSchema = z.object({
  membershipId: z.string().uuid(),
  userId: z.string().uuid(),
  organizerId: z.string().uuid(),
  organizerName: z.string(),
  organizerSlug: z.string(),
  email: z.string().email(),
  role: organizerMemberRoleSchema,
  canChangeRole: z.boolean(),
  allowedRoleTargets: z.array(mutableOrganizerMemberRoleSchema),
  capabilities: z.record(z.boolean())
});
export type OrganizerMemberListItem = z.infer<typeof organizerMemberListItemSchema>;

export const organizerMembersListSchema = z.array(organizerMemberListItemSchema);

export const organizerMemberRoleUpdateInputSchema = z.object({
  role: mutableOrganizerMemberRoleSchema
});
export type OrganizerMemberRoleUpdateInput = z.infer<typeof organizerMemberRoleUpdateInputSchema>;

export const organizerMemberRoleUpdateResultSchema = z.object({
  membershipId: z.string().uuid(),
  organizerId: z.string().uuid(),
  userId: z.string().uuid(),
  previousRole: organizerMemberRoleSchema,
  role: organizerMemberRoleSchema,
  auditLogId: z.string().uuid()
});
export type OrganizerMemberRoleUpdateResult = z.infer<typeof organizerMemberRoleUpdateResultSchema>;
