import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outbound email, sent by us over Gmail SMTP rather than by Supabase.
 *
 * Supabase's built-in sender is rate limited to a handful of messages an hour
 * and is not meant for production. Owning the transport also means the wording
 * of a code email lives in this repository, next to the flow that triggers it.
 *
 * Credentials come from the environment and are never logged. An app password
 * is not a Google account password: it grants SMTP only, and is revocable on
 * its own.
 */

const user = process.env.MAIL_USER ?? process.env.GOOGLE_MAIL_USER;
const pass = process.env.GOOGLE_APP_PASSWORD;
const from = process.env.MAIL_FROM ?? (user ? `Wishit <${user}>` : undefined);

export const isMailConfigured = Boolean(user && pass);

let transporter: Transporter | null = null;

function mailer(): Transporter {
  if (!isMailConfigured) {
    throw new Error(
      'Email is not configured. Set MAIL_USER and GOOGLE_APP_PASSWORD in .env.local.',
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.MAIL_PORT ?? 465),
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: Number(process.env.MAIL_PORT ?? 465) === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

/**
 * The light palette, as hex.
 *
 * `globals.css` is the source of these, but it states them in OKLCH and derives
 * half of them with relative colour syntax — neither of which any mail client
 * understands. So they are converted once, here, and the contrast ratios the
 * stylesheet promises are noted next to them, because nothing in an inbox will
 * ever re-check them.
 */
const C = {
  lime: '#BDE052',
  ground: '#F9FDF5',
  surface: '#F1F7EA',
  surfaceLift: '#E8F0DF',
  accent: '#366A21', // 6.3:1 on ground
  onAccent: '#13280C', // 10.4:1 on lime
  ink: '#1C261A', // 15.2:1 on ground, 13.4:1 on surface-lift
  inkSoft: '#51594F', // 7.1:1 on ground
  inkFaint: '#646C61', // 5.0:1 on surface
  line: '#C3CABB',
} as const;

/*
 * Playfair and Montserrat are webfonts, and a webfont in an email is a webfont
 * that half the clients will not load. Georgia is on effectively every machine
 * and is the closest thing to Playfair's warmth that needs no downloading.
 */
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
const MONO =
  "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

export interface CodeEmail {
  to: string;
  /** Already grouped for reading: `A1B2-C3D4-E5F6`. */
  code: string;
  /** What the code is for, in the subject and the first line. */
  purpose: 'sign-up' | 'password-reset';
  /** How long the code lasts, in minutes. */
  expiresInMinutes?: number;
}

/**
 * The wordmark, drawn rather than linked.
 *
 * Every mail client blocks remote images until asked, so a logo that is an
 * `<img>` is a logo most people meet as a broken box — in the one email where
 * the brand has to look like it belongs to somebody. This is the app header's
 * mark rebuilt out of table cells: the lime block, the `W` on it, and `Wish`
 * with an accented `it` beside it. It cannot fail to load.
 */
const logo = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="44" style="width:44px;height:44px;background-color:${C.lime};border-radius:11px;text-align:center;vertical-align:middle;font-family:${SERIF};font-size:24px;font-weight:bold;line-height:44px;color:${C.onAccent};">W</td>
    <td style="padding-left:12px;font-family:${SERIF};font-size:23px;font-weight:bold;letter-spacing:-0.4px;color:${C.ink};white-space:nowrap;">Wish<span style="color:${C.accent};">it</span></td>
  </tr>
</table>`.trim();

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * The message, built but not sent.
 *
 * Separate from `sendCodeEmail` so the template can be rendered and looked at
 * without a working SMTP account and without mailing anybody — an email is the
 * one surface in this app that cannot be checked by opening it in a browser.
 */
export function renderCodeEmail({
  code,
  purpose,
  expiresInMinutes = 60,
}: Omit<CodeEmail, 'to'>): RenderedEmail {
  const signingUp = purpose === 'sign-up';
  const subject = `${code} is your Wishit ${signingUp ? 'sign-up' : 'password reset'} code`;

  const eyebrow = signingUp ? 'Finish signing up' : 'Reset your password';
  const heading = signingUp ? 'Your code is ready' : 'Set a new password';
  const line = signingUp
    ? 'Enter this code to finish setting up your account.'
    : 'Enter this code to choose a new password.';
  const disclaimer = signingUp
    ? 'If you did not sign up for Wishit, ignore this email — the account is not usable until this code is entered.'
    : 'If you did not ask to reset your password, ignore this email. Nothing has changed.';

  // Plain text as well as HTML: some clients show one, some the other, and a
  // code that only renders in HTML is a code somebody cannot read.
  const text = [
    `Wishit — ${eyebrow.toLowerCase()}`,
    '',
    line,
    '',
    `    ${code}`,
    '',
    `It expires in ${expiresInMinutes} minutes and works once.`,
    'Letter case does not matter, and the dashes are optional.',
    '',
    disclaimer,
  ].join('\n');

  /*
   * Tables, inline styles, no shorthand — Outlook still renders mail through
   * Word, which ignores most of what a browser would take.
   *
   * `color-scheme: light` is doing real work rather than decorating. Left out,
   * Apple Mail and Outlook's dark mode invert the whole message: the lime block
   * goes muddy, the paper goes near-black, and the one element that has to be
   * legible — twelve characters somebody is retyping by hand — comes out at
   * whatever contrast the inverter happened to land on. This pins it to light.
   */
  const html = `<!doctype html>
<html lang="en" style="color-scheme:light;supported-color-schemes:light;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  /* Phones: tighten the gutters and keep the code on one line. */
  @media only screen and (max-width:600px) {
    .wrap { padding: 16px 12px !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .code { font-size: 21px !important; letter-spacing: 1px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${C.surface};">

<!-- Inbox preview line. Hidden in the message itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${line} Code: ${code}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.surface};">
  <tr>
    <td align="center" class="wrap" style="padding:40px 20px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;background-color:${C.ground};border:1px solid ${C.line};border-radius:16px;">

        <tr>
          <td class="pad" style="padding:32px 40px 0 40px;">${logo}</td>
        </tr>

        <tr>
          <td class="pad" style="padding:24px 40px 0 40px;">
            <div style="height:1px;background-color:${C.line};font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:28px 40px 0 40px;">
            <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${C.accent};">${eyebrow}</div>
            <h1 style="margin:10px 0 0 0;font-family:${SERIF};font-size:27px;font-weight:bold;line-height:1.25;letter-spacing:-0.5px;color:${C.ink};">${heading}</h1>
            <p style="margin:12px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.inkSoft};">${line}</p>
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:24px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.surfaceLift};border:1px solid ${C.line};border-radius:12px;">
              <tr>
                <td align="center" style="padding:26px 16px;">
                  <div class="code" style="font-family:${MONO};font-size:26px;font-weight:bold;letter-spacing:2px;line-height:1.3;color:${C.ink};white-space:nowrap;">${code}</div>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.inkFaint};">
              Expires in ${expiresInMinutes} minutes and works once. Letter case does not matter, and you can skip the dashes.
            </p>
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:28px 40px 32px 40px;">
            <div style="height:1px;background-color:${C.line};font-size:0;line-height:0;">&nbsp;</div>
            <p style="margin:20px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.inkFaint};">${disclaimer}</p>
          </td>
        </tr>

      </table>

      <p style="margin:20px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.inkFaint};">
        Wishit — if I buy this, what does it cost me in time?
      </p>

    </td>
  </tr>
</table>

</body>
</html>`;

  return { subject, text, html };
}

export async function sendCodeEmail({ to, ...rest }: CodeEmail): Promise<void> {
  await mailer().sendMail({ from, to, ...renderCodeEmail(rest) });
}

export interface FeedbackEmail {
  kind: 'issue' | 'suggestion';
  message: string;
  /** Who sent it, as far as we know: the signed-in address or one they typed. */
  from?: string | null;
  page?: string | null;
  errorDigest?: string | null;
  userAgent?: string | null;
}

/**
 * Tells you a report arrived, so a tester's bug does not sit in a table nobody
 * opens. The report is already stored by the time this runs — the mail is the
 * notification, not the record, which is why plain text is enough.
 */
export async function sendFeedbackEmail(report: FeedbackEmail): Promise<void> {
  const to = process.env.FEEDBACK_EMAIL ?? user;
  if (!to) return;

  const label = report.kind === 'suggestion' ? 'suggestion' : 'issue';
  const text = [
    report.message,
    '',
    `From: ${report.from ?? 'not signed in, no address given'}`,
    `Page: ${report.page ?? '—'}`,
    report.errorDigest ? `Error digest: ${report.errorDigest}` : null,
    report.userAgent ? `Browser: ${report.userAgent}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  await mailer().sendMail({
    from,
    to,
    // Replying reaches the tester when they gave an address, which is the
    // difference between a report and a conversation.
    replyTo: report.from ?? undefined,
    subject: `Wishit ${label}: ${report.message.slice(0, 60).replace(/\s+/g, ' ')}`,
    text,
  });
}
