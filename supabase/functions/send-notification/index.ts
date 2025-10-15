import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationRequest {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  channels?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const notification: NotificationRequest = await req.json();

    if (!notification.type || !notification.title || !notification.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, title, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channels = notification.channels || ['dashboard'];
    const priority = notification.priority || 'medium';
    const data = notification.data || {};

    const { data: notificationRecord, error: insertError } = await supabase
      .from('notifications')
      .insert({
        notification_type: notification.type,
        title: notification.title,
        message: notification.message,
        data: data,
        priority: priority,
        channels: channels,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create notification: ${insertError.message}`);
    }

    const results: Record<string, any> = {
      dashboard: { success: true },
    };

    if (channels.includes('email')) {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('alert_email, notification_enabled')
        .maybeSingle();

      if (settings?.notification_enabled && settings?.alert_email) {
        try {
          results.email = await sendEmail(
            settings.alert_email,
            notification.title,
            notification.message,
            data
          );
        } catch (error) {
          console.error('Email sending failed:', error);
          results.email = { success: false, error: error.message };
        }
      } else {
        results.email = { success: false, reason: 'Email not configured or disabled' };
      }
    }

    if (channels.includes('slack')) {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('slack_webhook, notification_enabled')
        .maybeSingle();

      if (settings?.notification_enabled && settings?.slack_webhook) {
        try {
          results.slack = await sendSlackMessage(
            settings.slack_webhook,
            notification.title,
            notification.message,
            data
          );
        } catch (error) {
          console.error('Slack sending failed:', error);
          results.slack = { success: false, error: error.message };
        }
      } else {
        results.slack = { success: false, reason: 'Slack not configured or disabled' };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notificationRecord.id,
        channels_sent: results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Notification error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function sendEmail(
  to: string,
  subject: string,
  message: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  console.log(`Would send email to ${to}: ${subject}`);
  return { success: true };
}

async function sendSlackMessage(
  webhookUrl: string,
  title: string,
  message: string,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `*${title}*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Data: \`${JSON.stringify(data)}\``,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
