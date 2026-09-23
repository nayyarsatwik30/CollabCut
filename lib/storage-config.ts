// Plan every newly created workspace starts on (workspace_plans.id), so the
// storage bar has a real cap from the first login instead of "No plan
// assigned". tier_1 = 2 TB / 2 admins / 3 editors.
export const DEFAULT_WORKSPACE_PLAN_ID = 'tier_1'
