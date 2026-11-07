# Security

Report a vulnerability in private. Do not open a public issue. Use GitHub's "Report a vulnerability" button on
the Security tab of this repository.

What the app does to stay safe:

- Every browser request goes through an allow-list of actions in `streamlit_app.py`.
- Names that reach SQL are checked and quoted. Values are bound with `?`.
- Errors shown in the browser are cut to one line. Server-side details stay in the app log.
- The app is read-only and runs with the owner role's rights. Give that role only what the app must show.
