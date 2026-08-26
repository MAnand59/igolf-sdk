# Contributing

Thank you for helping improve `igolf-sdk`.

## Before opening an issue

- Search [existing issues](https://github.com/MAnand59/igolf-sdk/issues).
- Use the bug or feature issue form when possible.
- Do not include application keys, secrets, signed production URLs, or private iGolf response data.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install dependencies with `npm ci`.
3. Make the smallest change that solves the problem.
4. Add or update tests and documentation.
5. Run `npm run check`.
6. Open a pull request and explain the behavior change and compatibility impact.

Do not commit generated `dist` files. The release pipeline builds them from TypeScript.

## Compatibility

Changes to authentication, timestamp generation, URLs, response handling, or exported types must include regression tests. Breaking changes require a new major version under Semantic Versioning.

## Commit and pull-request guidance

- Use clear, imperative commit subjects.
- Keep unrelated changes in separate pull requests.
- Link the relevant issue when one exists.
- Confirm that no secrets or customer data appear in the diff.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
