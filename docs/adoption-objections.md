# Adoption objections — design checklist

Derived from Wildlife Sense's decline (Chanel Comis, 5 June), which is the most
detailed statement we have of why an established sea turtle project says no.
None of the objections were about features or quality. They were about
**control, sustainability and exit** — and every other long-running project
will raise the same ones.

This is a design checklist, not a backlog. Items marked **Not started** are
the difference between a good app and one an established project can adopt
without taking on risk it can't carry.

---

## 1. "This isn't currently a problem we're trying to solve"

> "We didn't set out looking for a software solution … We've been using our
> existing Excel-based system for a long time, and while it's not perfect, it
> has the advantage of being something we fully control and understand."

The blocker isn't the app — it's that Excel's failures are tolerated and
understood, while a new system's failures are unknown. Not solvable by
building more. Solvable only by leading with a specific, named pain the
project already complains about, and by being additive to Excel rather than a
replacement for it.

- [ ] **Lead with one workflow, not the platform.** The pitch is a single
      painful task (e.g. the season report, or reconciling relocations across
      several people's sheets), not "a field data platform".
- [ ] **Quantify the pain in their terms** — hours spent, transcription
      errors found, records lost — before proposing anything.
- [ ] **Never ask a project to stop using Excel.** Position as a collection
      layer that feeds their existing sheet. See §5.

## 2. "A number of people have approached us with proposals for similar systems"

> "In most cases, it eventually becomes clear that the complexity and specific
> needs of the project are difficult to fully capture in a custom platform."

We are pattern-matched into a category with a track record of failure. The
differentiator has to be visible in the first five minutes, not argued for.

- [ ] **Show the existing product, not a proposal.** A working live app with
      real depth (relocations, excavation superseding emergences, review
      queue) already answers "can this capture our complexity?" better than
      any pitch document.
- [x] Demo roles on the login screen let someone evaluate it in 30 seconds
      without an account — already shipped.
- [ ] **Name the complexity we already handle**, concretely, in the pitch:
      nest relocation with a preserved original location, excavation counts
      superseding emergence logs, per-beach survey areas, volunteer records
      that save immediately and get confirmed after.
- [ ] **State plainly what we don't handle**, and that we won't try to. A
      pitch that claims to cover everything is the one that fails at month
      six.

## 3. Key-person and technology risk

> "We're cautious about becoming dependent on a service that is hosted
> elsewhere and built in technologies that current project staff may not have
> the expertise to maintain themselves … Even when a developer is available
> and committed to supporting a system, circumstances can change over time."

The single strongest objection, and the one we currently answer worst. Today
the app is a GitHub Pages frontend talking to one Render instance and one Neon
database, all under a personal account. If I stop, it stops.

- [x] Source is on GitHub under a licence (both repos).
- [ ] **Self-host path, documented and tested.** `docker compose up` bringing
      up backend + Postgres + frontend, verified from a clean machine by
      following only the README. Until this exists, "you can host it
      yourself" is not a true claim.
- [ ] **No personal-account dependencies in the deployment story.** Hosting,
      domain and database must be transferable to an organisation account
      without a rebuild.
- [ ] **Operational runbook** a non-specialist can follow: restore a backup,
      add a user, rotate a key, read the logs, what to do when the API is
      down.
- [ ] **Stated bus-factor answer** in the README: what happens if the
      maintainer disappears — what still runs, what stops, what the project
      does next. Better an honest answer than an implied "I'll always be
      here".
- [ ] **Boring, replaceable stack claim**, honestly framed: Postgres +
      Node/Express + React are common enough that a contractor can be hired.
      Note the exceptions (Gemini AI features) as optional and disableable.
- [ ] **AI features must be switchable off** without breaking anything — they
      are the part most likely to be seen as an unmaintainable external
      dependency.

## 4. Field device logistics

> "The use of personal phones or a limited number of project devices can
> become challenging when multiple inventories, relocations, or other
> activities are taking place simultaneously."

This is an operational objection, and partly a real gap in the current build.

- [x] Offline-first: surveys and writes queue on the device and replay when
      the connection returns (`offlineSurveyQueue`, `offlineWriteQueue`,
      `offlineCache`).
- [ ] **Shared-device handling.** The offline write queue is stored under a
      single global `localStorage` key
      (`turtle-frontend/lib/offlineWriteQueue.ts`), not scoped per user. On a
      shared project phone where one volunteer logs out and another logs in,
      pending writes replay under the wrong account. Must be namespaced per
      user, with a visible "N unsent records" warning that blocks a clean
      logout.
- [ ] **Concurrent activity on one device.** Several inventories or
      relocations in progress at once needs parallel drafts, not one draft
      slot per form — verify `surveyDraft` and the entry screens against a
      "two nests being excavated simultaneously, one phone" scenario.
- [ ] **Fast handover.** Switching user on a shared device should take
      seconds, not a full login round-trip to a sleeping backend.
- [ ] **Paper fallback that isn't a downgrade.** A printable field sheet
      matching the app's fields, plus fast batch entry afterwards, so a dead
      battery is an inconvenience and not a lost night.
- [ ] **Honest device requirements** stated up front: how many devices, what
      minimum spec, what battery cost per patrol.

## 5. Lock-in and exit

> "Our concern is that the project would gradually need to adapt to the
> software, rather than the software adapting to the project, and that at some
> point in the future we could find ourselves having to transition back to our
> existing systems and manage a complicated data migration process."

The cheapest objection to answer completely, and the highest leverage. A
project that knows it can leave in one click does not need to trust us.

- [x] Per-screen CSV export exists (nests, emergences, turtles, volunteer
      hours, season report) in `turtle-frontend/screens/Records.tsx`,
      `TimeTable.tsx`, `SeasonReport.tsx`.
- [x] CSV import with a downloadable template (`DataImport.tsx`,
      `lib/csvImport.ts`).
- [ ] **One-click full export of everything**, including photos and audit
      history — not per-screen, per-tab exports. A single archive a
      coordinator can download unprompted, any day, without asking me.
- [ ] **Export in *their* Excel shape.** Configurable column mapping so the
      export drops into the sheet they already use, rather than a shape we
      chose. This is what turns "migration project" into "paste".
- [ ] **Scheduled automatic export** to a location they control (their own
      Drive/email), so a copy of the data exists outside our hosting without
      anyone remembering to do it.
- [ ] **Documented exit procedure**, written for the day they leave: get your
      data, get your photos, here is the schema, here is how to load it into
      Excel/Postgres. Ship this *before* asking anyone to trial the app.
- [ ] **Round-trip test in CI**: export a full dataset, reimport it into a
      clean instance, assert nothing is lost. An export that has never been
      reimported is a promise, not a feature.
- [ ] **Configuration over code for project-specific rules** — beaches,
      species, nest codes, season boundaries, required fields, survey areas —
      so adapting to a project doesn't mean a release. Partly in place
      (`SiteManagement`, `ProjectSettings`, `fieldRequirements`); audit for
      anything a project would need us to change.

---

## Pitch order, next organisation

1. Exit first. Lead with the full export, the exit document and the
   round-trip test. Trust is bought by showing the door, not the features.
2. Self-host second. `docker compose up` on their own machine, no accounts of
   mine involved.
3. One workflow third. Solve one named pain, feeding their existing Excel.
4. Everything else only if they ask.

## What we do not have to fix

Wildlife Sense are deeply Excel-entrenched, control-conscious, and have
already been approached repeatedly. They were a hard sell on structural
grounds, not on merit. The checklist above is aimed at the *next*
organisation — a newer or smaller project whose Excel pain is still fresh —
and Chanel's reply is the best free requirements document we're going to get.
