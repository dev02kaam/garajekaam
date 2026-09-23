-- Authoritative DECA library contract, shared with flujoficharia.
-- No Ficharia business tables, triggers or campaign rules are copied.
BEGIN;
CREATE SCHEMA IF NOT EXISTS garaje_deca;
CREATE TABLE IF NOT EXISTS garaje_deca.campaign_email_assets (
  asset_key text PRIMARY KEY CHECK (asset_key ~ '^deca-campana-[0-9]{2}$'),
  file_name text NOT NULL CHECK (octet_length(file_name) BETWEEN 5 AND 180
    AND position('/' IN file_name) = 0 AND position(chr(92) IN file_name) = 0 AND file_name !~ E'[\r\n]'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 100 AND 10485760),
  sha256 char(64) NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  sort_order smallint NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT false,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_deca_campaign_email_assets_active_order
  ON garaje_deca.campaign_email_assets (sort_order, asset_key) WHERE active;
CREATE OR REPLACE FUNCTION garaje_deca.touch_campaign_image()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS campaign_image_touch ON garaje_deca.campaign_email_assets;
CREATE TRIGGER campaign_image_touch BEFORE UPDATE ON garaje_deca.campaign_email_assets
  FOR EACH ROW EXECUTE FUNCTION garaje_deca.touch_campaign_image();
COMMIT;
