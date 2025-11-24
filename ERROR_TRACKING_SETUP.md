# Error Tracking Setup - Journal Club Standalone

See `dnb-portal/ERROR_TRACKING_SETUP.md` for complete details.

## Quick Start

1. **Create Supabase Table**
   - Copy SQL from `dnb-portal/SUPABASE_SCHEMA.sql`
   - Paste in Supabase SQL Editor for floycbvzvlmivgilcrad project
   - Run query

2. **Use Logging in API Routes**
   - Import: `import { generateRequestId, logGeneration, logStep, categorizeError } from '@/lib/generation-logger';`
   - Generate request ID at start of POST handler
   - Log each step (groq, gamma, supabase, resend)
   - Log final status (success/failed)

3. **Return Request ID to User**
   - In error response: `{ success: false, error: message, requestId }`
   - Show in UI so user can share for support

4. **Query Errors Quickly**
   ```sql
   SELECT * FROM generation_logs WHERE request_id = 'req_...';
   ```

Both projects share same Supabase `generation_logs` table, so all logs are in one place for central monitoring.
