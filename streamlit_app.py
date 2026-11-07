"""Cortex Sense Domain Studio — React in Streamlit in Snowflake.

Python keeps the Snowflake session, the Cortex Sense calls and all validation; the UI
is a React bundle (frontend/ -> ui/sl_ui.js). Every document the UI shows comes
verbatim from Cortex Sense (SYSTEM$CORTEX_AGENT_CORTEX_CONTEXT / _BUILDER). The app
is read-only: it never calls a write action on a context and writes nothing to Snowflake.

Runs on the container runtime only: the warehouse runtime executes as an owner's-rights
stored procedure, and Snowflake rejects the Sense system functions there.

Run locally:
    SNOWFLAKE_DEFAULT_CONNECTION_NAME=<conn> STUDIO_WAREHOUSE=<warehouse> \
        streamlit run streamlit_app.py --browser.gatherUsageStats false
"""
from __future__ import annotations

import base64
import json
import os
import re

import streamlit as st
import yaml

from react_bridge import (BadRequest, bridge_request, bridge_responses, handle, int_between,
                          load_bundle, one_of, parallel_job, render_island)

st.set_page_config(page_title="Cortex Sense Domain Studio", layout="wide")
# Streamlit fades the page while a rerun runs; every poll is a rerun, so keep it at full strength.
st.html("<style>[data-stale=true],.stElementContainer{opacity:1!important;transition:none!important}"
        "[data-testid=stMainBlockContainer]{max-width:1480px;padding-top:4.5rem}</style>")
load_bundle()              # first: the bundle (sent once per session)
req = bridge_request()     # then the hidden request channel

IDENT = re.compile(r'^("[^"]{1,255}"|[A-Za-z_][A-Za-z0-9_$]{0,254})$')
DOC_TYPES = ("table_entity", "ontology_node", "datamart", "qbe")
LOOKUP_BATCH = 5           # larger batches get truncated by the service's result budget
SENSE_SQL = "SELECT SYSTEM$CORTEX_AGENT_CORTEX_CONTEXT(?) AS R"
BUILDER_SQL = "SELECT SYSTEM$CORTEX_AGENT_CORTEX_CONTEXT_BUILDER(?) AS R"
REL = re.compile(r"^(.+?) --(\w+)--> (.+?)(?: \(.*)?$")
NODE = re.compile(r"^(.+?) \((entity|concept)[^)]*\)")


# --------------------------------------------------------------------------- session
@st.cache_resource(show_spinner=False)
def _local_session():
    s = st.connection("snowflake").session()
    if os.environ.get("STUDIO_WAREHOUSE"):       # local runs only; in Snowflake the app's QUERY_WAREHOUSE applies
        s.use_warehouse(ident(os.environ["STUDIO_WAREHOUSE"], "warehouse"))
    return s


def session():
    try:
        from snowflake.snowpark.context import get_active_session
        return get_active_session()         # in Snowflake
    except Exception:
        return _local_session()             # on your machine


# --------------------------------------------------------------------------- Sense calls
def _parse(raw) -> dict:
    out = json.loads(raw) if raw else {}
    return out.get("response_structured", out)


def builder(action: str, **params) -> dict:
    payload = {"action": action, **({"parameters": params} if params else {})}
    row = session().sql(BUILDER_SQL, params=[json.dumps(payload)]).collect()[0]
    return _parse(row[0])


def docs_of(raw) -> list:
    return _parse(raw).get("documents") or []


def doc_text(d: dict) -> str:
    return d.get("markdown") or d.get("cam_content") or ""


def first_line(d: dict) -> str:
    t = doc_text(d).strip()
    return t.splitlines()[0] if t else ""


@st.cache_data(ttl=300, show_spinner=False)
def list_contexts() -> list:
    out = []
    for c in builder("list-contexts").get("cortex_contexts", []) or []:
        out.append({"key": f"{c['database_name']}.{c['schema_name']}.{c['name']}", "id": int(c["id"]),
                    "db": c["database_name"], "schema": c["schema_name"], "name": c["name"],
                    "description": c.get("description") or "", "last_processed_at": c.get("last_processed_at"),
                    "target_lag": c.get("target_lag")})
    return sorted(out, key=lambda c: c["key"])


@st.cache_data(ttl=300, show_spinner=False)
def get_scope(db: str, schema: str, name: str) -> dict:
    try:
        res = builder("get-stage-file", name=name, database_name=db, schema_name=schema, path="scope.yaml")
    except Exception as e:  # noqa: BLE001 - the message is the server's, shown as-is
        return {"error": str(e)}
    content = res.get("content") or ""
    if re.fullmatch(r"[A-Za-z0-9+/\n]+=*", content or "x="):
        try:
            content = base64.b64decode(content).decode("utf-8")
        except Exception:  # noqa: BLE001 - plain text that happened to look like base64
            pass
    try:
        return {"scope": yaml.safe_load(content) or {}, "raw": content}
    except yaml.YAMLError as e:
        return {"error": f"scope.yaml did not parse: {e}", "raw": content}


def scope_rules(scope: dict, source: str) -> list:
    for s in scope.get("sources", []) or []:
        if s.get("name") == source and s.get("enabled", True):
            return s.get("rules", []) or []
    return []


# --------------------------------------------------------------------------- validation
def ctx_of(payload: dict) -> dict:
    key = payload.get("ctx")
    for c in list_contexts():
        if c["key"] == key:
            return c
    raise BadRequest("Pick a context the app can see.")


def ident(value, what: str) -> str:
    if not isinstance(value, str) or not IDENT.match(value.strip()):
        raise BadRequest(f"Enter a valid {what} name.")
    return value.strip()


def fqn(value) -> str:
    parts = value.split(".") if isinstance(value, str) else []
    if len(parts) != 3 or not all(IDENT.match(p) for p in parts):
        raise BadRequest("Enter a fully-qualified name like DB.SCHEMA.TABLE.")
    return value


def text(payload: dict, key: str, cap: int, required: bool = False) -> str:
    v = payload.get(key, "")
    if not isinstance(v, str) or len(v) > cap or (required and not v.strip()):
        raise BadRequest(f"Check the {key.replace('_', ' ')} field (up to {cap} characters).")
    return v.strip()


# --------------------------------------------------------------------------- handlers
def h_overview(p: dict):
    c = ctx_of(p)
    sc = get_scope(c["db"], c["schema"], c["name"])
    scope = sc.get("scope") or {}
    sources = []
    for s_ in scope.get("sources", []) or []:
        rules = []
        for r in s_.get("rules") or []:
            rules.append({"rule": r.get("pattern") or r.get("domain") or r.get("stage") or "",
                          "kind": r.get("type", ""), "note": r.get("user_prompt", ""),
                          "est": r.get("est_tables"), "nodes": r.get("node_count"),
                          "rels": r.get("relationship_count")})
        sources.append({"name": s_.get("name"), "type": s_.get("type"), "enabled": s_.get("enabled", True),
                        "rules": rules})
    return {"sources": sources, "raw": sc.get("raw"), "error": sc.get("error"),
            "version": scope.get("version_id"), "updated": scope.get("updated_at"),
            "created": scope.get("created_at"), "instructions": scope.get("additional_instructions") or []}


def h_coverage(p: dict):
    """Two parallel stages: expand scope patterns, then ask Sense about every object."""
    c = ctx_of(p)
    scope = get_scope(c["db"], c["schema"], c["name"]).get("scope")
    if not scope:
        raise BadRequest("The scope could not be read, so there is nothing to check.")
    patterns = [r["pattern"] for src in ("catalog_objects", "semantic_views")
                for r in scope_rules(scope, src) if r.get("pattern")]
    exact, schemas, errors = set(), [], []
    for pat in patterns:
        parts = pat.split(".")
        if len(parts) != 3 or not all(IDENT.match(x) for x in parts[:2]):
            errors.append(f"{pat}: unrecognised pattern")
        elif parts[2] == "*":
            schemas.append((parts[0], parts[1]))
        elif IDENT.match(parts[2]):
            exact.add(pat)
    schemas = sorted(set(schemas))

    def after_show(frames):
        objs = set(exact)
        for (db, sch), f in zip(schemas, frames):
            if isinstance(f, Exception):
                errors.append(f"{db}.{sch}: {str(f).splitlines()[-1][:200]}")
                continue
            f.columns = [x.lower() for x in f.columns]
            objs |= {f"{db}.{sch}.{n}" for n in f.get("name", [])}
        objs = sorted(objs)
        batches = [objs[i:i + LOOKUP_BATCH] for i in range(0, len(objs), LOOKUP_BATCH)]
        stmts = [(SENSE_SQL, [json.dumps({"request_structured": {
            "fully_qualified_names": b, "cortex_context_ids": [c["id"]], "max_results": len(b) * 2,
            "results_per_type": {"table_entity": len(b), "qbe": 0, "ontology_node": 0, "datamart": 0}}})])
            for b in batches]

        def after_lookup(frames2):
            found = {}
            for f in frames2:
                if isinstance(f, Exception):
                    errors.append(f"Sense lookup: {str(f).splitlines()[-1][:200]}")
                    continue
                for d in docs_of(f.iloc[0, 0]):
                    if d.get("doc_type") == "table_entity":
                        found[(d.get("entity_key") or "").upper()] = doc_text(d)
            rows = [{"fqn": o, "schema": o.rsplit(".", 1)[0], "profiled": o.upper() in found} for o in objs]
            return {"objects": rows, "profiles": {o: found[o.upper()] for o in objs if o.upper() in found},
                    "errors": errors}

        if not stmts:
            return after_lookup([])
        return parallel_job(session(), stmts, after_lookup, key=f"cov2:{c['id']}")

    stmts = [("SHOW OBJECTS IN SCHEMA IDENTIFIER(?)", [f"{db}.{sch}"]) for db, sch in schemas]
    return parallel_job(session(), stmts, after_show, key=f"cov1:{c['id']}")


def h_search(p: dict):
    c = ctx_of(p)
    q = text(p, "query", 300, required=True)
    n = int_between(p, "max", 5, 50, 20)
    payload = json.dumps({"request_structured": {"query": q, "cortex_context_ids": [c["id"]], "max_results": n}})

    def post(frames):
        if isinstance(frames[0], Exception):
            return {"error": str(frames[0]).splitlines()[-1][:300], "docs": []}
        out = []
        for d in docs_of(frames[0].iloc[0, 0]):
            out.append({"type": d.get("doc_type"), "key": d.get("entity_key") or d.get("id"),
                        "title": first_line(d)[:160], "text": doc_text(d),
                        "sources": json.dumps(d.get("sources"))[:600] if d.get("sources") else ""})
        return {"docs": out}
    return parallel_job(session(), [(SENSE_SQL, [payload])], post, key="search")


def h_ontology(p: dict):
    c = ctx_of(p)
    terms = p.get("terms")
    if not isinstance(terms, list) or not 1 <= len(terms) <= 30 or \
            any(not isinstance(t, str) or not t.strip() or len(t) > 80 for t in terms):
        raise BadRequest("Give 1 to 30 search terms of up to 80 characters.")
    terms = sorted({t.strip() for t in terms})
    stmts = [(SENSE_SQL, [json.dumps({"request_structured": {
        "query": t, "cortex_context_ids": [c["id"]], "max_results": 50,
        "results_per_type": {"ontology_node": 40, "table_entity": 0, "qbe": 0, "datamart": 0}}})])
        for t in terms]

    def post(frames):
        nodes, edges, failed = {}, set(), 0
        for f in frames:
            if isinstance(f, Exception):
                failed += 1
                continue
            for d in docs_of(f.iloc[0, 0]):
                if d.get("doc_type") != "ontology_node":
                    continue
                line = first_line(d)
                m = REL.match(line)
                if m:
                    edges.add((m.group(1).strip(), m.group(2), m.group(3).strip()))
                    continue
                m = NODE.match(line)
                if m:
                    nodes[m.group(1).strip()] = {"kind": m.group(2), "text": doc_text(d)}
        expected = sum(r.get("node_count", 0) for r in scope_rules(
            get_scope(c["db"], c["schema"], c["name"]).get("scope") or {}, "business_ontology"))
        return {"nodes": nodes, "edges": sorted(list(e) for e in edges), "failed": failed, "expected": expected}
    return parallel_job(session(), stmts, post, key=f"onto:{c['id']}")


def h_lineage(p: dict):
    target = fqn(p.get("target"))
    direction = one_of(p, "direction", ["UPSTREAM", "DOWNSTREAM", "BOTH"], "UPSTREAM")
    distance = int_between(p, "distance", 1, 5, 3)
    # GET_LINEAGE takes one direction; "both" runs upstream and downstream side by side.
    dirs = ["UPSTREAM", "DOWNSTREAM"] if direction == "BOTH" else [direction]
    sql = "SELECT * FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE(?, 'TABLE', ?, ?))"

    def post(frames):
        edges, errors = set(), []
        for d, df in zip(dirs, frames):
            if isinstance(df, Exception):
                msg = str(df)
                errors.append("The app owner role needs VIEW LINEAGE: GRANT VIEW LINEAGE ON ACCOUNT TO ROLE "
                              "<app_owner_role>;" if "privilege" in msg.lower() else msg.splitlines()[-1][:300])
                continue
            for _, r in df.iterrows():
                full = lambda pre: ".".join(str(r[f"{pre}_OBJECT_{x}"]) for x in ("DATABASE", "SCHEMA", "NAME"))
                edges.add((full("SOURCE"), full("TARGET"), int(r["DISTANCE"]), d.lower(),
                           str(r.get("SOURCE_OBJECT_DOMAIN", "")), str(r.get("TARGET_OBJECT_DOMAIN", ""))))
        if errors and not edges:
            return {"error": errors[0]}
        return {"edges": [list(e) for e in sorted(edges)], "errors": errors}
    return parallel_job(session(), [(sql, [target, d, distance]) for d in dirs], post, key="lineage")


handle(req, {
    "overview": h_overview, "coverage": h_coverage, "search": h_search, "ontology": h_ontology,
    "lineage": h_lineage,
})


def first_name() -> str:
    try:
        return (st.user.email or "").split("@")[0].split(".")[0].title()
    except Exception:
        return ""


try:
    contexts, ctx_error = list_contexts(), None
except Exception as e:  # noqa: BLE001
    contexts, ctx_error = [], str(e).splitlines()[-1][:300]

render_island("App", {"user": first_name(), "contexts": contexts, "ctxError": ctx_error,
                      "responses": bridge_responses()}, key="app")
