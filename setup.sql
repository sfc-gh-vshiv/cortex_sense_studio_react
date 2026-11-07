-- Cortex Sense Studio: one-time account setup.
-- Edit the names below (MY_DB, MY_WH and the role are placeholders), then run as ACCOUNTADMIN (or a role with these privileges).
-- After this, deploy the app with deploy.sh (see README.md).

SET APP_DB       = 'MY_DB';                                          -- database for the app
SET APP_SCHEMA   = 'MY_DB.CORTEX_SENSE_STUDIO';                      -- schema for the app (keep it apart from the Sense schema)
SET APP_ROLE     = 'CORTEX_SENSE_STUDIO_OWNER';                      -- role that owns and deploys the app
SET QUERY_WH     = 'MY_WH';                                          -- warehouse for the app's queries
SET COMPUTE_POOL = 'CORTEX_SENSE_STUDIO_POOL';                        -- compute pool for the container runtime

USE ROLE ACCOUNTADMIN;

-- 1. The owner role and the app's schema.
CREATE ROLE IF NOT EXISTS IDENTIFIER($APP_ROLE) COMMENT = 'Owns and runs Cortex Sense Studio';
CREATE SCHEMA IF NOT EXISTS IDENTIFIER($APP_SCHEMA) COMMENT = 'Cortex Sense Studio';
GRANT USAGE ON DATABASE IDENTIFIER($APP_DB) TO ROLE IDENTIFIER($APP_ROLE);
GRANT USAGE, CREATE STAGE, CREATE STREAMLIT ON SCHEMA IDENTIFIER($APP_SCHEMA) TO ROLE IDENTIFIER($APP_ROLE);

-- 2. Container runtime: a compute pool, and the PyPI repository for the app's packages.
--    The warehouse runtime does not work: Snowflake rejects the Sense functions in
--    owner's-rights procedures.
CREATE COMPUTE POOL IF NOT EXISTS IDENTIFIER($COMPUTE_POOL)
  MIN_NODES = 1 MAX_NODES = 1 INSTANCE_FAMILY = CPU_X64_XS
  AUTO_SUSPEND_SECS = 3600 AUTO_RESUME = TRUE
  COMMENT = 'Cortex Sense Studio';
GRANT USAGE ON COMPUTE POOL IDENTIFIER($COMPUTE_POOL) TO ROLE IDENTIFIER($APP_ROLE);
GRANT DATABASE ROLE SNOWFLAKE.PYPI_REPOSITORY_USER TO ROLE IDENTIFIER($APP_ROLE);
GRANT USAGE ON WAREHOUSE IDENTIFIER($QUERY_WH) TO ROLE IDENTIFIER($APP_ROLE);

-- 3. What the app can show. It runs with the OWNER role's rights, so every viewer sees
--    what this role can see.
--    a) USAGE on each Cortex Sense context (a role that built the context already has it):
-- GRANT USAGE ON CORTEX SENSE <db>.<schema>."<CONTEXT_NAME>" TO ROLE CORTEX_SENSE_STUDIO_OWNER;
--    b) USAGE on the databases and schemas in each context's scope (for the Coverage tab).
--    c) Optional, for the Lineage tab:
GRANT VIEW LINEAGE ON ACCOUNT TO ROLE IDENTIFIER($APP_ROLE);

GRANT ROLE IDENTIFIER($APP_ROLE) TO ROLE SYSADMIN;

-- 4. After deploying, share the app with other roles (optional):
-- GRANT USAGE ON STREAMLIT MY_DB.CORTEX_SENSE_STUDIO.CORTEX_SENSE_STUDIO TO ROLE <viewer_role>;
