-- Strengthen tenant isolation by binding public access to request x-town-id.
-- The app sets this header through getSupabaseClient({ townId }).

CREATE OR REPLACE FUNCTION request_town_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    (COALESCE(current_setting('request.headers', true), '{}')::jsonb ->> 'x-town-id'),
    ''
  );
$$;

-- Remove permissive policies from initial schema.
DROP POLICY IF EXISTS "Public can read towns" ON towns;
DROP POLICY IF EXISTS "Public can read documents" ON documents;
DROP POLICY IF EXISTS "Public can read chunks" ON document_chunks;
DROP POLICY IF EXISTS "Public can read departments" ON departments;
DROP POLICY IF EXISTS "Public can create conversations" ON conversations;
DROP POLICY IF EXISTS "Public can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Public can create feedback" ON feedback;
DROP POLICY IF EXISTS "Service can manage documents" ON documents;
DROP POLICY IF EXISTS "Service can manage chunks" ON document_chunks;
DROP POLICY IF EXISTS "Service can manage departments" ON departments;
DROP POLICY IF EXISTS "Service can manage ingestion_log" ON ingestion_log;

-- Public read access is now tenant-scoped.
CREATE POLICY "Public can read scoped towns"
  ON towns
  FOR SELECT
  USING (id = request_town_id());

CREATE POLICY "Public can read scoped documents"
  ON documents
  FOR SELECT
  USING (town_id = request_town_id());

CREATE POLICY "Public can read scoped chunks"
  ON document_chunks
  FOR SELECT
  USING (town_id = request_town_id());

CREATE POLICY "Public can read scoped departments"
  ON departments
  FOR SELECT
  USING (town_id = request_town_id());

CREATE POLICY "Public can read scoped conversations"
  ON conversations
  FOR SELECT
  USING (town_id = request_town_id());

CREATE POLICY "Public can create scoped conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (town_id = request_town_id());

CREATE POLICY "Public can create scoped feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (
    conversation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = feedback.conversation_id
        AND c.town_id = request_town_id()
    )
  );

CREATE POLICY "Public can read scoped feedback"
  ON feedback
  FOR SELECT
  USING (
    conversation_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = feedback.conversation_id
        AND c.town_id = request_town_id()
    )
  );

-- Service role retains full access for ingestion/admin operations.
CREATE POLICY "Service can manage documents"
  ON documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage chunks"
  ON document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage departments"
  ON departments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage conversations"
  ON conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage feedback"
  ON feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage ingestion_log"
  ON ingestion_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage towns"
  ON towns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
