# Contributing

Open an issue before a large change. Then:

1. `cd frontend && npm ci && npm run build` - rebuild `ui/sl_ui.js`. Commit it with the source.
2. `npm test` and `python -m pytest tests -q` must pass.
3. For a UI change, run the browser smoke test (see README, "Test") against a running app.

Do not commit customer names, account identifiers, connection names or screenshots with real names.
