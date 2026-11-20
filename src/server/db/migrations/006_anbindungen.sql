-- Version 0.5: Fotos bei Annahme/Auftrag, Zwei-Faktor-Anmeldung, Discord-Verknüpfung, Spielserver-Anbindung (FiveM).

-- Zwei-Faktor (TOTP) und Discord-Konto
ALTER TABLE users ADD COLUMN totp_secret text;
ALTER TABLE users ADD COLUMN totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN totp_last_step bigint NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN discord_id text;
CREATE UNIQUE INDEX users_discord_id_idx ON users(discord_id) WHERE discord_id IS NOT NULL;

-- Einmalige Zustände für die Discord-Anmeldung (gegen CSRF, 10 Minuten gültig)
CREATE TABLE oauth_states (
  state text PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('login', 'link')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  remember boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Spiel-ID je Mitglied (z. B. FiveM-Lizenz oder Discord-ID im Spiel), eindeutig je Firma
ALTER TABLE memberships ADD COLUMN game_id text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX memberships_game_id_idx ON memberships(company_id, game_id) WHERE game_id <> '';

-- Fotos zu Aufträgen (Dateien in data/photos/<firma>/<id>.<endung>)
CREATE TABLE order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ext text NOT NULL CHECK (ext IN ('jpg', 'png', 'webp')),
  size integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_photos_order_idx ON order_photos(order_id);

-- Schlüssel für den Spielserver je Firma
CREATE TABLE game_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
