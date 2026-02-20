-- Tighten data retention to prevent storage bloat recurrence
-- Reduces retention periods for low-value telemetry data
-- Adds retention for conversations and feedback (previously unbounded)

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(table_name TEXT, rows_deleted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  -- search_telemetry: 30d -> 7d
  DELETE FROM search_telemetry WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'search_telemetry'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- api_costs: 30d -> 7d
  DELETE FROM api_costs WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'api_costs'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- cached_answers: delete expired
  DELETE FROM cached_answers WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'cached_answers'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- ingestion_log: 90d -> 14d
  DELETE FROM ingestion_log WHERE created_at < NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'ingestion_log'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- conversations: new 30d retention
  DELETE FROM conversations WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'conversations'; rows_deleted := deleted_count;
  RETURN NEXT;

  -- feedback: new 30d retention
  DELETE FROM feedback WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'feedback'; rows_deleted := deleted_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_old_data IS 'Daily retention cleanup — telemetry 7d, costs 7d, cache expired, ingestion 14d, conversations 30d, feedback 30d.';
