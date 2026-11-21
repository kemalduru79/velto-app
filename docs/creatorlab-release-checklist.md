# CreatorLab Release Checklist

This checklist validates the CreatorLab flow without triggering paid media unless the tester explicitly chooses to do so.

## Automated smoke check

Run the application first:

```bash
npm run dev
```

In another terminal:

```bash
npm run test:creator-smoke
```

The unauthenticated mode verifies the `/create` route and authentication guards. To verify authenticated operational endpoints, supply a valid Supabase access token:

```bash
CREATOR_ACCESS_TOKEN="<token>" npm run test:creator-smoke
```

For a deployed environment:

```bash
CREATOR_BASE_URL="https://your-domain.example" CREATOR_ACCESS_TOKEN="<token>" npm run test:creator-smoke
```

## Manual end-to-end release matrix

1. **Authentication and isolation**
   - Sign in and open CreatorLab.
   - Confirm Storyverse remains unchanged.
   - Confirm Projects and Creator Director drawers restore keyboard focus when closed.

2. **Brief**
   - Enter a topic, format, duration, quality level, and target platforms.
   - Reload the page and confirm the local draft is restored.
   - Confirm no paid media is generated in Draft mode.

3. **Strategy**
   - Generate mentor analysis.
   - Approve one direction and one hook.
   - Confirm the production package uses the approved direction.

4. **Production**
   - Open Script, Visual, and Audio tabs for multiple scenes.
   - Change one scene to Image and one eligible scene to Video.
   - Verify bulk selection only generates missing assets.
   - Restore an older visual and confirm incompatible video output is cleared.
   - Use Undo for a reversible scene change.

5. **Creator Director**
   - Request a brief, strategy, scene, and thumbnail change.
   - Confirm each action shows a before/after preview.
   - Confirm project changes require Apply.
   - Confirm paid media and export require a second explicit confirmation.
   - Confirm no credit-consuming operation runs from a plain chat response.

6. **Publish and export**
   - Select a thumbnail in the primary release area.
   - Open Thumbnail Studio and adjust overlay copy and crop.
   - Complete system checks and user confirmations.
   - Export the Creator Package.
   - Verify the ZIP includes final video or fallback link, composed thumbnail, clean thumbnail source, publishing copy, captions, project JSON, manifest, and README.

7. **Responsive and accessibility**
   - Test at desktop, tablet, and mobile widths.
   - Navigate Creator Director with keyboard only.
   - Confirm Tab focus is trapped inside open dialogs.
   - Confirm Escape closes the drawer and returns focus to its trigger.
   - Check reduced-motion and high-contrast operating-system settings.

8. **Operational readiness**
   - Open Projects & Readiness.
   - Expand Operational readiness.
   - Confirm database and AI are configured.
   - Confirm voice and premium video reflect the environment accurately.
   - Run the check again and record the request ID when reporting an incident.

## Release gate

Do not open paid credit packages until FIN-P1 verifies provider pricing, reservation and settlement, refunds, immutable cost ledger, idempotency, queue concurrency, provider rate limits, load tests, and invoice reconciliation.
