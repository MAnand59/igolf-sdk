import { createHmac } from "node:crypto";

export const IGOLF_SIGN_METHOD = "HMAC-SHA256" as const;

export interface IgolfConfig {
  baseUrl: string;
  appKey: string;
  apiVersion: string;
  signVersion: string;
  signMethod: typeof IGOLF_SIGN_METHOD;
  appSecret: string;
  timeoutMs?: number;
}

export type ApiResponse<T> =
  | { stat: true; data: T }
  | { stat: false; data: string };

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 10 * 60_000;

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function validateTimeout(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > MAX_TIMEOUT_MS) {
    throw new RangeError(`${fieldName} must be an integer between 1 and ${MAX_TIMEOUT_MS}.`);
  }

  return value as number;
}

function normalizeActionBaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("baseUrl must use http or https.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("baseUrl must not contain credentials, a query string, or a fragment.");
  }

  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/rest/action") ? path : `${path}/rest/action`;

  return url.toString().replace(/\/$/, "");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function encodePathSegment(value: string): string {
  // A timezone's leading "+" is part of the iGolf timestamp wire format.
  return encodeURIComponent(value).replace(/%2B/gi, "+");
}

function formatTimestamp(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);

  return [
    pad(date.getFullYear() % 100),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    offsetSign,
    pad(Math.floor(absoluteOffset / 60)),
    pad(absoluteOffset % 60),
  ].join("");
}

function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const keys = ["Message", "message", "Error", "error", "StatusMessage", "statusMessage"];

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class IGolfController {
  private readonly baseUrl: string;
  private readonly appKey: string;
  private readonly apiVersion: string;
  private readonly signVersion: string;
  private readonly signMethod: typeof IGOLF_SIGN_METHOD;
  private readonly appSecret: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(config: IgolfConfig) {
    if (!config || typeof config !== "object") {
      throw new TypeError("An iGolf configuration object is required.");
    }

    this.baseUrl = normalizeActionBaseUrl(requiredString(config.baseUrl, "baseUrl"));
    this.appKey = requiredString(config.appKey, "appKey");
    this.apiVersion = requiredString(config.apiVersion, "apiVersion");
    this.signVersion = requiredString(config.signVersion, "signVersion");
    this.appSecret = requiredString(config.appSecret, "appSecret");

    if (config.signMethod !== IGOLF_SIGN_METHOD) {
      throw new TypeError(`signMethod must be ${IGOLF_SIGN_METHOD}.`);
    }
    this.signMethod = config.signMethod;

    this.timeoutMs = config.timeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : validateTimeout(config.timeoutMs, "timeoutMs");

    if (typeof globalThis.fetch !== "function") {
      throw new Error("igolf-sdk requires Node.js 18.17 or newer with global fetch support.");
    }
    this.fetchImplementation = globalThis.fetch.bind(globalThis);
  }

  private toSign(actionCode: string, timestamp: string, responseFormat = "JSON"): string {
    return [
      actionCode,
      this.appKey,
      this.apiVersion,
      this.signVersion,
      this.signMethod,
      timestamp,
      responseFormat,
    ].join("/");
  }

  private generateSignature(message: string): string {
    return createHmac("sha256", this.appSecret).update(message, "utf8").digest("base64url");
  }

  private generateUrl(actionCode: string): string {
    const timestamp = formatTimestamp(new Date());
    const signature = this.generateSignature(this.toSign(actionCode, timestamp));
    const segments = [
      actionCode,
      this.appKey,
      this.apiVersion,
      this.signVersion,
      this.signMethod,
      signature,
      timestamp,
      "JSON",
    ].map(encodePathSegment);

    return `${this.baseUrl}/${segments.join("/")}`;
  }

  private async apiCall<T>(
    actionCode: string,
    params: Record<string, unknown>,
    options: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const timeoutMs = options.timeoutMs === undefined
      ? this.timeoutMs
      : validateTimeout(options.timeoutMs, "options.timeoutMs");
    const controller = new AbortController();
    let timedOut = false;

    const cancelRequest = (): void => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) {
      cancelRequest();
    } else {
      options.signal?.addEventListener("abort", cancelRequest, { once: true });
    }

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await this.fetchImplementation(this.generateUrl(actionCode), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      const body = await readResponseBody(response);

      if (!response.ok) {
        const details = extractErrorMessage(body);
        const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
        return { stat: false, data: details ?? `iGolf request failed with HTTP ${status}.` };
      }

      if (body && typeof body === "object") {
        const status = (body as Record<string, unknown>).Status;
        if (status === 1 || status === "1") {
          return { stat: true, data: body as T };
        }

        return {
          stat: false,
          data: extractErrorMessage(body) ?? "The iGolf API reported an unsuccessful response.",
        };
      }

      return { stat: false, data: "The iGolf API returned an unexpected response." };
    } catch (error: unknown) {
      if (timedOut) {
        return { stat: false, data: `The iGolf request timed out after ${timeoutMs} ms.` };
      }

      if (options.signal?.aborted) {
        return { stat: false, data: "The iGolf request was cancelled." };
      }

      return {
        stat: false,
        data: error instanceof Error ? error.message : "An unknown iGolf request error occurred.",
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancelRequest);
    }
  }

  public async requestWithActionCode<T = unknown>(
    actionCode: string,
    params: Record<string, unknown> = {},
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const normalizedActionCode = requiredString(actionCode, "actionCode");

    if (/[/?#]/.test(normalizedActionCode)) {
      throw new TypeError("actionCode must be a single URL path segment.");
    }

    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new TypeError("params must be an object.");
    }

    return this.apiCall<T>(normalizedActionCode, params, options);
  }
}
