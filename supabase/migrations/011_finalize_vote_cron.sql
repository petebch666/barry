-- Sweep pings whose vote timer has expired and finalize them.
--
-- This is the first cron-triggered Edge Function in the repo — earlier
-- pg_cron jobs (003_triggers.sql) only call plain SQL functions. Reaching
-- an Edge Function from pg_cron requires pg_net, plus the project URL and
-- service-role key stored in Supabase Vault. Manual dashboard/SQL-editor
-- steps required before this job can run (cannot be done from a migration):
--
--   1. Enable the pg_net extension: Dashboard → Database → Extensions.
--   2. Store secrets once via the SQL editor (never commit real values to
--      a migration file):
--        SELECT vault.create_secret('https://<project>.supabase.co', 'project_url');
--        SELECT vault.create_secret('<service-role-key>', 'service_role_key');
--   3. Deploy the function: supabase functions deploy finalize-ping-vote
--      (and redeploy check-vote-majority, which now imports the shared
--      vote-decision module).
--   4. Confirm the job is scheduled: SELECT * FROM cron.job WHERE jobname
--      = 'barry-finalize-ping-vote';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    PERFORM cron.schedule(
      'barry-finalize-ping-vote',
      '*/1 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/finalize-ping-vote',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END;
$$;
