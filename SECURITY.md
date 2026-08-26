# Security policy

## Supported versions

Security fixes are provided for the latest published major version.

| Version | Supported |
| --- | --- |
| 2.x | Yes |
| 1.x | No |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use [GitHub's private vulnerability reporting](https://github.com/MAnand59/igolf-sdk/security/advisories/new) or email [anand.mayank59@gmail.com](mailto:anand.mayank59@gmail.com). Include reproduction steps, affected versions, potential impact, and any suggested mitigation. Do not include live iGolf credentials.

You should receive an acknowledgement within seven days. Details will remain private until a fix and disclosure plan are ready.

## Credential safety

`appSecret` is a server-side credential. Never put it in browser bundles, mobile applications, public logs, issue reports, tests, or committed environment files. Rotate credentials immediately if they may have been exposed.
