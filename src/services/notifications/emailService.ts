import { supabase } from '../../lib/supabase';
import { EmailLog } from '../../types/database';

export interface EmailDispatchPayload {
  recipient_email: string;
  recipient_role?: string;
  subject: string;
  template_name: string;
  severity?: 'INFO' | 'HIGH' | 'CRITICAL' | 'SUCCESS';
  html_content?: string;
  metadata?: Record<string, any>;
}

export async function sendEmailWithLog(payload: EmailDispatchPayload): Promise<{ success: boolean; log_id?: string; error?: string }> {
  try {
    // 1. Log to PostgreSQL `email_logs` table
    const { data: log, error } = await supabase
      .from('email_logs')
      .insert([
        {
          recipient_email: payload.recipient_email,
          recipient_role: payload.recipient_role || 'ALL',
          subject: payload.subject,
          template_name: payload.template_name,
          severity: payload.severity || 'INFO',
          status: 'SENT',
          error_message: null,
          sent_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.warn('Could not write email_log to database:', error);
    }

    // In a production backend, this invokes the SMTP / Gmail API / Resend / AWS SES integration.
    // In our browser environment, we simulate successful delivery and record the audit log.
    console.info(`[Supply Sync Email Engine] Sent email to ${payload.recipient_email}: "${payload.subject}" [Template: ${payload.template_name}]`);

    return {
      success: true,
      log_id: log?.log_id,
    };
  } catch (err: any) {
    console.error('Email dispatch error:', err);
    try {
      await supabase.from('email_logs').insert([
        {
          recipient_email: payload.recipient_email,
          recipient_role: payload.recipient_role || 'ALL',
          subject: payload.subject,
          template_name: payload.template_name,
          severity: payload.severity || 'INFO',
          status: 'FAILED',
          error_message: err.message,
          sent_at: new Date().toISOString(),
        },
      ]);
    } catch {
      // Ignore fallback log error
    }

    return {
      success: false,
      error: err.message,
    };
  }
}
