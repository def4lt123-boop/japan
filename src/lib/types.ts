/**
 * Zentrale Datentypen. Die Feldnamen sind absichtlich identisch zu den
 * Spaltennamen in Supabase (snake_case) – so braucht es keine Mapping-Schicht.
 * Siehe auch: supabase/schema.sql
 */

export type BookingStatus = 'offen' | 'reserviert' | 'gebucht' | 'erledigt';
export type Priority = 'muss' | 'soll' | 'kann';
export type TimeSlot = 'Vormittag' | 'Mittag' | 'Nachmittag' | 'Abend' | 'Nachts' | 'Ganzer Tag';
/** Ticket-Frage an einem Ort: unklar → braucht Ticket → gekauft, oder gar keins */
export type TicketStatus = 'unklar' | 'noetig' | 'gekauft' | 'keins';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  budget_eur: number | null;
  jpy_rate: number | null; // 1 EUR = x JPY
  notes: string | null;
  archived: boolean;
}

export interface Place {
  id: string;
  trip_id: string;
  name: string;
  city: string;
  district: string | null;
  category: string | null;
  /** Tag, an dem der Ort geplant ist – null = noch in der Wünscheliste */
  date: string | null;
  /** bis zu diesem Tag (Mehrtages-Ausflug) – null = ein Tag */
  end_date: string | null;
  time_slot: TimeSlot | string | null;
  start_time: string | null; // "13:00"
  /** Dauer in Minuten */
  duration_min: number | null;
  travel_time: string | null; // Fahrzeit vom Hotel, z. B. "Ca 30 Min"
  notes: string | null;
  price_eur: number | null;
  price_note: string | null;
  booking_status: BookingStatus;
  booking_url: string | null;
  /** Ticket needing / bought / not needed – getrennt vom Buchungsstatus */
  ticket_status: TicketStatus;
  /** z. B. „Timed Entry 10:00, 2 Personen“ */
  ticket_note: string | null;
  priority: Priority;
  /** Suchbegriff für Google Maps, falls keine Koordinaten */
  maps_query: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  /** Sortierung innerhalb eines Tages */
  sort_order: number;
  created_at?: string;
}

export interface Hotel {
  id: string;
  trip_id: string;
  name: string;
  city: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  price_total_eur: number | null;
  price_per_night_eur: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  booking_url: string | null;
  booking_status: BookingStatus;
  notes: string | null;
  created_at?: string;
}

export interface Journey {
  id: string;
  trip_id: string;
  date: string | null;
  /** Ankunft / Rückflug – null = selben Tages */
  end_date: string | null;
  title: string;
  from_city: string | null;
  to_city: string | null;
  mode: string | null; // Flug, Shinkansen, Zug, Bus, Fähre, Auto ...
  departure_time: string | null;
  duration_min: number | null;
  price_eur: number | null;
  hotel_name: string | null;
  nights: number | null;
  booking_status: BookingStatus;
  notes: string | null;
  created_at?: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  date: string | null;
  category: string;
  description: string | null;
  amount_eur: number;
  payer: string | null;
  created_at?: string;
}

export interface Snapshot {
  trips: Trip[];
  places: Place[];
  hotels: Hotel[];
  journeys: Journey[];
  expenses: Expense[];
}

export interface TripBundle {
  trip: Trip;
  places: Place[];
  hotels: Hotel[];
  journeys: Journey[];
  expenses: Expense[];
}

export const BOOKING_STATUSES: BookingStatus[] = ['offen', 'reserviert', 'gebucht', 'erledigt'];
export const PRIORITIES: Priority[] = ['muss', 'soll', 'kann'];
export const TICKET_STATUSES: TicketStatus[] = ['unklar', 'noetig', 'gekauft', 'keins'];
export const TIME_SLOTS: TimeSlot[] = [
  'Vormittag',
  'Mittag',
  'Nachmittag',
  'Abend',
  'Nachts',
  'Ganzer Tag',
];
export const JOURNEY_MODES = [
  'Flug',
  'Shinkansen',
  'Zug',
  'Bus',
  'Fähre',
  'U-Bahn',
  'Auto',
  'zu Fuß',
];
export const EXPENSE_CATEGORIES = [
  'Transport',
  'Essen & Trinken',
  'Eintritt & Touren',
  'Shopping',
  'Aktivität',
  'Nebenkosten',
  'Sonstiges',
];
