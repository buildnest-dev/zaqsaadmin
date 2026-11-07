export type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  SSO_SHARED_SECRET?: string;
  TEAM_CALLBACK_URL?: string;
  ADMIN_DATA_KEY?: string;
};

export const TEAM_AUDIENCE = "https://team.schools.zaqsa.com";
export const DEFAULT_TEAM_CALLBACK = "https://team.schools.zaqsa.com/api/platform/sso/callback";

export function allowedEmails(env: Env): string[] {
  return (env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const isAllowed = (env: Env, email: string) => allowedEmails(env).includes(email.toLowerCase());
export const teamCallback = (env: Env) => env.TEAM_CALLBACK_URL || DEFAULT_TEAM_CALLBACK;
