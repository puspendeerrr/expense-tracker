import { Resend } from 'resend';
import { env, isTest } from '../config/env.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { logger, redactEmail } from '../utils/logger.js';

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Transport seam. Controllers depend on this module, never on Resend directly, so the
 * provider can be swapped or stubbed (tests inject a capture transport) without
 * touching a single route.
 */
export interface EmailTransport {
  send(message: OutboundEmail): Promise<void>;
}

class ResendTransport implements EmailTransport {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: OutboundEmail): Promise<void> {
    const result = await this.client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (result.error) {
      // Message only; the payload carries the OTP and is never logged.
      throw new Error(result.error.message ?? 'Resend rejected the message');
    }
  }
}

/** Used when RESEND_API_KEY is absent outside production: fails loudly rather than silently. */
class UnconfiguredTransport implements EmailTransport {
  async send(): Promise<void> {
    throw new Error('RESEND_API_KEY is not configured');
  }
}

let transport: EmailTransport = env.RESEND_API_KEY
  ? new ResendTransport(env.RESEND_API_KEY)
  : new UnconfiguredTransport();

/** Test/QA seam. Not reachable from any route. */
export const setEmailTransport = (next: EmailTransport): void => {
  transport = next;
};

const dispatch = async (message: OutboundEmail, kind: string): Promise<void> => {
  try {
    await transport.send(message);
    logger.info('email.sent', { kind, to: redactEmail(message.to) });
  } catch (error: unknown) {
    logger.error('email.failed', {
      kind,
      to: redactEmail(message.to),
      // Provider message only. Never the OTP, never the API key.
      reason: error instanceof Error ? error.message : 'unknown transport error',
    });
    throw new AppError(
      502,
      ERROR_CODES.EMAIL_DELIVERY_FAILED,
      'We could not send the verification email. Please try again in a moment.',
    );
  }
};

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

const BRAND = 'SplitMoney';

type TemplateInput = {
  heading: string;
  intro: string;
  otp: string;
  expiryMinutes: number;
  footer: string;
};

/**
 * Table-based layout with inline styles: the only thing that renders consistently
 * across Gmail, Outlook and Apple Mail. Dark-mode friendly neutral palette.
 */
const renderHtml = ({ heading, intro, otp, expiryMinutes, footer }: TemplateInput): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e6eb;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <span style="display:inline-block;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <h1 style="margin:12px 0 8px 0;font-size:20px;line-height:28px;font-weight:600;color:#0f172a;">${heading}</h1>
                <p style="margin:0 0 24px 0;font-size:14px;line-height:22px;color:#475569;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                  <tr>
                    <td align="center" style="padding:20px 16px;">
                      <div style="font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${otp}</div>
                      <div style="margin-top:6px;font-size:12px;line-height:18px;color:#64748b;">Expires in ${expiryMinutes} minutes</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">${footer}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #e4e6eb;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">${BRAND} will never ask you for this code by phone, chat or email reply.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;line-height:16px;color:#94a3b8;">Sent by ${BRAND}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const renderText = ({ heading, intro, otp, expiryMinutes, footer }: TemplateInput): string =>
  [
    BRAND,
    '',
    heading,
    '',
    intro,
    '',
    `Your code: ${otp}`,
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    footer,
    '',
    `${BRAND} will never ask you for this code by phone, chat or email reply.`,
  ].join('\n');

const expiryMinutes = (): number => Math.max(1, Math.round(env.OTP_EXPIRES_SECONDS / 60));

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const sendSignupVerificationOtp = async (to: string, otp: string): Promise<void> => {
  const template: TemplateInput = {
    heading: 'Confirm your email address',
    intro: `Enter this code in ${BRAND} to finish creating your account.`,
    otp,
    expiryMinutes: expiryMinutes(),
    footer: 'If you did not try to create an account, you can safely ignore this email.',
  };

  await dispatch(
    {
      to,
      subject: `${otp} is your ${BRAND} verification code`,
      html: renderHtml(template),
      text: renderText(template),
    },
    'signup_verification',
  );
};

export const sendPasswordResetOtp = async (to: string, otp: string): Promise<void> => {
  const template: TemplateInput = {
    heading: 'Reset your password',
    intro: `Enter this code in ${BRAND} to choose a new password.`,
    otp,
    expiryMinutes: expiryMinutes(),
    footer:
      'If you did not request a password reset, ignore this email. Your password stays unchanged.',
  };

  await dispatch(
    {
      to,
      subject: `${otp} is your ${BRAND} password reset code`,
      html: renderHtml(template),
      text: renderText(template),
    },
    'password_reset',
  );
};

if (isTest && !env.RESEND_API_KEY) {
  logger.info('email.transport', { mode: 'unconfigured (tests inject their own)' });
}
