# Install Cortex Sense Studio (instructions for Cortex Code or another agent)

Do these steps in order. Run each check. Stop at each STOP and ask the user.
Do not skip a STOP. Do not run a GRANT the user has not approved.

## 0. Inputs

Ask the user for these values. Propose the default in brackets.

| Name | Meaning | Default |
|---|---|---|
| `CONN` | Snowflake CLI connection | the CLI default |
| `APP_DB` | Existing database for the app | none (required) |
| `APP_SCHEMA` | New schema in `APP_DB` | `CORTEX_SENSE_STUDIO` |
| `OWNER_ROLE` | Role that owns and runs the app | `CORTEX_SENSE_STUDIO_OWNER` |
| `WH` | Warehouse for queries | none (required) |
| `POOL` | Compute pool for the container runtime | `CORTEX_SENSE_STUDIO_POOL` |

All names must be plain identifiers (letters, digits, `_`).

## 1. Check the tools

```bash
snow --version && snow connection test -c "$CONN"
```

Stop if `snow` is missing. Node is not needed. The built bundle `ui/sl_ui.js` is in the repo.

## 2. Check Cortex Sense is available

```sql
SELECT SYSTEM$CORTEX_AGENT_CORTEX_CONTEXT_BUILDER('{"action":"list-contexts"}');
```

If this fails, Cortex Sense is not enabled for the account or role. Tell the user and stop.
If it returns `count: 0`, there is no context to show. Tell the user. The app still installs.

## 3. Account setup

Read `setup.sql`. Replace the five `SET` values at the top with the inputs.
Show the user the final SQL.

**STOP.** It creates a schema and a compute pool (the pool costs credits while it runs),
and grants roles. Ask: "Run this as ACCOUNTADMIN?" Run it only after a yes.

```bash
snow sql -c "$CONN" -f setup.sql
```

Check: `SHOW COMPUTE POOLS LIKE '<POOL>'` returns one row.

## 4. Let the app see a context

Ask which Cortex Sense context to show. Then show the user these statements and ask first.

```sql
GRANT USAGE ON CORTEX SENSE <db>.<schema>."<CONTEXT_NAME>" TO ROLE <OWNER_ROLE>;
-- For the Coverage tab, also grant USAGE on each database and schema in the context's scope.
```

## 5. Deploy

Use a connection whose role is `OWNER_ROLE` (or pass `-r <OWNER_ROLE>`).

```bash
bash deploy.sh . <APP_DB>.<APP_SCHEMA>.CORTEX_SENSE_STUDIO \
  --warehouse <WH> --container --pool <POOL> -c "$CONN" -r <OWNER_ROLE> -t "Cortex Sense Studio"
```

Check: the last line says `deployed ...`, and the script reports every file as `match`.

## 6. Verify

Tell the user to open Snowsight, Projects, Streamlit, "Cortex Sense Studio".
The first start installs packages and takes a few minutes.
Expected: a welcome page with one card per context the owner role can use.
If the page lists no context, repeat step 4. If it shows an error, read it: it names the missing privilege.

## 7. Share (optional)

**STOP.** Ask which roles may open the app. The app runs with the OWNER's rights, so
every viewer sees what `OWNER_ROLE` can see.

```sql
GRANT USAGE ON STREAMLIT <APP_DB>.<APP_SCHEMA>.CORTEX_SENSE_STUDIO TO ROLE <viewer_role>;
```

## Remove

```sql
DROP STREAMLIT <APP_DB>.<APP_SCHEMA>.CORTEX_SENSE_STUDIO;
DROP COMPUTE POOL <POOL>;   -- stops the cost
```
