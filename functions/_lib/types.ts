export type Env = {
  DO: Fetcher & {
    setAlarm(className: string, id: string, scheduledTime: number | Date): Promise<void>;
    getAlarm(className: string, id: string): Promise<number | null>;
    deleteAlarm(className: string, id: string): Promise<void>;
  };
  EXPO_PUBLIC_TOOLKIT_URL?: string;
  EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY?: string;
  EXPO_PUBLIC_RORK_FUNCTIONS_URL?: string;
  /** Server-side aliases: the EXPO_PUBLIC_* names are not always bound in the Worker. */
  TOOLKIT_URL?: string;
  RORK_TOOLKIT_SECRET_KEY?: string;
  WISPR_MCP_URL?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  /** Optional extra owner emails (comma separated) beyond the built-in owner. */
  ALLOWED_EMAILS?: string;
};

export type SourceType = "wispr_mcp" | "wispr_markdown" | "demo";

export type ObligationType =
  | "homework"
  | "assignment"
  | "reading"
  | "quiz"
  | "test"
  | "exam"
  | "project_milestone"
  | "presentation"
  | "form"
  | "material"
  | "appointment";

export const OBLIGATION_TYPES: ObligationType[] = [
  "homework",
  "assignment",
  "reading",
  "quiz",
  "test",
  "exam",
  "project_milestone",
  "presentation",
  "form",
  "material",
  "appointment",
];

export type ObligationStatus =
  | "needs_review"
  | "accepted"
  | "rejected"
  | "calendar_created"
  | "calendar_updated"
  | "needs_clarification";

export interface Course {
  id: string;
  user_id: string;
  name: string;
  short_name: string;
  teacher: string;
  color: string;
  meeting_keywords: string;
  typical_schedule: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  external_wispr_id: string | null;
  course_id: string | null;
  source_type: SourceType;
  title: string;
  started_at: string;
  ended_at: string | null;
  attendees_json: string;
  summary: string;
  notes: string;
  transcript: string;
  transcript_hash: string;
  processing_status: "pending" | "processing" | "done" | "error";
  processing_error: string | null;
  imported_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  user_id: string;
  speaker: string;
  started_at_offset: number | null;
  ended_at_offset: number | null;
  text: string;
  segment_index: number;
}

export interface Obligation {
  id: string;
  user_id: string;
  meeting_id: string;
  course_id: string | null;
  type: ObligationType;
  title: string;
  description: string;
  due_at: string | null;
  all_day: number;
  timezone: string;
  confidence: number;
  status: ObligationStatus;
  evidence_excerpt: string;
  evidence_segment_ids: string;
  raw_date_phrase: string;
  date_reasoning: string;
  provider_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedSegment {
  speaker: string;
  text: string;
  offset: number | null;
}

export interface ParsedMeeting {
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  attendees: string[];
  summary: string;
  notes: string;
  transcript: string;
  segments: ParsedSegment[];
  externalId: string | null;
}
