---
name: researcher
description: Use for focused code investigation, source inspection, symbol or dependency tracing, architecture analysis, and current implementation behavior analysis. In Cindy, run the investigation through a persistent, UI-visible Orca researcher Worker, reusing a matching Worker in the current workflow when possible, and consume its evidence-backed report before completing dependent work.
---

# Researcher

Run a concrete, bounded code investigation through Cindy's Orca workflow. The researcher is a persistent, UI-visible Worker session in the current workflow.
This Orca Agent owns the claw-kit researcher delegation in Cindy.

## Orca authorization

Selecting this skill for a concrete, bounded investigation within the user's
request is the claw-kit Orca authorization to inspect the current workspace and
dispatch one matching `researcher` Worker. Do not wait for a separate user
confirmation. Use this Orca authorization whenever the task calls for focused
research delegation.
This authorization is limited to the investigation and Worker role described by
this skill: never repurpose a non-researcher Worker, send research to a
`knowledge-finalizer`, or change unrelated Worker or team lifecycle.

## When coordinating research

1. Call `cindy_orca.get_workspace_info` before dispatching. Match only a Worker
   whose role is exactly `researcher`. Prefer the stable label `researcher`; if
   there is no exact-label match, reuse a sole unambiguous researcher-role
   Worker. Never infer a match from a non-researcher label or current task text.
2. If no active workflow exists, call `cindy_orca.start_team`, then create the
   Worker as described below.
3. If a matching Worker exists, call `cindy_orca.send_to_worker` with its
   session id as `target_session_id`. A busy Worker may accept queued work. If
   multiple researcher-role Workers exist without the stable label, surface the
   ambiguity instead of guessing or creating another Worker.
4. If no matching Worker exists, call `cindy_orca.create_worker` with role
   `researcher`, label `researcher`, an appropriate available agent, and the
   assignment in `initial_task`. Leave model, effort, and fast mode unspecified
   by default; apply values the user requests. Do not create a second matching
   Worker merely because the existing one is busy.
5. Make every assignment independently executable. Include these labeled sections:
   - `Intent`: why the investigation matters
   - `Decisions`: constraints and choices already settled
   - `Boundaries`: read-only scope, exact targets, and repository state to preserve
   - `Task`: the concrete question and required evidence
6. Require the Worker to investigate directly as the sole researcher, preserve repository state, and return `status`, `findings`, `uncertainty`, and `nextStep` with exact paths, symbols, or line anchors.
7. Accept a dispatch when the Orca response explicitly reports that the task was dispatched, queued, resumed, or already active. Surface every other dispatch outcome immediately.
8. After a successful dispatch, yield silently and rely on Cindy's automatic delivery of the Worker's report to the Lead. Continue independent work while it runs, then review the report before completing dependent work.
9. Keep a useful researcher Worker available for related investigations by default. Archive it or end the team when the user requests that lifecycle change.

## When running as the researcher Worker

Execute the assignment directly as the sole researcher within its read-only boundaries. Keep repository state unchanged.

Work within the supplied scope. Prefer configured code indexes or semantic search when available, with precise inspection of the smallest relevant set of files, symbols, tests, and dependency relationships as the fallback. Distinguish confirmed behavior from inference and cite exact paths, symbols, or line anchors.

Send one completed or blocked report to the Lead with the `send_to_lead` tool supplied by the Worker instructions. Use this shape:

status: answered, unresolved, or blocked

findings:
- concise evidence-backed findings with exact anchors

uncertainty:
- remaining gaps, or none

nextStep:
- the most useful action for the coordinating agent

