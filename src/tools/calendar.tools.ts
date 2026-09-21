/**
 * Calendar & Booking Tools — Google Calendar API
 * All credentials provided per-request by the tenant.
 */
import { z } from 'zod';
import { defineTool } from './tool-helper.js';
import { google } from 'googleapis';

export interface TenantCalendarKeys {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  googleCalendarId?: string;
}

export function createCalendarTools(keys: TenantCalendarKeys) {
  function getCalendarClient() {
    const clientId = keys.googleClientId || process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
    const clientSecret = keys.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    
    if (keys.googleRefreshToken) {
      oauth2Client.setCredentials({ refresh_token: keys.googleRefreshToken, access_token: keys.googleAccessToken });
    } else if (keys.googleAccessToken) {
      oauth2Client.setCredentials({ access_token: keys.googleAccessToken });
    }
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  return {
    checkCalendarAvailability: defineTool({
      description: 'Check free/busy slots in a Google Calendar for a specific date.',
      parameters: z.object({
        date: z.string().describe('Date in ISO 8601 format e.g. 2024-11-15'),
        durationMinutes: z.number().default(60).describe('Duration needed in minutes.'),
      }),
      execute: async ({ date }) => {
        try {
          const calendar = getCalendarClient();
          const { data } = await calendar.freebusy.query({
            requestBody: {
              timeMin: new Date(`${date}T08:00:00`).toISOString(),
              timeMax: new Date(`${date}T18:00:00`).toISOString(),
              items: [{ id: keys.googleCalendarId || 'primary' }],
            },
          });
          const busy = data.calendars?.['primary']?.busy || [];
          return { success: true, date, busySlots: busy, totalBusy: busy.length };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),

    createAppointment: defineTool({
      description: 'Create a new appointment in Google Calendar. Use after confirming time.',
      parameters: z.object({
        title: z.string().describe('Appointment title.'),
        startDateTime: z.string().describe('Start ISO 8601 datetime e.g. 2024-11-15T14:00:00'),
        endDateTime: z.string().describe('End ISO 8601 datetime.'),
        attendeeEmail: z.string().optional().describe("Customer's email for calendar invite."),
        description: z.string().optional().describe('Appointment notes.'),
        location: z.string().optional().describe('Location or address.'),
      }),
      execute: async ({ title, startDateTime, endDateTime, attendeeEmail, description, location }) => {
        try {
          const calendar = getCalendarClient();
          const { data } = await calendar.events.insert({
            calendarId: keys.googleCalendarId || 'primary',
            sendUpdates: attendeeEmail ? 'all' : 'none',
            requestBody: {
              summary: title, description, location,
              start: { dateTime: startDateTime, timeZone: 'UTC' },
              end: { dateTime: endDateTime, timeZone: 'UTC' },
              attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
            },
          });
          return { success: true, eventId: data.id, eventLink: data.htmlLink };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),

    cancelAppointment: defineTool({
      description: 'Cancel an existing Google Calendar appointment by event ID.',
      parameters: z.object({
        eventId: z.string().describe('Google Calendar event ID to cancel.'),
        notifyAttendees: z.boolean().default(true).describe('Send cancellation notifications.'),
      }),
      execute: async ({ eventId, notifyAttendees }) => {
        try {
          const calendar = getCalendarClient();
          await calendar.events.delete({
            calendarId: keys.googleCalendarId || 'primary',
            eventId, sendUpdates: notifyAttendees ? 'all' : 'none',
          });
          return { success: true, message: `Event ${eventId} cancelled.` };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),

    listUpcomingAppointments: defineTool({
      description: 'List upcoming appointments from Google Calendar in a date range.',
      parameters: z.object({
        startDate: z.string().describe('Start date ISO 8601.'),
        endDate: z.string().describe('End date ISO 8601.'),
        maxResults: z.number().default(10).describe('Max results to return.'),
      }),
      execute: async ({ startDate, endDate, maxResults }) => {
        try {
          const calendar = getCalendarClient();
          const { data } = await calendar.events.list({
            calendarId: keys.googleCalendarId || 'primary',
            timeMin: new Date(startDate).toISOString(),
            timeMax: new Date(endDate).toISOString(),
            maxResults, singleEvents: true, orderBy: 'startTime',
          });
          const events = (data.items || []).map(e => ({
            id: e.id, title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            attendees: e.attendees?.map(a => a.email),
          }));
          return { success: true, events };
        } catch (err: unknown) { return { success: false, error: (err as Error).message }; }
      },
    }),
  };
}
