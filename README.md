# igolf-sdk

[![npm version](https://img.shields.io/npm/v/igolf-sdk.svg)](https://www.npmjs.com/package/igolf-sdk)
[![CI](https://github.com/MAnand59/igolf-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/MAnand59/igolf-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/igolf-sdk.svg)](LICENSE)

A small, typed, server-side Node.js SDK for making signed requests to the iGolf API.

The SDK creates iGolf HMAC-SHA256 action URLs, sends JSON `POST` requests, and returns a discriminated response object that works cleanly in JavaScript and TypeScript.

## Requirements

- Node.js 18.17 or newer
- An iGolf application key and secret
- An HTTPS iGolf API endpoint

> [!IMPORTANT]
> Use this SDK only in trusted server-side code. Supplying `appSecret` in browser or mobile code exposes the secret to end users.

## Installation

```bash
npm install igolf-sdk
```

## Quick start

```ts
import { IGolfController } from "igolf-sdk";

interface CourseListResponse {
  Status: 1;
  Courses: Array<{
    Id: number;
    Name: string;
  }>;
}

const igolf = new IGolfController({
  baseUrl: process.env.IGOLF_BASE_URL!,
  appKey: process.env.IGOLF_APP_KEY!,
  apiVersion: "1.0",
  signVersion: "1.0",
  signMethod: "HMAC-SHA256",
  appSecret: process.env.IGOLF_APP_SECRET!,
});

const response = await igolf.requestWithActionCode<CourseListResponse>(
  "CourseList",
  {
    referenceLatitude: 40.71,
    referenceLongitude: -74.0,
    radius: 50,
    page: 1,
  },
);

if (response.stat) {
  console.log(response.data.Courses);
} else {
  console.error(response.data);
}
```

CommonJS is also supported:

```js
const { IGolfController } = require("igolf-sdk");
```

## Configuration

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | Yes | Absolute iGolf API base URL. `/rest/action` may be included or omitted. |
| `appKey` | `string` | Yes | iGolf application key. |
| `apiVersion` | `string` | Yes | iGolf API version, such as `"1.0"`. |
| `signVersion` | `string` | Yes | iGolf signing version, such as `"1.0"`. |
| `signMethod` | `"HMAC-SHA256"` | Yes | Supported signing method. |
| `appSecret` | `string` | Yes | Private signing secret. Never expose or commit it. |
| `timeoutMs` | `number` | No | Default request timeout. Defaults to 30,000 ms; maximum 600,000 ms. |

The constructor validates its configuration immediately. It rejects unsupported protocols, malformed URLs, invalid timeouts, and unsupported signing methods before a request is sent.

## API

### `requestWithActionCode<T>()`

```ts
requestWithActionCode<T = unknown>(
  actionCode: string,
  params?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<ApiResponse<T>>
```

The method sends one signed JSON `POST` request. `actionCode` must be a single non-empty URL path segment.

Request options:

```ts
interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}
```

Use `timeoutMs` to override the configured timeout for one request:

```ts
const response = await igolf.requestWithActionCode(
  "CourseList",
  { radius: 25 },
  { timeoutMs: 5_000 },
);
```

Use an `AbortSignal` for caller-controlled cancellation:

```ts
const controller = new AbortController();

const request = igolf.requestWithActionCode(
  "CourseList",
  {},
  { signal: controller.signal },
);

controller.abort();
const response = await request;
```

### Response model

`ApiResponse<T>` is a discriminated union:

```ts
type ApiResponse<T> =
  | { stat: true; data: T }
  | { stat: false; data: string };
```

- `stat: true` means the HTTP request succeeded and iGolf returned `Status: 1`.
- `stat: false` contains a validation, HTTP, iGolf, timeout, cancellation, or transport error message.
- Request failures are returned as values. Invalid SDK inputs still throw synchronously or reject the async call with a `TypeError`/`RangeError`.

## How signing works

For each request, the SDK:

1. Creates a timestamp in `YYMMDDHHmmss±HHmm` format.
2. Joins the action code, application key, API version, signing version, signing method, timestamp, and `JSON` response format with `/`.
3. Signs that string with HMAC-SHA256 using `appSecret`.
4. Encodes the signature using URL-safe Base64 without padding.
5. Places the signature and timestamp in the iGolf action URL.

The iGolf signing format covers URL authentication metadata; it does not hash the JSON request body. Always use HTTPS and keep the secret on a trusted server.

## Migrating from 1.x

Version 2 is a major release because it corrects behavior visible to callers:

- Node.js 18.17+ is required.
- iGolf responses whose `Status` is not `1` now return `stat: false` instead of a successful empty array.
- `requestWithActionCode<T>()` now implements the generic response type documented by version 1.
- Request parameters use `Record<string, unknown>` instead of `Record<string, any>`.
- The malformed repeated-timezone timestamp was replaced by one `±HHmm` offset.
- Axios, CryptoJS, Moment, and the obfuscation build have been removed.

## Development

```bash
npm ci
npm run check
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check source and type-level examples. |
| `npm test` | Build and run behavioral tests. |
| `npm run test:package` | Pack and install the tarball in a clean consumer project. |
| `npm run check` | Run every release check. |

Generated `dist` files are intentionally not committed. `npm pack` and `npm publish` run the complete release check through `prepack`.

## Support and contributing

- [Report a bug](https://github.com/MAnand59/igolf-sdk/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/MAnand59/igolf-sdk/issues/new?template=feature_request.yml)
- [View all issues](https://github.com/MAnand59/igolf-sdk/issues)
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- Report security problems according to [SECURITY.md](SECURITY.md), not through a public issue.

## License

[MIT](LICENSE) © Mayank Anand
