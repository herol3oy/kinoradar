export const TODAY_SCHEDULE_CRON = "0 */4 * * *";
export const TOMORROW_SCHEDULE_CRON = "10 */4 * * *";
export const RELEASES_CRON = "20 */4 * * *";

export type ScheduledJob =
  | { kind: "schedule"; dayOffset: 0 | 1 }
  | { kind: "releases" };

export function scheduledJobFor(cron: string): ScheduledJob | null {
  switch (cron) {
    case TODAY_SCHEDULE_CRON:
      return { kind: "schedule", dayOffset: 0 };
    case TOMORROW_SCHEDULE_CRON:
      return { kind: "schedule", dayOffset: 1 };
    case RELEASES_CRON:
      return { kind: "releases" };
    default:
      return null;
  }
}
