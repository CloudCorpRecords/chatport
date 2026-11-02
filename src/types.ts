/**
 * chatport types.
 *
 * Each send tool takes a recipient phone number plus the fields for
 * its message kind. HTTP access is described by a minimal response
 * surface so tests can inject a fake fetch and never touch the
 * network.
 */

export interface SendTextOptions {
  phone: string;
  message: string;
}

export interface SendContactOptions {
  phone: string;
  contact_name: string;
  contact_phone: string;
}

export interface SendLinkOptions {
  phone: string;
  link: string;
  caption?: string;
}

export interface SendLocationOptions {
  phone: string;
  latitude: number;
  longitude: number;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
