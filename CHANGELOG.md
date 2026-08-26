# Changelog

All notable changes to this project are documented here. Releases follow [Semantic Versioning](https://semver.org/) and Git tags use the `v<major>.<minor>.<patch>` format.

## [2.0.0] - 2026-08-26

### Added

- Generic `requestWithActionCode<T>()` response typing.
- Constructor and request validation.
- Configurable per-client and per-request timeouts.
- `AbortSignal` cancellation support.
- Deterministic signing, response, transport, timeout, type, and tarball-consumer tests.
- GitHub CI, issue templates, security guidance, and tag-driven releases.

### Changed

- Require Node.js 18.17 or newer.
- Replace Axios, CryptoJS, and Moment with native Node.js APIs.
- Return a discriminated `ApiResponse<T>` union.
- Treat iGolf responses whose `Status` is not `1` as failures.
- Generate JavaScript and declarations directly in `dist`.
- Publish readable JavaScript without obfuscation.

### Fixed

- Correct the timestamp from three repeated timezone offsets to one `±HHmm` offset.
- Avoid duplicate `/rest/action` URL segments.
- Preserve useful iGolf and HTTP error messages.
- Ensure a clean build produces the declared package entry point.
- Synchronize package and lockfile versions.

### Removed

- The obfuscation build and `dist_temp` output.
- All runtime package dependencies.

[2.0.0]: https://github.com/MAnand59/igolf-sdk/releases/tag/v2.0.0
