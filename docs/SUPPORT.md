# Support matrix

| Component | Supported | Verification |
| --- | --- | --- |
| Node.js runtime | `>=18.18` | package engines and CI Node 22/24 |
| Next.js | `>=13.4` | Next 13.5.11 and 16.3.6 consumer fixtures |
| React | `>=18.2` | React 18.2.0 and 19.3.0 consumer fixtures |
| Module format | ESM | packed ESM runtime and type smoke tests |
| Browsers | Chromium, Firefox, WebKit | Playwright demo suite |
| CommonJS | not supported | do not use `require()` contract |

The current adapter support status is available at runtime through
`getAdapterCapabilities()` and `listAdapterCapabilities()`.
