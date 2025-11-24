import { SupabaseClient } from '@supabase/supabase-js';

export interface GenerationLogEntry {
  userId: string;
  requestId: string;
  service: 'dnb-portal' | 'journal-club-standalone';
  mode: 'critical_appraisal' | 'recent_advances';
  inputType: 'doi' | 'pdf' | 'topic';
  paperTitle?: string;
  status: 'success' | 'failed' | 'partial';
  currentStep?: string;
  stepSequence?: number;
  errorMessage?: string;
  errorCode?: string;
  errorStack?: string;
  pptUrl?: string | null;
  wordUrl?: string | null;
  emailSent?: boolean;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Generate unique request ID for tracking
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `req_${timestamp}_${random}`;
}

/**
 * Log generation attempt to Supabase
 */
export async function logGeneration(
  supabase: SupabaseClient,
  entry: GenerationLogEntry
): Promise<void> {
  const completedAt = entry.completedAt || new Date();
  const startedAt = entry.startedAt || completedAt;
  const durationMs = Math.round(completedAt.getTime() - startedAt.getTime());

  try {
    const { error } = await supabase.from('generation_logs').insert({
      user_id: entry.userId,
      request_id: entry.requestId,
      service: entry.service,
      mode: entry.mode,
      input_type: entry.inputType,
      paper_title: entry.paperTitle,
      status: entry.status,
      current_step: entry.currentStep,
      step_sequence: entry.stepSequence,
      error_message: entry.errorMessage,
      error_code: entry.errorCode,
      error_stack: entry.errorStack,
      ppt_url: entry.pptUrl,
      word_url: entry.wordUrl,
      email_sent: entry.emailSent,
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      metadata: entry.metadata || {},
    });

    if (error) {
      console.error('[Log] Failed to log to Supabase:', error);
    } else {
      console.log(`[Log] Logged request ${entry.requestId} - Status: ${entry.status}`);
    }
  } catch (error) {
    console.error('[Log] Unexpected error logging to Supabase:', error);
  }
}

/**
 * Log step progress with console output
 */
export function logStep(
  requestId: string,
  step: string,
  sequence: number,
  details?: Record<string, any>
): void {
  console.log(`[${requestId}] Step ${sequence}: ${step}`, details || '');
}

/**
 * Log error with proper categorization
 */
export function categorizeError(error: unknown): {
  code: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Categorize common errors
    if (message.includes('timeout')) return { code: 'TIMEOUT', message: error.message, stack: error.stack };
    if (message.includes('rate limit')) return { code: 'RATE_LIMIT', message: error.message, stack: error.stack };
    if (message.includes('not found')) return { code: 'NOT_FOUND', message: error.message, stack: error.stack };
    if (message.includes('unauthorized') || message.includes('401')) return { code: 'UNAUTHORIZED', message: error.message, stack: error.stack };
    if (message.includes('forbidden') || message.includes('403')) return { code: 'FORBIDDEN', message: error.message, stack: error.stack };
    if (message.includes('invalid')) return { code: 'INVALID_INPUT', message: error.message, stack: error.stack };

    return { code: 'UNKNOWN_ERROR', message: error.message, stack: error.stack };
  }

  return { code: 'UNKNOWN_ERROR', message: String(error) };
}
