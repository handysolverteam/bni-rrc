export function normalizeRoleName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sanitizeRoleName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function buildRoleOrderUpdates(assignmentIds: string[]) {
  return assignmentIds.map((id, index) => ({
    id,
    display_order: index,
  }));
}
