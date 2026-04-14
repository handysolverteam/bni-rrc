import type { RenewalTaskType } from "./types";

export async function sendNotification(
  renewalCycle: { id: string; member_id: string },
  type: RenewalTaskType,
) {
  console.log("[notification:stub]", {
    renewalCycleId: renewalCycle.id,
    memberId: renewalCycle.member_id,
    type,
  });
}
