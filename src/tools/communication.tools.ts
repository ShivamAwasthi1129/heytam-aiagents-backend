/**
 * Communication Tools — Twilio SMS, Email (SMTP), Voice Calls, WhatsApp.
 * All credentials come from tenantKeys passed per-request.
 */
import { z } from 'zod';
import { defineTool } from './tool-helper.js';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

export interface TenantCommunicationKeys {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromPhone?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

export function createCommunicationTools(keys: TenantCommunicationKeys) {
  return {
    sendSms: defineTool({
      description: 'Send an SMS via Twilio for follow-ups, appointment reminders, or recovery messages.',
      parameters: z.object({
        to: z.string().describe('E.164 phone number e.g. +15551234567'),
        message: z.string().describe('SMS body. Keep under 160 characters.'),
      }),
      execute: async ({ to, message }) => {
        if (!keys.twilioAccountSid || !keys.twilioAuthToken || !keys.twilioFromPhone)
          return { success: false, error: 'Twilio credentials not provided by tenant.' };
        try {
          const client = twilio(keys.twilioAccountSid, keys.twilioAuthToken);
          const msg = await client.messages.create({ body: message, from: keys.twilioFromPhone, to });
          return { success: true, messageSid: msg.sid, status: String(msg.status) };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),

    sendEmail: defineTool({
      description: 'Send an email via SMTP (Outlook, Gmail App Password, SendGrid SMTP, etc.).',
      parameters: z.object({
        to: z.string().describe('Recipient email address.'),
        subject: z.string().describe('Email subject line.'),
        body: z.string().describe('Plain text email body.'),
        htmlBody: z.string().optional().describe('Optional HTML body.'),
      }),
      execute: async ({ to, subject, body, htmlBody }) => {
        if (!keys.smtpHost || !keys.smtpUser || !keys.smtpPass)
          return { success: false, error: 'SMTP credentials not provided by tenant.' };
        try {
          const cleanPass = keys.smtpPass.trim().replace(/\s+/g, '');
          const transporter = nodemailer.createTransport({
            host: keys.smtpHost, port: keys.smtpPort || 587,
            secure: (keys.smtpPort || 587) === 465,
            auth: { user: keys.smtpUser, pass: cleanPass },
          });
          const info = await transporter.sendMail({ from: keys.smtpFrom || keys.smtpUser, to, subject, text: body, html: htmlBody });
          return { success: true, messageId: info.messageId };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),

    makeVoiceCall: defineTool({
      description: 'Initiate an outbound voice call via Twilio TTS for proactive outreach.',
      parameters: z.object({
        to: z.string().describe('E.164 phone number to call.'),
        message: z.string().describe('Spoken message to deliver via Twilio TTS.'),
      }),
      execute: async ({ to, message }) => {
        if (!keys.twilioAccountSid || !keys.twilioAuthToken || !keys.twilioFromPhone)
          return { success: false, error: 'Twilio credentials not provided by tenant.' };
        try {
          const client = twilio(keys.twilioAccountSid, keys.twilioAuthToken);
          const call = await client.calls.create({
            to, from: keys.twilioFromPhone,
            twiml: `<Response><Say voice="Polly.Joanna">${message}</Say></Response>`,
          });
          return { success: true, callSid: call.sid, status: String(call.status) };
        } catch (err: unknown) {
          const msg = (err as Error).message;
          if (msg.includes('trial') || msg.includes('unverified')) {
            return { success: false, error: `Twilio Trial Limitation: Phone number ${to} must be verified in Twilio Console (Verified Caller IDs). Details: ${msg}` };
          }
          return { success: false, error: msg };
        }
      },
    }),

    sendWhatsApp: defineTool({
      description: 'Send a WhatsApp message via Twilio WhatsApp channel.',
      parameters: z.object({
        to: z.string().describe('WhatsApp phone number: whatsapp:+15551234567'),
        message: z.string().describe('WhatsApp message body.'),
      }),
      execute: async ({ to, message }) => {
        if (!keys.twilioAccountSid || !keys.twilioAuthToken || !keys.twilioFromPhone)
          return { success: false, error: 'Twilio credentials not provided by tenant.' };
        try {
          const client = twilio(keys.twilioAccountSid, keys.twilioAuthToken);
          const msg = await client.messages.create({
            body: message, from: `whatsapp:${keys.twilioFromPhone}`,
            to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
          });
          return { success: true, messageSid: msg.sid, status: String(msg.status) };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),
  };
}
