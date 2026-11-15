// Keep in sync with the check on `app_feedback.kind` and `submit_feedback` in supabase/migrations
export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const MAX_FEEDBACK_MESSAGE = 500;
