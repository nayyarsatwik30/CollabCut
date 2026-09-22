
CREATE TABLE plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  storage_gb integer NOT NULL,
  recycle_bin_gb integer DEFAULT 0,
  price_monthly integer NOT NULL,
  price_yearly integer NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  link_expiration boolean DEFAULT false,
  priority_support boolean DEFAULT false,
  collaborative_storage boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

CREATE TABLE workspace_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  storage_gb integer NOT NULL,
  max_admins integer NOT NULL,
  max_editors integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO workspace_plans (id, name, storage_gb, max_admins, max_editors, sort_order) VALUES
  ('tier_1', 'Agency Tier 1', 1024, 2, 3, 1),
  ('tier_2', 'Agency Tier 2', 2048, 3, 4, 2);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  avatar_color text DEFAULT '#4CAF7D',
  plan text DEFAULT 'trial' CHECK (plan = ANY (ARRAY['trial','pro','cancelled'])),
  trial_ends_at timestamptz DEFAULT (now() + '14 days'::interval),
  created_at timestamptz DEFAULT now(),
  plan_id text DEFAULT 'basic' REFERENCES plans(id),
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle = ANY (ARRAY['monthly','yearly']))
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  invite_code text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text,'-',''), 1, 12),
  workspace_plan_id text REFERENCES workspace_plans(id)
);

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL CHECK (role = ANY (ARRAY['admin','editor'])),
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL,
  client text,
  emoji text DEFAULT '🎬',
  status text DEFAULT 'in_review' CHECK (status = ANY (ARRAY['draft','in_review','approved','changes'])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  workspace_id uuid REFERENCES workspaces(id),
  cover_asset_id uuid,
  cover_playback_id text
);

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  uploaded_by uuid REFERENCES profiles(id),
  name text NOT NULL,
  version integer DEFAULT 1,
  duration_sec numeric DEFAULT 0,
  size_bytes bigint DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status = ANY (ARRAY['processing','in_review','approved','changes'])),
  mux_asset_id text,
  mux_playback_id text,
  mux_upload_id text,
  mux_ready_at timestamptz,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  is_complete boolean NOT NULL DEFAULT false,
  marked_complete_by uuid REFERENCES profiles(id),
  marked_complete_at timestamptz,
  pipeline_status text NOT NULL DEFAULT 'idea' CHECK (pipeline_status = ANY (ARRAY['idea','editing','review','revision','approved'])),
  asset_group_id uuid,
  cut_type text NOT NULL DEFAULT 'board' CHECK (cut_type = ANY (ARRAY['custom','board'])),
  raw_file_url text,
  notes text,
  reference text,
  deadline date
);

ALTER TABLE projects ADD CONSTRAINT projects_cover_asset_id_fkey
  FOREIGN KEY (cover_asset_id) REFERENCES assets(id);

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  user_id uuid REFERENCES profiles(id),
  email text,
  role text DEFAULT 'viewer' CHECK (role = ANY (ARRAY['owner','editor','client','viewer'])),
  invited_at timestamptz DEFAULT now()
);

CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  asset_group_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  token text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text,'-',''), 1, 24),
  password_hash text,
  expires_at timestamptz,
  downloads_disabled boolean DEFAULT false,
  comments_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  author_id uuid REFERENCES profiles(id),
  author_name text,
  time_sec numeric NOT NULL,
  status text DEFAULT 'open' CHECK (status = ANY (ARRAY['open','resolved','changes'])),
  text text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id),
  author_id uuid REFERENCES profiles(id),
  author_name text,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  asset_id uuid REFERENCES assets(id)
);

CREATE TABLE asset_editors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  editor_id uuid NOT NULL REFERENCES profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE raw_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  file_name text NOT NULL,
  b2_key text NOT NULL,
  file_size_bytes bigint,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_asset_id ON comments (asset_id);
CREATE INDEX idx_replies_comment_id ON replies (comment_id);
CREATE INDEX idx_assets_project_id ON assets (project_id);
CREATE INDEX idx_projects_owner_id ON projects (owner_id);
CREATE INDEX idx_projects_cover_asset_id ON projects (cover_asset_id);
CREATE INDEX idx_share_links_asset_group_id ON share_links (asset_group_id);
CREATE INDEX idx_workspaces_workspace_plan_id ON workspaces (workspace_plan_id);
