# Cortex Sense Domain Studio (React in Streamlit in Snowflake)

A visual view of what a Cortex Sense context holds.
Python keeps the Snowflake session, the Sense calls and all checks. The UI is a React
bundle (`frontend/` builds `ui/sl_ui.js`).

All text comes from Cortex Sense without change. The app is read-only: it writes
nothing to Snowflake.

## Tabs

| Tab | Shows | Complete? |
|---|---|---|
| Overview | The context at a glance: last build, refresh, and one card per scope source (tables, semantic views, dashboards, query history, ontology) | Complete |
| Coverage | A clickable map from the context to its schemas. Click a schema, then an object, to open its stored Sense profile | Complete for objects in scope |
| Search explorer | The exact documents Sense returns for a question: a result list with type filters, and the full document beside it | Search-only |
| Knowledge graph | Ontology entities, metrics and relationships. Click a node to center on it | Search-only |
| Lineage | Upstream, downstream or both (Snowflake lineage). Click an object to center on it | Complete, if the role has VIEW LINEAGE |

**Search-only** means the tab shows what Sense returns for the search terms. Sense has no
API that lists every document.

## Requirements

- **Container runtime.** The warehouse runtime does not work: Snowflake rejects the Sense
  functions inside owner's-rights procedures.
- A compute pool, and a warehouse for queries.
- The app owner role needs:
  - USAGE on each Cortex Sense context to show
  - USAGE on the source databases and schemas (for Coverage)
  - VIEW LINEAGE on the account (optional, for Lineage)
- The app runs with the **owner's** rights. Every viewer sees what the owner role can see.

## Run locally

```bash
cd frontend && npm ci && npm run build && cd ..
SNOWFLAKE_DEFAULT_CONNECTION_NAME=<connection> STUDIO_WAREHOUSE=<warehouse> \
  streamlit run streamlit_app.py --browser.gatherUsageStats false
```

## Test

```bash
cd frontend && npm test                       # bundle, bridge and static checks
python -m pytest tests -q                     # bridge, parallel jobs, deploy, dependencies
APP_URL=http://localhost:8501 CHROME="<path to Chrome>" npm run smoke
```

## Deploy

1. Run `setup.sql` once as ACCOUNTADMIN. Edit the names at the top first. It creates the
   app schema and compute pool, and grants the app owner role what it needs.
2. Deploy. You need the [Snowflake CLI](https://docs.snowflake.com/en/developer-guide/snowflake-cli/index)
   and a connection that uses the app owner role. Node is not needed: the built bundle
   `ui/sl_ui.js` is in the repo.

```bash
bash deploy.sh . <DB.SCHEMA.APP> --warehouse <WH> --container --pool <POOL> -c <connection>
```

`deploy.sh` uploads only the files in `deploy.manifest`, and then checks that the live
files match the local files byte for byte.

3. Open the app in Snowsight (Projects › Streamlit). The first start installs packages
   and takes a few minutes.

## Change the UI

The React source is in `frontend/src` (`index.tsx` holds the views, `ui.tsx` the styles and
shared pieces, `kit.tsx` the bridge to Python). After a change, rebuild the bundle with
`cd frontend && npm ci && npm run build`, and commit `ui/sl_ui.js` with the source.

## Repository layout

| Path | What it is |
|---|---|
| `streamlit_app.py` | The app: Cortex Sense calls, checks on every request, background jobs |
| `react_bridge.py` | The browser ↔ Python channel and the background-job runner |
| `ui/sl_ui.js` | The built React bundle (deployed) |
| `frontend/` | React source, build script, tests and the browser smoke test |
| `tests/` | Python tests |
| `setup.sql` | One-time account setup |
| `deploy.sh`, `deploy.manifest` | Deploy script and the exact list of files it uploads |
| `pyproject.toml`, `environment.yml` | Python dependencies |
