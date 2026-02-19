-- Data retention function — called daily from monitor cron
-- Keeps telemetry/cost tables trimmed to prevent unbounded growth

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(table_name TEXT, rows_deleted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  -- search_telemetry: keep 30 days
  DELETE FROM search_telemetry WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'search_telemetry'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- api_costs: keep 30 days
  DELETE FROM api_costs WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'api_costs'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- cached_answers: delete expired
  DELETE FROM cached_answers WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'cached_answers'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- ingestion_log: keep 90 days
  DELETE FROM ingestion_log WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'ingestion_log'; rows_deleted := deleted_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_old_data IS 'Daily retention cleanup — called from monitor cron. Keeps telemetry 30d, costs 30d, cache expired, ingestion logs 90d.';
