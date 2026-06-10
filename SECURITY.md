# Security Policy

## Scope and threat model

dspack-export is a command-line code-analysis tool. It reads source files
from a project you point it at and writes **one** output file. Its security
posture rests on three invariants:

- **Bounded writes** — the tool writes exactly one file: the output path
  named in the config (or the default `<name>.dspack.json`). Any behavior
  where it writes anywhere else, modifies project sources, or deletes files
  is a defect of the highest priority.
- **No network** — the tool makes no outbound network calls of any kind.
  Extraction is entirely local (TypeScript checker, Babel parsing, CSS file
  reads).
- **No shell execution** — the tool never spawns shell commands or executes
  code from the analyzed project. Note the boundary here: the TypeScript
  checker and Babel *parse* project code; they do not run it. A crafted
  project that achieves code execution through the analysis pipeline (e.g.
  via a malicious tsconfig or dependency resolution trick in the checker)
  would violate this invariant and should be reported.

These are architectural constraints, not policy guidelines. If you observe a
deviation — even in an error path, even if it appears intentional — please
report it as a security concern.

Other categories we want to hear about:

- **Input handling defects** — source files or CSS that cause crashes,
  path traversal via `@import` following or config globs, or resource
  exhaustion.
- **Output integrity** — generated documents that pass the bundled schema
  validation but could behave adversarially when served to AI agents
  downstream (e.g. injected content in descriptions).
- **Dependency vulnerabilities** that apply to this tool's use case.

---

## Reporting a vulnerability

For concerns that could cause harm if disclosed publicly, email
[security@aestheticfunction.com](mailto:security@aestheticfunction.com) with:

- A short description of the issue
- The affected component or behavior
- Why you believe the issue has security implications
- Steps to reproduce or evaluate the concern
- Any suggested mitigation, if you have one

Please do not open a public GitHub issue for sensitive reports. For
non-sensitive issues — a repo that crashes extraction, misleading
documentation about security properties — a public issue is appropriate.

## What to expect

We will acknowledge receipt as soon as practical, assess impact, and
communicate a remediation plan. Invariant violations (writes outside the
output path, network calls, code execution) are treated as high priority
regardless of how exotic the trigger is. If a vulnerability affects
downstream users in a way that warrants coordinated disclosure, we will work
with you on a timeline before discussing it publicly.
