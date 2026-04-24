--
-- PostgreSQL database cluster dump
--

-- Started on 2026-03-10 00:41:57

\restrict iq2QdLdjLIw6x31hbfiwEDkIwSGr4amx1buj2U7wFCe2D3n7dD2T5mmHbRDDPoU

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:52nnpo2vO77ua3s9fbOE6A==$tOO/i0m4axEbI7xYBNh/RfXbV4qRg582wHHHMN9LWr8=:hIdY+rg47QmQocXZeh2mOlJq9HSalOqFCrJmGBk/ltM=';
CREATE ROLE cli_login_postgres;
ALTER ROLE cli_login_postgres WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:iCV3deMteEEfnhmDHXYBQA==$FypwrqEqRdGbwNjB4AAVDYtoNu+PWpdprHmwSwD1cws=:DgeR5GlmKH8AEETtE+SOB3ihEhSxViFMCbYSCR37YDo=' VALID UNTIL '2026-03-09 16:44:38.670685+00';
CREATE ROLE dashboard_user;
ALTER ROLE dashboard_user WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE pgbouncer;
ALTER ROLE pgbouncer WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Kg1gqq1uXB7ZCdxRJFTJew==$QFSHvTNckE++cFb7y4evs/qUyTwiMUHu3v+qhoru3vU=:8yPvvEVUKBSowsDYoL71vmdeyqrMQFZ6DmUqQSMPGa0=';
CREATE ROLE postgres;
ALTER ROLE postgres WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:fR8RCMcHa3l9ri9HZCyASQ==$G6wifUXhqbNY+owRTv1Lh1DyRhfKj/nUVgLbR6Wj4HY=:xTMMSj/yP+sbasbNniGLkY2BKvThTI38N31HarI49AQ=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:LzjgC1TwJMvX9NRrWhr96A==$SARHZBo1raEEywBHh0aicMTUdAGhy3ixFBLz+7598ZU=:VgMhdv03tdh4P4JHBCo6lLrLiFs7r8qDCDX946x69ss=';
CREATE ROLE supabase_auth_admin;
ALTER ROLE supabase_auth_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:oB0QWM28+cjm5KX68aUTLQ==$xNTzMYtyPoJqe6kf8++hITbI3xYGZ/VvZEQwMA+z6X4=:K1TV93ZY4gMb+J5EOAUxj+q8DIY2fTkGkeULSNenMP8=';
CREATE ROLE supabase_etl_admin;
ALTER ROLE supabase_etl_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ZaNbdjWPt8LbKROUFWE33g==$HbydcjE/nBYfAC4vvIdKSXVZuBvR95y4kVfYQQTaKtg=:rF0laN9co/WOtVF9Qq3cbNYD0BMpsAD7CQ/HpeEtTF8=';
CREATE ROLE supabase_read_only_user;
ALTER ROLE supabase_read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:1ycs1KKtDnCEnqZaJZKnpg==$5cUM6mYOQdUjPJMP63heF+KbJvLq07nConJxNObd7no=:gohbQLJl5fWIyVBmPqbDSefB604g2Q7jWIdeYLRyBVk=';
CREATE ROLE supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_replication_admin;
ALTER ROLE supabase_replication_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:EYrrWgPR1ph4stYYjGCgLQ==$hAvPXaeoCqCUhZioErcZX/GXdiMTTr5oTUHTkfJHs+k=:+CbgRfBTngDYmA1NrYSOBqZohV6hrwoYsX+DQq924+c=';
CREATE ROLE supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:B/CYrKQmYfXxMQR7+6LGYQ==$Y5Kmkgt6RzcUmx9EXSuLa6l3c6vG+j/+yeTihoHBrDY=:zcKFqmBVU045+fi5mbpqHrL0dLcb0X2fpO9lGOnzH9Q=';

--
-- User Configurations
--

--
-- User Config "anon"
--

ALTER ROLE anon SET statement_timeout TO '3s';

--
-- User Config "authenticated"
--

ALTER ROLE authenticated SET statement_timeout TO '8s';

--
-- User Config "authenticator"
--

ALTER ROLE authenticator SET session_preload_libraries TO 'safeupdate';
ALTER ROLE authenticator SET statement_timeout TO '8s';
ALTER ROLE authenticator SET lock_timeout TO '8s';

--
-- User Config "postgres"
--

ALTER ROLE postgres SET search_path TO E'\\$user', 'public', 'extensions';

--
-- User Config "supabase_admin"
--

ALTER ROLE supabase_admin SET search_path TO '$user', 'public', 'auth', 'extensions';
ALTER ROLE supabase_admin SET log_statement TO 'none';

--
-- User Config "supabase_auth_admin"
--

ALTER ROLE supabase_auth_admin SET search_path TO 'auth';
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout TO '60000';
ALTER ROLE supabase_auth_admin SET log_statement TO 'none';

--
-- User Config "supabase_read_only_user"
--

ALTER ROLE supabase_read_only_user SET default_transaction_read_only TO 'on';

--
-- User Config "supabase_storage_admin"
--

ALTER ROLE supabase_storage_admin SET search_path TO 'storage';
ALTER ROLE supabase_storage_admin SET log_statement TO 'none';


--
-- Role memberships
--

GRANT anon TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT anon TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticated TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT authenticated TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO supabase_storage_admin WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT pg_create_subscription TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_signal_backend TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT postgres TO cli_login_postgres WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_realtime_admin TO postgres WITH INHERIT TRUE GRANTED BY supabase_admin;






\unrestrict iq2QdLdjLIw6x31hbfiwEDkIwSGr4amx1buj2U7wFCe2D3n7dD2T5mmHbRDDPoU

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict B82snxtPgIFuktQtZx8ANaHaaorBrQy0tFVIEfp8cpq7qm9NGbQaQMO5A9fVZka

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

-- Started on 2026-03-10 00:41:59

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Completed on 2026-03-10 00:42:03

--
-- PostgreSQL database dump complete
--

\unrestrict B82snxtPgIFuktQtZx8ANaHaaorBrQy0tFVIEfp8cpq7qm9NGbQaQMO5A9fVZka

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict kWdb1IwmAeXKQck2US4iGabBSiZ4pcLPW6RFdV93f5eXKnrDaO7uQntdK01RgJo

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

-- Started on 2026-03-10 00:42:03

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 35 (class 2615 OID 16498)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- TOC entry 21 (class 2615 OID 16392)
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- TOC entry 33 (class 2615 OID 16578)
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- TOC entry 32 (class 2615 OID 16567)
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- TOC entry 11 (class 2615 OID 16390)
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- TOC entry 10 (class 2615 OID 16559)
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- TOC entry 36 (class 2615 OID 16546)
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- TOC entry 25 (class 2615 OID 17513)
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- TOC entry 30 (class 2615 OID 16607)
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- TOC entry 6 (class 3079 OID 16643)
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- TOC entry 4760 (class 0 OID 0)
-- Dependencies: 6
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- TOC entry 2 (class 3079 OID 16393)
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- TOC entry 4761 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- TOC entry 4 (class 3079 OID 16447)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- TOC entry 4762 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 5 (class 3079 OID 16608)
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- TOC entry 4763 (class 0 OID 0)
-- Dependencies: 5
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- TOC entry 3 (class 3079 OID 16436)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- TOC entry 4764 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 1116 (class 1247 OID 16738)
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- TOC entry 1140 (class 1247 OID 16879)
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- TOC entry 1113 (class 1247 OID 16732)
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- TOC entry 1110 (class 1247 OID 16727)
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1158 (class 1247 OID 16982)
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- TOC entry 1170 (class 1247 OID 17055)
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1152 (class 1247 OID 16960)
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1161 (class 1247 OID 16992)
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1146 (class 1247 OID 16921)
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- TOC entry 1236 (class 1247 OID 17524)
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- TOC entry 1191 (class 1247 OID 17168)
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- TOC entry 1182 (class 1247 OID 17128)
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- TOC entry 1185 (class 1247 OID 17143)
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- TOC entry 1197 (class 1247 OID 17210)
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- TOC entry 1194 (class 1247 OID 17181)
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- TOC entry 1215 (class 1247 OID 17343)
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- TOC entry 411 (class 1255 OID 16544)
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- TOC entry 4765 (class 0 OID 0)
-- Dependencies: 411
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- TOC entry 430 (class 1255 OID 16709)
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- TOC entry 410 (class 1255 OID 16543)
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- TOC entry 4768 (class 0 OID 0)
-- Dependencies: 410
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- TOC entry 409 (class 1255 OID 16542)
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- TOC entry 4770 (class 0 OID 0)
-- Dependencies: 409
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- TOC entry 412 (class 1255 OID 16551)
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- TOC entry 4786 (class 0 OID 0)
-- Dependencies: 412
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- TOC entry 416 (class 1255 OID 16572)
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- TOC entry 4788 (class 0 OID 0)
-- Dependencies: 416
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- TOC entry 413 (class 1255 OID 16553)
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- TOC entry 4790 (class 0 OID 0)
-- Dependencies: 413
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- TOC entry 414 (class 1255 OID 16563)
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- TOC entry 415 (class 1255 OID 16564)
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- TOC entry 417 (class 1255 OID 16574)
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- TOC entry 4819 (class 0 OID 0)
-- Dependencies: 417
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- TOC entry 359 (class 1255 OID 16391)
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- TOC entry 462 (class 1255 OID 17976)
-- Name: generate_tenant_api_key(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_tenant_api_key() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN 'tvk_' || encode(gen_random_bytes(32), 'hex');
END;
$$;


ALTER FUNCTION public.generate_tenant_api_key() OWNER TO postgres;

--
-- TOC entry 460 (class 1255 OID 17974)
-- Name: get_admin_tenant_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_admin_tenant_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin'
  LIMIT 1
$$;


ALTER FUNCTION public.get_admin_tenant_id(_user_id uuid) OWNER TO postgres;

--
-- TOC entry 461 (class 1255 OID 17975)
-- Name: get_tenant_wallet_balance(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END),
    0
  )
  FROM public.wallet_transactions wt
  JOIN public.profiles p ON p.user_id = wt.user_id
  WHERE p.tenant_id = _tenant_id
$$;


ALTER FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) OWNER TO postgres;

--
-- TOC entry 463 (class 1255 OID 17977)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- TOC entry 459 (class 1255 OID 17973)
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

--
-- TOC entry 431 (class 1255 OID 17120)
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- TOC entry 437 (class 1255 OID 17203)
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- TOC entry 458 (class 1255 OID 17468)
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- TOC entry 439 (class 1255 OID 17215)
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- TOC entry 435 (class 1255 OID 17165)
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- TOC entry 434 (class 1255 OID 17160)
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- TOC entry 438 (class 1255 OID 17211)
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- TOC entry 455 (class 1255 OID 17408)
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- TOC entry 433 (class 1255 OID 17159)
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- TOC entry 457 (class 1255 OID 17467)
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- TOC entry 432 (class 1255 OID 17157)
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- TOC entry 436 (class 1255 OID 17192)
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- TOC entry 456 (class 1255 OID 17461)
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- TOC entry 446 (class 1255 OID 17284)
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- TOC entry 449 (class 1255 OID 17340)
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- TOC entry 442 (class 1255 OID 17259)
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 441 (class 1255 OID 17258)
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 440 (class 1255 OID 17257)
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- TOC entry 450 (class 1255 OID 17396)
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- TOC entry 443 (class 1255 OID 17271)
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- TOC entry 447 (class 1255 OID 17323)
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- TOC entry 451 (class 1255 OID 17397)
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text) OWNER TO supabase_storage_admin;

--
-- TOC entry 448 (class 1255 OID 17339)
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- TOC entry 454 (class 1255 OID 17403)
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- TOC entry 444 (class 1255 OID 17273)
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- TOC entry 453 (class 1255 OID 17401)
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) OWNER TO supabase_storage_admin;

--
-- TOC entry 452 (class 1255 OID 17400)
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- TOC entry 445 (class 1255 OID 17274)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 279 (class 1259 OID 16529)
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- TOC entry 4855 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- TOC entry 299 (class 1259 OID 17078)
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- TOC entry 293 (class 1259 OID 16883)
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- TOC entry 4858 (class 0 OID 0)
-- Dependencies: 293
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- TOC entry 284 (class 1259 OID 16681)
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- TOC entry 4860 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- TOC entry 4861 (class 0 OID 0)
-- Dependencies: 284
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- TOC entry 278 (class 1259 OID 16522)
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- TOC entry 4863 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- TOC entry 288 (class 1259 OID 16770)
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- TOC entry 4865 (class 0 OID 0)
-- Dependencies: 288
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- TOC entry 287 (class 1259 OID 16758)
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- TOC entry 4867 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- TOC entry 286 (class 1259 OID 16745)
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- TOC entry 4869 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- TOC entry 4870 (class 0 OID 0)
-- Dependencies: 286
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- TOC entry 296 (class 1259 OID 16995)
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- TOC entry 298 (class 1259 OID 17068)
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- TOC entry 4873 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- TOC entry 295 (class 1259 OID 16965)
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- TOC entry 297 (class 1259 OID 17028)
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- TOC entry 294 (class 1259 OID 16933)
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- TOC entry 277 (class 1259 OID 16511)
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- TOC entry 4878 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- TOC entry 276 (class 1259 OID 16510)
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- TOC entry 4880 (class 0 OID 0)
-- Dependencies: 276
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- TOC entry 291 (class 1259 OID 16812)
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- TOC entry 4882 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- TOC entry 292 (class 1259 OID 16830)
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- TOC entry 4884 (class 0 OID 0)
-- Dependencies: 292
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- TOC entry 280 (class 1259 OID 16537)
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- TOC entry 4886 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- TOC entry 285 (class 1259 OID 16711)
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- TOC entry 4888 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- TOC entry 4889 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- TOC entry 4890 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- TOC entry 4891 (class 0 OID 0)
-- Dependencies: 285
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- TOC entry 290 (class 1259 OID 16797)
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- TOC entry 4893 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- TOC entry 289 (class 1259 OID 16788)
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- TOC entry 4895 (class 0 OID 0)
-- Dependencies: 289
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- TOC entry 4896 (class 0 OID 0)
-- Dependencies: 289
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- TOC entry 275 (class 1259 OID 16499)
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- TOC entry 4898 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- TOC entry 4899 (class 0 OID 0)
-- Dependencies: 275
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- TOC entry 338 (class 1259 OID 17898)
-- Name: airline_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.airline_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    airline_code text NOT NULL,
    airline_name text DEFAULT ''::text,
    cabin_baggage text DEFAULT '7 Kg'::text,
    checkin_baggage text DEFAULT '20 Kg'::text,
    cancellation_policy text DEFAULT ''::text,
    date_change_policy text DEFAULT ''::text,
    name_change_policy text DEFAULT ''::text,
    no_show_policy text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.airline_settings OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 17730)
-- Name: airports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.airports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    iata_code text NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    country text DEFAULT ''::text,
    latitude numeric,
    longitude numeric,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.airports OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 17653)
-- Name: api_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.api_settings OWNER TO postgres;

--
-- TOC entry 342 (class 1259 OID 18055)
-- Name: b2b_access_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.b2b_access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_type text DEFAULT 'api_access'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    company_name text DEFAULT ''::text,
    domain_requested text DEFAULT ''::text,
    business_justification text DEFAULT ''::text,
    admin_notes text DEFAULT ''::text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.b2b_access_requests OWNER TO postgres;

--
-- TOC entry 329 (class 1259 OID 17743)
-- Name: banners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text DEFAULT ''::text,
    image_url text DEFAULT ''::text,
    link_url text DEFAULT ''::text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.banners OWNER TO postgres;

--
-- TOC entry 332 (class 1259 OID 17783)
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blog_categories OWNER TO postgres;

--
-- TOC entry 333 (class 1259 OID 17794)
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text DEFAULT ''::text NOT NULL,
    featured_image text,
    category_id uuid,
    tags jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text,
    author_name text DEFAULT ''::text,
    published_at timestamp with time zone,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blog_posts OWNER TO postgres;

--
-- TOC entry 327 (class 1259 OID 17712)
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    booking_id text NOT NULL,
    type text DEFAULT 'Flight'::text NOT NULL,
    title text NOT NULL,
    subtitle text,
    total numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    details jsonb DEFAULT '[]'::jsonb,
    confirmation_number text,
    confirmation_data jsonb,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- TOC entry 341 (class 1259 OID 17958)
-- Name: destinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    country text DEFAULT ''::text,
    image_url text,
    price numeric DEFAULT 0,
    rating numeric DEFAULT 0,
    flights integer DEFAULT 0,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.destinations OWNER TO postgres;

--
-- TOC entry 339 (class 1259 OID 17916)
-- Name: flight_price_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flight_price_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_code text NOT NULL,
    to_code text NOT NULL,
    travel_date date NOT NULL,
    lowest_price numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    source text DEFAULT ''::text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cabin_class text DEFAULT 'Economy'::text,
    adults integer DEFAULT 1,
    children integer DEFAULT 0,
    infants integer DEFAULT 0,
    cached_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.flight_price_cache OWNER TO postgres;

--
-- TOC entry 324 (class 1259 OID 17666)
-- Name: flights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.flights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    airline text NOT NULL,
    from_city text NOT NULL,
    to_city text NOT NULL,
    departure text DEFAULT ''::text,
    arrival text DEFAULT ''::text,
    duration text DEFAULT ''::text,
    price numeric DEFAULT 0,
    stops integer DEFAULT 0,
    class text DEFAULT 'Economy'::text,
    seats integer DEFAULT 100,
    markup_percentage numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flights OWNER TO postgres;

--
-- TOC entry 343 (class 1259 OID 18085)
-- Name: hotel_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hotel_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hotel_id text NOT NULL,
    hotel_name text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    stars integer DEFAULT 0,
    action text DEFAULT 'view'::text NOT NULL,
    session_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hotel_interactions OWNER TO postgres;

--
-- TOC entry 325 (class 1259 OID 17684)
-- Name: hotels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hotels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    rating numeric DEFAULT 0,
    reviews integer DEFAULT 0,
    price numeric DEFAULT 0,
    image text,
    amenities jsonb DEFAULT '[]'::jsonb,
    stars integer DEFAULT 4,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true
);


ALTER TABLE public.hotels OWNER TO postgres;

--
-- TOC entry 340 (class 1259 OID 17930)
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.newsletter_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.newsletter_subscribers OWNER TO postgres;

--
-- TOC entry 330 (class 1259 OID 17757)
-- Name: offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    discount text DEFAULT ''::text,
    color text DEFAULT 'primary'::text,
    is_active boolean DEFAULT true,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.offers OWNER TO postgres;

--
-- TOC entry 334 (class 1259 OID 17814)
-- Name: popular_routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.popular_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_code text NOT NULL,
    to_code text NOT NULL,
    from_city text DEFAULT ''::text,
    to_city text DEFAULT ''::text,
    search_count integer DEFAULT 1,
    lowest_price numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    airline text DEFAULT ''::text,
    duration text DEFAULT ''::text,
    stops integer DEFAULT 0,
    last_searched_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.popular_routes OWNER TO postgres;

--
-- TOC entry 316 (class 1259 OID 17531)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_blocked boolean DEFAULT false,
    user_type text DEFAULT 'b2c'::text,
    company_name text DEFAULT ''::text,
    approval_status text DEFAULT 'approved'::text,
    is_approved boolean DEFAULT true,
    billing_currency text DEFAULT 'USD'::text,
    tenant_id uuid,
    company_address text DEFAULT ''::text,
    trade_license text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    approved_by uuid,
    approved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 319 (class 1259 OID 17579)
-- Name: provider_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    providers jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_groups OWNER TO postgres;

--
-- TOC entry 337 (class 1259 OID 17877)
-- Name: saved_passengers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_passengers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT ''::text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    dob text DEFAULT ''::text,
    nationality text DEFAULT ''::text,
    passport_country text DEFAULT ''::text,
    passport_number text DEFAULT ''::text,
    passport_expiry text DEFAULT ''::text,
    frequent_flyer text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.saved_passengers OWNER TO postgres;

--
-- TOC entry 320 (class 1259 OID 17597)
-- Name: tenant_api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    api_key text NOT NULL,
    name text DEFAULT 'Default'::text,
    is_active boolean DEFAULT true,
    rate_limit_per_minute integer DEFAULT 60,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_api_keys OWNER TO postgres;

--
-- TOC entry 321 (class 1259 OID 17616)
-- Name: tenant_api_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_api_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text NOT NULL,
    is_active boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_api_settings OWNER TO postgres;

--
-- TOC entry 322 (class 1259 OID 17634)
-- Name: tenant_payment_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text NOT NULL,
    is_active boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    supported_currencies text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenant_payment_settings OWNER TO postgres;

--
-- TOC entry 318 (class 1259 OID 17566)
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    provider_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- TOC entry 331 (class 1259 OID 17770)
-- Name: testimonials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    role text DEFAULT ''::text,
    text text NOT NULL,
    rating integer DEFAULT 5,
    avatar text DEFAULT ''::text,
    is_active boolean DEFAULT true,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.testimonials OWNER TO postgres;

--
-- TOC entry 336 (class 1259 OID 17851)
-- Name: ticket_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'refund'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text DEFAULT ''::text,
    new_travel_date text,
    admin_notes text DEFAULT ''::text,
    quote_amount numeric DEFAULT 0,
    charges numeric DEFAULT 0,
    refund_method text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_requests OWNER TO postgres;

--
-- TOC entry 344 (class 1259 OID 18111)
-- Name: tour_inquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tour_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_name text DEFAULT ''::text NOT NULL,
    visitor_email text DEFAULT ''::text NOT NULL,
    visitor_phone text DEFAULT ''::text,
    destination text DEFAULT ''::text,
    travel_dates text DEFAULT ''::text,
    duration text DEFAULT ''::text,
    travelers integer DEFAULT 1,
    budget text DEFAULT ''::text,
    interests text DEFAULT ''::text,
    ai_itinerary text DEFAULT ''::text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text DEFAULT ''::text,
    source text DEFAULT 'website'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tour_inquiries OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 17698)
-- Name: tours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    destination text NOT NULL,
    duration text DEFAULT ''::text,
    price numeric DEFAULT 0,
    category text DEFAULT 'International'::text,
    rating numeric DEFAULT 0,
    image text,
    highlights jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tours OWNER TO postgres;

--
-- TOC entry 345 (class 1259 OID 18136)
-- Name: tripjack_cities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tripjack_cities (
    id integer NOT NULL,
    city_name text DEFAULT ''::text NOT NULL,
    country_name text DEFAULT ''::text,
    type text DEFAULT 'CITY'::text,
    full_region_name text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tripjack_cities OWNER TO postgres;

--
-- TOC entry 346 (class 1259 OID 18150)
-- Name: tripjack_hotels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tripjack_hotels (
    tj_hotel_id bigint NOT NULL,
    unica_id bigint,
    name text DEFAULT ''::text NOT NULL,
    rating integer DEFAULT 0,
    property_type text DEFAULT 'Hotel'::text,
    city_name text DEFAULT ''::text,
    city_code text DEFAULT ''::text,
    state_name text DEFAULT ''::text,
    country_name text DEFAULT ''::text,
    country_code text DEFAULT ''::text,
    latitude numeric,
    longitude numeric,
    address text DEFAULT ''::text,
    postal_code text DEFAULT ''::text,
    image_url text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tripjack_hotels OWNER TO postgres;

--
-- TOC entry 317 (class 1259 OID 17553)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    tenant_id uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- TOC entry 335 (class 1259 OID 17833)
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    type text DEFAULT 'credit'::text NOT NULL,
    description text DEFAULT ''::text,
    status text DEFAULT 'completed'::text,
    reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wallet_transactions OWNER TO postgres;

--
-- TOC entry 314 (class 1259 OID 17471)
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- TOC entry 300 (class 1259 OID 17122)
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- TOC entry 303 (class 1259 OID 17145)
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- TOC entry 302 (class 1259 OID 17144)
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 307 (class 1259 OID 17229)
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- TOC entry 4938 (class 0 OID 0)
-- Dependencies: 307
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- TOC entry 311 (class 1259 OID 17348)
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- TOC entry 312 (class 1259 OID 17361)
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- TOC entry 306 (class 1259 OID 17221)
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- TOC entry 308 (class 1259 OID 17239)
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- TOC entry 4942 (class 0 OID 0)
-- Dependencies: 308
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- TOC entry 309 (class 1259 OID 17288)
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- TOC entry 310 (class 1259 OID 17302)
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- TOC entry 313 (class 1259 OID 17371)
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- TOC entry 315 (class 1259 OID 17514)
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- TOC entry 3778 (class 2604 OID 16514)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 4688 (class 0 OID 16529)
-- Dependencies: 279
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- TOC entry 4705 (class 0 OID 17078)
-- Dependencies: 299
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4699 (class 0 OID 16883)
-- Dependencies: 293
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


--
-- TOC entry 4690 (class 0 OID 16681)
-- Dependencies: 284
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
2257ebbf-39ba-4f6e-be82-3e038e2ffc96	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	{"sub": "2257ebbf-39ba-4f6e-be82-3e038e2ffc96", "email": "ars@travelvela.com", "email_verified": false, "phone_verified": false}	email	2026-03-08 22:20:49.545175+00	2026-03-08 22:20:49.545556+00	2026-03-08 22:20:49.545556+00	69f53ccc-90ae-4afe-a5a1-c91d29ba6f9c
\.


--
-- TOC entry 4687 (class 0 OID 16522)
-- Dependencies: 278
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4694 (class 0 OID 16770)
-- Dependencies: 288
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
9a4dfd85-2f74-4860-aebf-c6cd0ba93743	2026-03-08 22:21:11.232161+00	2026-03-08 22:21:11.232161+00	password	d74be88a-d242-47bb-9d84-fe116263880d
271f087f-87dc-41d1-8df0-f5b49f026fa4	2026-03-08 22:21:34.79267+00	2026-03-08 22:21:34.79267+00	password	048eae00-e76d-40a4-9c0e-15b649d9e02f
\.


--
-- TOC entry 4693 (class 0 OID 16758)
-- Dependencies: 287
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- TOC entry 4692 (class 0 OID 16745)
-- Dependencies: 286
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- TOC entry 4702 (class 0 OID 16995)
-- Dependencies: 296
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- TOC entry 4704 (class 0 OID 17068)
-- Dependencies: 298
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- TOC entry 4701 (class 0 OID 16965)
-- Dependencies: 295
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


--
-- TOC entry 4703 (class 0 OID 17028)
-- Dependencies: 297
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- TOC entry 4700 (class 0 OID 16933)
-- Dependencies: 294
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4686 (class 0 OID 16511)
-- Dependencies: 277
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	1	qm7z3ura54ou	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	f	2026-03-08 22:21:11.217163+00	2026-03-08 22:21:11.217163+00	\N	9a4dfd85-2f74-4860-aebf-c6cd0ba93743
00000000-0000-0000-0000-000000000000	2	zfbcy6ca5lvp	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-08 22:21:34.773027+00	2026-03-08 23:23:34.529445+00	\N	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	3	cklb444vf3ea	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-08 23:23:34.546426+00	2026-03-09 07:07:27.244749+00	zfbcy6ca5lvp	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	4	76uhav44aubw	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-09 07:07:27.263091+00	2026-03-09 08:05:39.842304+00	cklb444vf3ea	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	5	mres3aqiryh7	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-09 08:05:39.851891+00	2026-03-09 09:04:52.809318+00	76uhav44aubw	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	6	atkyrzachegs	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-09 09:04:52.811815+00	2026-03-09 15:48:43.909182+00	mres3aqiryh7	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	7	iuv6m3ifahzs	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	t	2026-03-09 15:48:43.918463+00	2026-03-09 17:57:25.032351+00	atkyrzachegs	271f087f-87dc-41d1-8df0-f5b49f026fa4
00000000-0000-0000-0000-000000000000	8	p5jwsrpzep4k	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	f	2026-03-09 17:57:25.040598+00	2026-03-09 17:57:25.040598+00	iuv6m3ifahzs	271f087f-87dc-41d1-8df0-f5b49f026fa4
\.


--
-- TOC entry 4697 (class 0 OID 16812)
-- Dependencies: 291
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- TOC entry 4698 (class 0 OID 16830)
-- Dependencies: 292
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- TOC entry 4689 (class 0 OID 16537)
-- Dependencies: 280
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
\.


--
-- TOC entry 4691 (class 0 OID 16711)
-- Dependencies: 285
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
9a4dfd85-2f74-4860-aebf-c6cd0ba93743	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	2026-03-08 22:21:11.19873+00	2026-03-08 22:21:11.19873+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	202.5.54.110	\N	\N	\N	\N	\N
271f087f-87dc-41d1-8df0-f5b49f026fa4	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	2026-03-08 22:21:34.746607+00	2026-03-09 17:57:25.047905+00	\N	aal1	\N	2026-03-09 17:57:25.047804	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	202.5.54.110	\N	\N	\N	\N	\N
\.


--
-- TOC entry 4696 (class 0 OID 16797)
-- Dependencies: 290
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4695 (class 0 OID 16788)
-- Dependencies: 289
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- TOC entry 4684 (class 0 OID 16499)
-- Dependencies: 275
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	authenticated	authenticated	ars@travelvela.com	$2a$10$sSP5vrw1jokApmkN9OCKTezrdQEetff/Q4cOBpCRD1RYrekfZ8WO.	2026-03-08 22:20:49.560962+00	\N		\N		\N			\N	2026-03-08 22:21:34.746503+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-03-08 22:20:49.527217+00	2026-03-09 17:57:25.04381+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- TOC entry 4740 (class 0 OID 17898)
-- Dependencies: 338
-- Data for Name: airline_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.airline_settings (id, airline_code, airline_name, cabin_baggage, checkin_baggage, cancellation_policy, date_change_policy, name_change_policy, no_show_policy, created_at, updated_at) FROM stdin;
db9c328c-1832-4696-97d2-78a618448bdf	BG	Biman Bangladesh	7 Kg	10 Kg	Free cancellation within 24 hours of booking	As Per Airline	As Per Airline	As Per Airline	2026-02-27 19:28:50.106068+00	2026-03-08 22:02:49.782918+00
5ccd4984-08fc-42df-993e-ba05a74191ea	CZ	China Southern Airlines	7 Kg	23 Kg	Varies by fare class	Varies by fare class	Name changes up to 48h before departure ($50 fee)	No-show results in full fare forfeiture	2026-03-03 01:01:54.981512+00	2026-03-08 22:02:49.782918+00
e6f3a985-4038-48fb-9c79-fce4f48fa399	MU	China Eastern Airlines	7 Kg	23 Kg	Varies by fare class	Varies by fare class	Name changes up to 48h before departure ($50 fee)	No-show results in full fare forfeiture	2026-03-03 01:01:54.981512+00	2026-03-08 22:02:49.782918+00
\.


--
-- TOC entry 4730 (class 0 OID 17730)
-- Dependencies: 328
-- Data for Name: airports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.airports (id, iata_code, name, city, country, latitude, longitude, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 4725 (class 0 OID 17653)
-- Dependencies: 323
-- Data for Name: api_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.api_settings (id, provider, is_active, settings, created_at) FROM stdin;
b1ab890f-ca84-4e18-b41a-78e97ff3db46	local_inventory	f	{"type": "flights"}	2026-02-27 16:38:01.442505+00
86430c54-38ec-4282-bde4-11e3d9fd7999	travelvela	f	{}	2026-02-28 20:42:07.55977+00
f473fc93-a72f-44f1-81fa-e1f45fbb9bcd	flight_markup	t	{"type": "percentage", "value": 5}	2026-02-27 18:45:28.747665+00
cea2d7cc-4846-4ded-8089-69179598d7c2	site_general	t	{"tagline": "Travel Simply", "site_name": "Travel Vela", "show_prices_bdt": true, "default_currency": "BDT", "default_language": "English", "maintenance_mode": false, "user_registration": true}	2026-03-01 09:27:03.782371+00
fe1d91f8-303f-4ade-8c19-d34e40991f8c	taxes_fees	t	{"service_fee": 0, "tax_percentage": 0, "convenience_fee_percentage": 0}	2026-02-27 20:26:59.851389+00
f718222f-4d41-4663-b467-726609312e14	ait_settings	t	{"per_api": {"amadeus": 0, "tripjack": 0, "travelport": 0.3, "travelvela": 0}}	2026-03-08 08:27:59.985811+00
ed401a06-4015-44c8-ab6a-9071e888e518	amadeus	f	{"environment": "test"}	2026-02-27 16:36:07.813547+00
f3d8950d-f005-4f0c-ae3a-1b581391fb77	travelport	t	{"endpoint": "https://apac.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService", "environment": "production", "student_fare_enabled": true}	2026-02-27 15:30:28.453661+00
e7239b98-8cf9-4fb1-9a89-54f66f72282e	tripjack_flight	t	{"environment": "production"}	2026-03-05 20:16:27.587296+00
9dc9f7ff-78a7-4616-a632-36b93be3a226	site_apps	t	{"tawkto": false, "tawkto_id": "", "crisp_enabled": true, "google_reviews": false, "google_place_id": "", "whatsapp_number": "", "whatsapp_widget": true, "crisp_website_id": "7b6ec17d-256a-41e8-9732-17ff58bd51e9"}	2026-03-08 09:41:25.106574+00
0d90080f-6179-4127-b6ee-b5663bda7ac9	site_payment	t	{"stripe_pk": "", "stripe_sk": "", "sandbox_mode": true, "bkash_enabled": true, "nagad_enabled": false, "stripe_enabled": false, "bank_transfer_enabled": true}	2026-03-04 15:08:48.583663+00
dd65d03a-8493-4af0-b682-0ffdcde4700c	site_contact	t	{"email": "", "phone": "01870802030", "address": "Bashori Bhaban, Police Line Road, Barishal", "maps_url": "", "whatsapp": "", "iata_number": "", "business_name": "Travel Vela", "civil_aviation_license": ""}	2026-03-04 16:45:21.513499+00
5bcc887b-62df-4e43-a568-32df0edd0be6	api_markup	t	{"per_api": {"amadeus": {"global": 1, "airlines": {}}, "tripjack": {"global": 3, "airlines": {}}, "travelport": {"global": 2, "airlines": {}}, "travelvela": {"global": 1, "airlines": {}}}, "airline_markups": {}, "markup_percentage": 2}	2026-02-27 19:00:53.475606+00
c045246d-3197-475c-88cf-7c949ebee186	site_branding	t	{"logo_url": "https://travelvela-html.vercel.app/images/logo.png", "color_card": "#ffffff", "color_muted": "#edf3f8", "favicon_url": "https://travelvela-html.vercel.app/images/favicon.png", "footer_text": "© 2026 Travel Vela. All rights reserved.", "accent_color": "#10b981", "color_accent": "#ff6b2c", "color_border": "#d0e3f2", "color_primary": "#0092ff", "primary_color": "#0092ff", "color_secondary": "#e8f4ff", "secondary_color": "#f59e0b", "color_background": "#f7fafd", "color_foreground": "#0a1929", "color_destructive": "#e53935", "color_card_foreground": "#0a1929", "color_muted_foreground": "#5a7a99", "color_accent_foreground": "#ffffff", "color_primary_foreground": "#ffffff", "color_secondary_foreground": "#003d6b"}	2026-03-01 09:28:10.92761+00
1f615d7b-d9dc-4786-933e-1f154b28f0f3	currency_rates	t	{"live_rates": {"AED": 3.6725, "AUD": 1.421306, "BDT": 122.299479, "CAD": 1.368024, "CNY": 6.915072, "EUR": 0.860948, "GBP": 0.749722, "HKD": 7.804472, "INR": 92.108456, "JPY": 157.706313, "KRW": 1477.311478, "MYR": 3.942914, "NPR": 147.37432, "NZD": 1.697866, "PKR": 279.490668, "QAR": 3.64, "SAR": 3.75, "SGD": 1.277508, "THB": 31.653168, "TRY": 43.966313, "USD": 1}, "last_fetched": "2026-03-04T10:37:03.477Z", "conversion_markup": 3, "api_source_currencies": {"amadeus": "USD", "travelport": "BDT", "travelvela": "BDT", "local_inventory": "USD"}}	2026-02-27 17:39:10.336609+00
d02d3ca5-69d9-49e4-b3ed-5e5a5b2cdec1	airline_commissions	t	{"rules": [{"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "QR", "commission_pct": 5.7}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "EK", "commission_pct": 6}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "SQ", "commission_pct": 6}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "MH", "commission_pct": 5.5}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "BG", "commission_pct": 6}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "CA", "commission_pct": 6.3}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "CZ", "commission_pct": 6.3}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "TG", "commission_pct": 6.4}, {"type": "commission", "module": "flights", "origin": "DAC", "api_source": "travelport", "markup_pct": 0, "destination": "", "profit_type": "percentage", "airline_code": "MU", "commission_pct": 6.4}]}	2026-03-02 23:41:31.101687+00
ff449992-a9bb-4684-8876-f05eada4a8ed	agoda_city_cache	t	{"london": 6270, "bangkok": 9395, "kolkata": 8850, "singapore": 4064}	2026-03-08 23:33:30.719708+00
726ce839-62ce-4330-9bfa-59981115d120	travelvela_hotel	f	{}	2026-03-05 21:49:50.643685+00
c891a08b-0f11-4606-aefb-b5b64edd973e	tripjack_hotel	f	{"environment": "production", "production_host": "api.tripjack.com"}	2026-03-05 19:39:50.068189+00
e11045db-c81d-45c8-9576-c78e773ee5f2	agoda_hotel	t	{"cityMapping": {}}	2026-03-08 22:59:33.051756+00
\.


--
-- TOC entry 4744 (class 0 OID 18055)
-- Dependencies: 342
-- Data for Name: b2b_access_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.b2b_access_requests (id, user_id, request_type, status, company_name, domain_requested, business_justification, admin_notes, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4731 (class 0 OID 17743)
-- Dependencies: 329
-- Data for Name: banners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.banners (id, title, subtitle, image_url, link_url, is_active, sort_order, tenant_id, created_at) FROM stdin;
fd065a59-ebd2-4031-af79-e1ea7e2b4e6a	banner 2		https://travelvela-html.vercel.app/images/offer-banner/2.avif	https://travelvela-html.vercel.app/images/offer-banner/2.avif	t	2	\N	2026-03-01 10:12:00.403651+00
a1bee4a8-8888-4339-ae15-c306d2e6508a	offer		https://travelvela-html.vercel.app/images/offer-banner/1.avif	https://travelvela-html.vercel.app/pricing.html	t	1	\N	2026-03-01 10:11:33.554895+00
63cec0cf-4d64-4e0d-8239-8ea2abff26ae	gfd		https://travelvela-html.vercel.app/images/offer-banner/2.avif	https://travelvela-html.vercel.app/images/offer-banner/2.avif	t	3	\N	2026-03-01 10:12:20.586118+00
\.


--
-- TOC entry 4734 (class 0 OID 17783)
-- Dependencies: 332
-- Data for Name: blog_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_categories (id, name, slug, created_at) FROM stdin;
3a9b8b75-ae21-45e3-bf74-a384599f3aa7	Travel	travel	2026-03-01 09:05:39.072992+00
84365e96-700a-4c88-9a13-e70541f5c70d	Tour	tour	2026-03-01 09:05:51.01216+00
9ed6ef1d-b5e1-4b2a-8eb1-6a113d2bc08f	Flight	flight	2026-03-01 09:06:01.090816+00
fcfee9c2-1794-4aa5-8bf4-0fa8cb6f7449	Travel Tips	travel-tips	2026-03-01 09:42:04.598627+00
6d5340c9-e7dc-45c6-aa19-39688f54a566	Destinations	destinations	2026-03-01 09:42:04.598627+00
1994ecc8-0228-4491-9fa7-00d150bd89bc	Budget Travel	budget-travel	2026-03-01 09:42:04.598627+00
\.


--
-- TOC entry 4735 (class 0 OID 17794)
-- Dependencies: 333
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_posts (id, title, slug, excerpt, content, featured_image, category_id, tags, status, author_name, published_at, tenant_id, created_at) FROM stdin;
73617487-4d29-4344-a639-667d8dccff7c	10 Must-Know Tips for First-Time International Travelers	10-tips-first-time-international-travelers	Planning your first trip abroad? These essential tips will help you navigate airports, currencies, and cultures like a pro.	<h2>Traveling Abroad for the First Time?</h2><p>International travel can be both exciting and overwhelming.</p><h3>1. Check Passport Validity</h3><p>Many countries require your passport to be valid for at least 6 months beyond your travel dates.</p><h3>2. Research Visa Requirements</h3><p>Some destinations offer visa-on-arrival, while others require advance applications.</p><h3>3. Get Travel Insurance</h3><p>Medical emergencies abroad can be incredibly expensive.</p><h3>4. Notify Your Bank</h3><p>Let your bank know about your travel plans.</p><h3>5. Pack Light</h3><p>Stick to versatile clothing and leave room for souvenirs.</p><h3>6. Learn Basic Phrases</h3><p>A simple hello and thank you in the local language goes a long way.</p><h3>7. Keep Digital Copies</h3><p>Scan your passport, tickets, and hotel confirmations.</p><h3>8. Stay Connected</h3><p>Consider getting a local SIM card or an international data plan.</p><h3>9. Be Aware of Local Customs</h3><p>Research cultural norms to avoid unintentional faux pas.</p><h3>10. Enjoy the Journey</h3><p>Leave room for spontaneous adventures.</p>	https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800	fcfee9c2-1794-4aa5-8bf4-0fa8cb6f7449	["tips", "international", "beginners"]	published	Travel Team	2026-02-27 09:43:10.905303+00	\N	2026-03-01 09:43:10.905303+00
441524eb-6417-407a-b62d-cef1237bbebf	Top 5 Budget-Friendly Destinations for 2026	top-5-budget-friendly-destinations-2026	Dreaming of a vacation that won't break the bank? These stunning destinations offer incredible experiences at a fraction of the cost.	<h2>Travel More, Spend Less</h2><p>You don't need a massive budget to explore the world.</p><h3>1. Vietnam</h3><p>World-class experiences for under $40/day.</p><h3>2. Portugal</h3><p>Stunning coastlines, rich history, and incredible cuisine at lower prices.</p><h3>3. Colombia</h3><p>One of South America's hottest destinations.</p><h3>4. Georgia</h3><p>Breathtaking mountain scenery and legendary hospitality.</p><h3>5. Sri Lanka</h3><p>Beaches, temples, tea plantations, and wildlife safaris.</p>	https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800	1994ecc8-0228-4491-9fa7-00d150bd89bc	["budget", "destinations", "2026"]	published	Travel Team	2026-02-24 09:43:10.905303+00	\N	2026-03-01 09:43:10.905303+00
4d5df5a6-c5a4-4340-815f-61a933028809	Exploring the Magic of Santorini: A Travel Diary	exploring-magic-of-santorini	White-washed buildings, stunning sunsets, and crystal-clear waters — discover why Santorini remains one of the world's most enchanting destinations.	<h2>A Week in Paradise</h2><p>Santorini has been on my bucket list for years, and it did not disappoint.</p><h3>Day 1-2: Oia</h3><p>Famous for its blue-domed churches and spectacular sunsets.</p><h3>Day 3-4: Fira & Hiking</h3><p>The hike from Fira to Oia offers panoramic views.</p><h3>Day 5: Beach Day</h3><p>Red Beach with its dramatic crimson cliffs.</p><h3>Day 6-7: Food & Culture</h3><p>Fresh seafood and Assyrtiko wine from local vineyards.</p>	https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800	6d5340c9-e7dc-45c6-aa19-39688f54a566	["santorini", "greece", "destinations", "diary"]	published	Sarah Mitchell	2026-02-26 09:43:10.905303+00	\N	2026-03-01 09:43:10.905303+00
c33a33f7-5562-40c4-8d1f-f389c2e99562	The Ultimate Dubai Travel Guide for 2026	ultimate-dubai-travel-guide-2026	From towering skyscrapers to ancient souks, Dubai blends tradition and futurism like no other city.	<h2>Welcome to the City of the Future</h2><p>Dubai is a city that defies expectations at every turn.</p><h3>Must-See Attractions</h3><p>Burj Khalifa, Dubai Mall, Old Dubai.</p><h3>Best Time to Visit</h3><p>November to March offers the most pleasant weather.</p><h3>Getting Around</h3><p>The Dubai Metro is clean, efficient, and affordable.</p><h3>Food Scene</h3><p>Dubai's dining scene is world-class.</p>	https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800	6d5340c9-e7dc-45c6-aa19-39688f54a566	["dubai", "guide", "destinations"]	published	Travel Team	2026-02-22 09:43:10.905303+00	\N	2026-03-01 09:43:10.905303+00
1c6ffa04-248a-4732-97e4-57ef4cb3f0e5	How to Find the Cheapest Flights: A Complete Guide	how-to-find-cheapest-flights-guide	Unlock the secrets to scoring the best flight deals with these proven strategies.	<h2>Stop Overpaying for Flights</h2><p>Flight prices can vary dramatically depending on when and how you book.</p><h3>Be Flexible with Dates</h3><p>Flying mid-week is often significantly cheaper.</p><h3>Book at the Right Time</h3><p>For domestic flights, booking 1-3 months in advance typically yields the best prices.</p><h3>Use Incognito Mode</h3><p>Airlines and booking sites may track your searches.</p><h3>Consider Nearby Airports</h3><p>Flying into a secondary airport can save you hundreds.</p><h3>Set Price Alerts</h3><p>Use fare tracking tools to monitor prices.</p>	https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=800	9ed6ef1d-b5e1-4b2a-8eb1-6a113d2bc08f	["flights", "deals", "tips"]	published	Travel Team	2026-03-01 10:05:15.176+00	\N	2026-03-01 09:43:10.905303+00
\.


--
-- TOC entry 4729 (class 0 OID 17712)
-- Dependencies: 327
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookings (id, user_id, booking_id, type, title, subtitle, total, status, details, confirmation_number, confirmation_data, tenant_id, created_at) FROM stdin;
\.


--
-- TOC entry 4743 (class 0 OID 17958)
-- Dependencies: 341
-- Data for Name: destinations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.destinations (id, name, country, image_url, price, rating, flights, is_active, sort_order, tenant_id, created_at) FROM stdin;
\.


--
-- TOC entry 4741 (class 0 OID 17916)
-- Dependencies: 339
-- Data for Name: flight_price_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flight_price_cache (id, from_code, to_code, travel_date, lowest_price, currency, source, expires_at, created_at, cabin_class, adults, children, infants, cached_at) FROM stdin;
\.


--
-- TOC entry 4726 (class 0 OID 17666)
-- Dependencies: 324
-- Data for Name: flights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.flights (id, airline, from_city, to_city, departure, arrival, duration, price, stops, class, seats, markup_percentage, is_active, created_at) FROM stdin;
\.


--
-- TOC entry 4745 (class 0 OID 18085)
-- Dependencies: 343
-- Data for Name: hotel_interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hotel_interactions (id, hotel_id, hotel_name, city, stars, action, session_id, user_id, created_at) FROM stdin;
a367edbc-9855-4e17-a204-dad8d913744a	hsid6808994338-41618602	SAPPHIRE GUEST HOUSE	Kolkata	3	view	e119e407-2eda-40d4-ac9c-0657ef70462d	\N	2026-03-05 23:08:25.220511+00
3dd3baa2-497c-4f44-9f04-fbea424d94ec	hsid6808994338-41618602	SAPPHIRE GUEST HOUSE	Kolkata	3	view	e119e407-2eda-40d4-ac9c-0657ef70462d	\N	2026-03-05 23:08:44.917506+00
5dca3e48-deee-477b-b115-f485751060aa	hsid6808994338-41618602	SAPPHIRE GUEST HOUSE	Kolkata	3	view	e119e407-2eda-40d4-ac9c-0657ef70462d	\N	2026-03-05 23:11:11.326032+00
2058e9bb-d37c-49fc-979b-64f150d7f9a7	hsid1673366645-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	view	3f080520-9a8b-432c-b315-de5d0c2999c2	\N	2026-03-05 23:11:43.05981+00
71411a55-dfae-46b5-9edc-fc6a60a439f3	hsid1673366645-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	click	3f080520-9a8b-432c-b315-de5d0c2999c2	\N	2026-03-05 23:11:43.46401+00
7c250dff-9aa3-4aef-86b9-b7a25534d94e	hsid6808994338-41618602	SAPPHIRE GUEST HOUSE	Kolkata	3	view	e119e407-2eda-40d4-ac9c-0657ef70462d	\N	2026-03-05 23:14:22.74352+00
05ebb2ca-133d-455b-a6f7-ee06941559a8	hsid6701909147-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	view	9d587638-caa6-4100-86fe-93568d37277f	\N	2026-03-05 23:15:36.965854+00
1c0275f7-32f6-45d2-9990-817004835e02	hsid6701909147-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	click	9d587638-caa6-4100-86fe-93568d37277f	\N	2026-03-05 23:15:36.995855+00
7a1e8475-8cd2-4cc0-bbb7-89f31b52ab90	hsid6808994338-41618602	SAPPHIRE GUEST HOUSE	Kolkata	3	view	e119e407-2eda-40d4-ac9c-0657ef70462d	\N	2026-03-05 23:18:38.581788+00
7b2996c2-b32b-4ae7-8340-4a321bfe0b25	hsid7585180694-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	view	3614ea92-b9d6-4430-909a-a8894f449fd9	\N	2026-03-06 06:56:36.878553+00
60e1dca5-9209-4906-a130-878b09d32b3e	hsid7585180694-31981013	ITC Royal Bengal, a Luxury Collection Hotel, Kolkata	Kolkata	5	click	3614ea92-b9d6-4430-909a-a8894f449fd9	\N	2026-03-06 06:56:36.878551+00
d02b0599-50c3-4bab-86b8-edd6041b523a	hsid3218963219-16312832	ITC Sonar, a Luxury Collection Hotel, Kolkata	Kolkata	5	view	b53804f9-8e54-4026-bb1e-a1bbd927e044	\N	2026-03-07 14:05:09.509215+00
f042a581-0114-4c0b-ac00-de2ccbb56f51	hsid3218963219-16312832	ITC Sonar, a Luxury Collection Hotel, Kolkata	Kolkata	5	view	b53804f9-8e54-4026-bb1e-a1bbd927e044	\N	2026-03-07 14:05:09.647456+00
15ebddb7-f2aa-46eb-91f8-b018b9d35ca5	hsid3218963219-16312832	ITC Sonar, a Luxury Collection Hotel, Kolkata	Kolkata	5	click	b53804f9-8e54-4026-bb1e-a1bbd927e044	\N	2026-03-07 14:05:09.725789+00
490198d0-0f5c-4f58-be03-2a16a455dccd	agoda-14654101	Solaria Nishitetsu Hotel Bangkok	Bangkok	4	view	88a400a0-c23d-4af0-b9aa-dd6816e73f3a	\N	2026-03-09 08:00:24.336717+00
c54c8feb-7875-43cd-b966-7ac327e460d4	agoda-14654101	Solaria Nishitetsu Hotel Bangkok	Bangkok	4	view	88a400a0-c23d-4af0-b9aa-dd6816e73f3a	\N	2026-03-09 08:00:24.562065+00
2ed38817-d7b2-46c4-96e9-836e07bdb433	agoda-14654101	Solaria Nishitetsu Hotel Bangkok	Bangkok	4	click	88a400a0-c23d-4af0-b9aa-dd6816e73f3a	\N	2026-03-09 08:00:27.683977+00
\.


--
-- TOC entry 4727 (class 0 OID 17684)
-- Dependencies: 325
-- Data for Name: hotels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hotels (id, name, city, rating, reviews, price, image, amenities, stars, created_at, is_active) FROM stdin;
ada54958-ce57-476d-9e72-5ea76e7a13a2	Grand Palace Hotel	Paris	4.8	2340	250	dest-paris	["WiFi", "Pool", "Spa", "Restaurant", "Gym"]	5	2026-02-27 13:11:27.452392+00	t
91514563-23a8-46d1-b4e4-eb09d3c8b781	Tokyo Bay Resort	Tokyo	4.7	1890	180	dest-tokyo	["WiFi", "Restaurant", "Bar", "Gym"]	4	2026-02-27 13:11:27.452392+00	t
c57ae804-0fcb-4a11-ac4e-ad3efed45ff7	Bali Zen Villas	Bali	4.9	3200	320	dest-bali	["WiFi", "Pool", "Spa", "Restaurant", "Beach Access"]	5	2026-02-27 13:11:27.452392+00	t
5dd36b87-dea0-4eb9-8a05-aa450caa6634	Burj View Suites	Dubai	4.6	1560	400	dest-dubai	["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Bar"]	5	2026-02-27 13:11:27.452392+00	t
c7c236c9-0a3b-46f3-86cc-0ec9d3873564	Aegean Blue Hotel	Santorini	4.8	980	280	dest-santorini	["WiFi", "Pool", "Restaurant", "Sea View"]	4	2026-02-27 13:11:27.452392+00	t
4532d67d-5b5e-4de3-b312-64f6fe266d33	Manhattan Central Inn	New York	4.4	4100	199	dest-newyork	["WiFi", "Restaurant", "Gym", "Bar"]	4	2026-02-27 13:11:27.452392+00	t
\.


--
-- TOC entry 4742 (class 0 OID 17930)
-- Dependencies: 340
-- Data for Name: newsletter_subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.newsletter_subscribers (id, email, created_at) FROM stdin;
\.


--
-- TOC entry 4732 (class 0 OID 17757)
-- Dependencies: 330
-- Data for Name: offers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.offers (id, title, description, discount, color, is_active, tenant_id, created_at) FROM stdin;
ae8a3435-022a-41b6-b965-618e01322c93	Summer Sale	Flights & Hotels	40% OFF	primary	t	\N	2026-03-03 07:59:54.161211+00
79865e24-f964-4266-abd1-6f41771a1755	Hotel Deals	Luxury stays at budget prices	10% OFF	accent	t	\N	2026-03-03 07:59:54.161211+00
9f137e8a-07da-4922-a64b-1634e00ea357	Honeymoon Special	Free room upgrade on packages	FREE UPGRADE	success	t	\N	2026-03-03 07:59:54.161211+00
\.


--
-- TOC entry 4736 (class 0 OID 17814)
-- Dependencies: 334
-- Data for Name: popular_routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.popular_routes (id, from_code, to_code, from_city, to_city, search_count, lowest_price, currency, airline, duration, stops, last_searched_at, created_at) FROM stdin;
58612889-1634-4a08-832b-6be035f8352d	DAC	CGP	Dhaka	Chittagong	38	4500	BDT	BG	45m	0	2026-03-03 13:58:40.627823+00	2026-03-03 13:58:40.627823+00
90bb15ed-8320-47d6-b9fa-2a6de70f43c3	DAC	MLE	DAC	DAC	1	47490	INR	8D	24h 16m	3	2026-03-08 09:06:25.496583+00	2026-03-08 09:06:25.496583+00
1280e38f-048e-49dd-8ddb-44bc34a11008	DAC	KUL	Dhaka	Kuala Lumpur	25	28500	BDT	MH	4h 15m	0	2026-03-03 13:58:40.627823+00	2026-03-03 13:58:40.627823+00
65df622b-4b21-4ffa-a424-b7ef2b0b7029	DAC	DXB	DAC	DXB	49	28217	INR	AI	8h 30m	1	2026-03-08 10:49:21.676184+00	2026-03-03 13:55:25.780713+00
9cd0464c-8e49-4e92-a49b-fd2ebcd37e7f	DAC	ROR	DAC	ROR	12	225392	INR	CZ	41h 0m	2	2026-03-06 21:03:01.275356+00	2026-03-06 20:50:47.660625+00
71395c88-f9cd-4784-8626-ce1beb500a11	DAC	FCO	DAC	FCO	9	38787	INR	MU	33h 35m	2	2026-03-06 21:16:24.061608+00	2026-03-06 21:03:59.395375+00
58b94490-d5b6-4f08-8192-bc2e9c984e26	CKG	DAC	CKG	DAC	1	44728	BDT	CZ	20h 15m	1	2026-03-08 16:18:52.395111+00	2026-03-08 16:18:52.395111+00
c75ed1f3-220e-49f5-83cb-41b64b6fe915	DAC	CAN	DAC	CAN	33	22063	INR	6E	7h 50m	1	2026-03-08 16:53:09.579912+00	2026-03-04 15:07:36.975762+00
bd8c88da-2daa-4da7-a9ef-593d070e081e	DAC	CKG	DAC	CKG	127	24953	INR	MU	17h 30m	1	2026-03-08 17:41:08.363734+00	2026-03-03 18:27:42.29487+00
8e9a64db-d3cb-4593-8cce-52b7fe42513e	DAC	DAC	DAC	USM	1	215161	BDT	SQ	7h 5m	1	2026-03-08 17:42:29.05368+00	2026-03-08 17:42:29.05368+00
263188a7-0dd1-4610-8f08-7526f867342a	DAC	BKK	DAC	DAC	23	22800	BDT	TG	3h 30m	0	2026-03-08 17:48:05.017973+00	2026-03-03 13:58:40.627823+00
86644807-bef0-45ea-bbdd-c11586fb0e43	DAC	PVG	DAC	PVG	1	30051	BDT	MU	6h 40m	1	2026-03-03 20:23:21.341559+00	2026-03-03 20:23:21.341559+00
e531f8ba-5111-468c-afc0-c5090a1159c0	DAC	CDG	DAC	CDG	18	38787	INR	MU	20h 55m	2	2026-03-06 21:49:02.63136+00	2026-03-06 21:21:07.840801+00
19d11d50-eed4-492c-b46f-ef03229fd8a4	DAC	CXB	DAC	CXB	41	5049	BDT	BS	1h 5m	0	2026-03-05 21:39:27.494046+00	2026-03-03 13:58:40.627823+00
7ba08535-90fc-4dd1-9b25-c64742456e79	DAC	SIN	DAC	SIN	16	31200	BDT	SQ	4h 45m	0	2026-03-04 13:28:36.503955+00	2026-03-03 13:58:40.627823+00
8daed13b-42a7-4cb9-86d8-3f4820dc885f	CAN	DAC	CAN	DAC	2	18267	BDT	UL	11h 30m	1	2026-03-04 16:17:51.670869+00	2026-03-04 15:10:31.704778+00
3aad3311-3037-4232-bc99-0f05c0f3db50	DAC	DEL	DAC	DEL	63	10720	INR	6E	16h 10m	1	2026-03-07 21:34:04.111952+00	2026-03-07 16:27:37.090335+00
5561811f-f33c-4937-9575-354e2ae1a665	DAC	CCU	DAC	CCU	42	6259	INR	6E	1h 5m	0	2026-03-07 21:53:11.216374+00	2026-03-06 20:17:07.88747+00
0696343e-77cc-4797-a7f6-25ef573c288a	DAC	SHJ	DAC	SHJ	1	39426	INR	X1	15h 35m	1	2026-03-07 16:03:43.317328+00	2026-03-07 16:03:43.317328+00
\.


--
-- TOC entry 4718 (class 0 OID 17531)
-- Dependencies: 316
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, user_id, full_name, email, created_at, is_blocked, user_type, company_name, approval_status, is_approved, billing_currency, tenant_id, company_address, trade_license, phone, approved_by, approved_at, updated_at) FROM stdin;
f7d61a7d-5414-4f34-97bf-d1f0a4cf0595	2257ebbf-39ba-4f6e-be82-3e038e2ffc96		ars@travelvela.com	2026-03-08 22:20:49.525949+00	f	b2c		approved	t	BDT	\N				\N	\N	2026-03-08 22:20:49.525949+00
\.


--
-- TOC entry 4721 (class 0 OID 17579)
-- Dependencies: 319
-- Data for Name: provider_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.provider_groups (id, name, description, providers, created_at) FROM stdin;
cb3d35b4-00e5-45d9-9ab9-ff2f091b7e0c	APAC	Asia-Pacific region — Travelport + Tripjack	{"amadeus": false, "tripjack": true, "travelport": true, "travelvela": false}	2026-03-07 18:45:43.151033+00
5b78950f-9b8e-4048-91d5-076d65814ac2	Europe	Europe region — Amadeus + Travelport	{"amadeus": true, "tripjack": false, "travelport": true, "travelvela": false}	2026-03-07 18:45:43.151033+00
447d9a4c-4ebd-4ec9-a20c-9689d77ffdb4	Global	Full access to all providers	{"amadeus": true, "tripjack": true, "travelport": true, "travelvela": true}	2026-03-07 18:45:43.151033+00
\.


--
-- TOC entry 4739 (class 0 OID 17877)
-- Dependencies: 337
-- Data for Name: saved_passengers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.saved_passengers (id, user_id, title, first_name, last_name, dob, nationality, passport_country, passport_number, passport_expiry, frequent_flyer, created_at) FROM stdin;
\.


--
-- TOC entry 4722 (class 0 OID 17597)
-- Dependencies: 320
-- Data for Name: tenant_api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_api_keys (id, tenant_id, api_key, name, is_active, rate_limit_per_minute, last_used_at, created_at) FROM stdin;
\.


--
-- TOC entry 4723 (class 0 OID 17616)
-- Dependencies: 321
-- Data for Name: tenant_api_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_api_settings (id, tenant_id, provider, is_active, settings, created_at) FROM stdin;
\.


--
-- TOC entry 4724 (class 0 OID 17634)
-- Dependencies: 322
-- Data for Name: tenant_payment_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_payment_settings (id, tenant_id, provider, is_active, settings, supported_currencies, created_at) FROM stdin;
\.


--
-- TOC entry 4720 (class 0 OID 17566)
-- Dependencies: 318
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, domain, name, is_active, settings, provider_group_id, created_at) FROM stdin;
\.


--
-- TOC entry 4733 (class 0 OID 17770)
-- Dependencies: 331
-- Data for Name: testimonials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.testimonials (id, name, role, text, rating, avatar, is_active, tenant_id, created_at) FROM stdin;
\.


--
-- TOC entry 4738 (class 0 OID 17851)
-- Dependencies: 336
-- Data for Name: ticket_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ticket_requests (id, booking_id, user_id, type, status, reason, new_travel_date, admin_notes, quote_amount, charges, refund_method, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4746 (class 0 OID 18111)
-- Dependencies: 344
-- Data for Name: tour_inquiries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tour_inquiries (id, visitor_name, visitor_email, visitor_phone, destination, travel_dates, duration, travelers, budget, interests, ai_itinerary, status, admin_notes, source, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4728 (class 0 OID 17698)
-- Dependencies: 326
-- Data for Name: tours; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tours (id, name, destination, duration, price, category, rating, image, highlights, created_at, is_active, updated_at) FROM stdin;
\.


--
-- TOC entry 4747 (class 0 OID 18136)
-- Dependencies: 345
-- Data for Name: tripjack_cities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tripjack_cities (id, city_name, country_name, type, full_region_name, created_at) FROM stdin;
1742	SARNY	UKRAINE	CITY	SARNY, RIVNE OBLAST, UKRAINE	2026-03-06 14:18:14.266711+00
1753	SHIMANTO	JAPAN	CITY	SHIMANTO, KOCHI PREFECTURE, JAPAN	2026-03-06 14:18:14.266711+00
1792	HUBBARDS	CANADA	CITY	HUBBARDS, NOVA SCOTIA, CANADA	2026-03-06 14:18:14.266711+00
\.


--
-- TOC entry 4748 (class 0 OID 18150)
-- Dependencies: 346
-- Data for Name: tripjack_hotels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tripjack_hotels (tj_hotel_id, unica_id, name, rating, property_type, city_name, city_code, state_name, country_name, country_code, latitude, longitude, address, postal_code, image_url, is_deleted, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4719 (class 0 OID 17553)
-- Dependencies: 317
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role, tenant_id) FROM stdin;
eefd66f7-bed0-4f6c-bd44-3bb470e6ce5e	2257ebbf-39ba-4f6e-be82-3e038e2ffc96	admin	\N
\.


--
-- TOC entry 4737 (class 0 OID 17833)
-- Dependencies: 335
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet_transactions (id, user_id, amount, type, description, status, reference, created_at) FROM stdin;
\.


--
-- TOC entry 4706 (class 0 OID 17122)
-- Dependencies: 300
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-03-08 20:40:30
20211116045059	2026-03-08 20:40:31
20211116050929	2026-03-08 20:40:32
20211116051442	2026-03-08 20:40:32
20211116212300	2026-03-08 20:40:33
20211116213355	2026-03-08 20:40:34
20211116213934	2026-03-08 20:40:34
20211116214523	2026-03-08 20:40:35
20211122062447	2026-03-08 20:40:36
20211124070109	2026-03-08 20:40:36
20211202204204	2026-03-08 20:40:37
20211202204605	2026-03-08 20:40:38
20211210212804	2026-03-08 20:40:40
20211228014915	2026-03-08 20:40:40
20220107221237	2026-03-08 20:40:41
20220228202821	2026-03-08 20:40:41
20220312004840	2026-03-08 20:40:42
20220603231003	2026-03-08 20:40:43
20220603232444	2026-03-08 20:40:44
20220615214548	2026-03-08 20:40:44
20220712093339	2026-03-08 20:40:45
20220908172859	2026-03-08 20:40:46
20220916233421	2026-03-08 20:40:46
20230119133233	2026-03-08 20:40:47
20230128025114	2026-03-08 20:40:48
20230128025212	2026-03-08 20:40:48
20230227211149	2026-03-08 20:40:49
20230228184745	2026-03-08 20:40:50
20230308225145	2026-03-08 20:40:50
20230328144023	2026-03-08 20:40:51
20231018144023	2026-03-08 20:40:52
20231204144023	2026-03-08 20:40:53
20231204144024	2026-03-08 20:40:53
20231204144025	2026-03-08 20:40:54
20240108234812	2026-03-08 20:40:54
20240109165339	2026-03-08 20:40:55
20240227174441	2026-03-08 20:40:56
20240311171622	2026-03-08 20:40:57
20240321100241	2026-03-08 20:40:59
20240401105812	2026-03-08 20:41:00
20240418121054	2026-03-08 20:41:01
20240523004032	2026-03-08 20:41:04
20240618124746	2026-03-08 20:41:04
20240801235015	2026-03-08 20:41:05
20240805133720	2026-03-08 20:41:06
20240827160934	2026-03-08 20:41:06
20240919163303	2026-03-08 20:41:07
20240919163305	2026-03-08 20:41:08
20241019105805	2026-03-08 20:41:08
20241030150047	2026-03-08 20:41:11
20241108114728	2026-03-08 20:41:12
20241121104152	2026-03-08 20:41:12
20241130184212	2026-03-08 20:41:13
20241220035512	2026-03-08 20:41:14
20241220123912	2026-03-08 20:41:14
20241224161212	2026-03-08 20:41:15
20250107150512	2026-03-08 20:41:15
20250110162412	2026-03-08 20:41:16
20250123174212	2026-03-08 20:41:17
20250128220012	2026-03-08 20:41:17
20250506224012	2026-03-08 20:41:18
20250523164012	2026-03-08 20:41:18
20250714121412	2026-03-08 20:41:19
20250905041441	2026-03-08 20:41:20
20251103001201	2026-03-08 20:41:20
20251120212548	2026-03-08 20:41:21
20251120215549	2026-03-08 20:41:22
20260218120000	2026-03-08 20:41:22
\.


--
-- TOC entry 4708 (class 0 OID 17145)
-- Dependencies: 303
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter) FROM stdin;
\.


--
-- TOC entry 4710 (class 0 OID 17229)
-- Dependencies: 307
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
ticket-files	ticket-files	\N	2026-03-08 21:55:08.251679+00	2026-03-08 21:55:08.251679+00	t	f	\N	\N	\N	STANDARD
blog-images	blog-images	\N	2026-03-08 21:55:08.251679+00	2026-03-08 21:55:08.251679+00	t	f	\N	\N	\N	STANDARD
\.


--
-- TOC entry 4714 (class 0 OID 17348)
-- Dependencies: 311
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- TOC entry 4715 (class 0 OID 17361)
-- Dependencies: 312
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4709 (class 0 OID 17221)
-- Dependencies: 306
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-03-08 20:40:50.13852
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-03-08 20:40:50.146106
2	storage-schema	f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd	2026-03-08 20:40:50.154248
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-03-08 20:40:50.175582
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-03-08 20:40:50.183792
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-03-08 20:40:50.187819
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-03-08 20:40:50.193968
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-03-08 20:40:50.198736
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-03-08 20:40:50.203102
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-03-08 20:40:50.209028
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-03-08 20:40:50.213524
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-03-08 20:40:50.217974
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-03-08 20:40:50.222428
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-03-08 20:40:50.2268
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-03-08 20:40:50.231365
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-03-08 20:40:50.253626
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-03-08 20:40:50.258338
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-03-08 20:40:50.262451
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-03-08 20:40:50.266336
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-03-08 20:40:50.272227
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-03-08 20:40:50.276361
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-03-08 20:40:50.283377
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-03-08 20:40:50.297196
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-03-08 20:40:50.308799
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-03-08 20:40:50.313418
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-03-08 20:40:50.318249
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-03-08 20:40:50.322992
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-03-08 20:40:50.326788
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-03-08 20:40:50.330988
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-03-08 20:40:50.334979
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-03-08 20:40:50.339045
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-03-08 20:40:50.342979
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-03-08 20:40:50.347056
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-03-08 20:40:50.350726
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-03-08 20:40:50.354626
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-03-08 20:40:50.35851
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-03-08 20:40:50.362295
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-03-08 20:40:50.366258
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-03-08 20:40:50.371484
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-03-08 20:40:50.381637
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-03-08 20:40:50.387273
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-03-08 20:40:50.391277
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-03-08 20:40:50.39539
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-03-08 20:40:50.399433
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-03-08 20:40:50.404203
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-03-08 20:40:50.409432
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-03-08 20:40:50.442458
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-03-08 20:40:50.447373
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-03-08 20:40:50.451821
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-03-08 20:40:50.477258
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-03-08 20:40:50.486012
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-03-08 20:40:50.633875
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-03-08 20:40:50.636316
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-03-08 20:40:50.651845
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-03-08 20:40:50.654997
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-03-08 20:40:50.656813
56	fix-optimized-search-function	cb58526ebc23048049fd5bf2fd148d18b04a2073	2026-03-08 20:40:50.663607
\.


--
-- TOC entry 4711 (class 0 OID 17239)
-- Dependencies: 308
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata) FROM stdin;
\.


--
-- TOC entry 4712 (class 0 OID 17288)
-- Dependencies: 309
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- TOC entry 4713 (class 0 OID 17302)
-- Dependencies: 310
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- TOC entry 4716 (class 0 OID 17371)
-- Dependencies: 313
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4717 (class 0 OID 17514)
-- Dependencies: 315
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

COPY supabase_migrations.schema_migrations (version, statements, name, created_by, idempotency_key, rollback) FROM stdin;
20260308215337	{"\n-- ============================================================\n-- 1. ENUM TYPES\n-- ============================================================\nCREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');\n\n-- ============================================================\n-- 2. PROFILES\n-- ============================================================\nCREATE TABLE public.profiles (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,\n  full_name TEXT,\n  email TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  is_blocked BOOLEAN DEFAULT false,\n  user_type TEXT DEFAULT 'b2c',\n  company_name TEXT DEFAULT '',\n  approval_status TEXT DEFAULT 'approved',\n  is_approved BOOLEAN DEFAULT true,\n  billing_currency TEXT DEFAULT 'USD',\n  tenant_id UUID\n);\n\n-- ============================================================\n-- 3. USER ROLES (separate table per security best practice)\n-- ============================================================\nCREATE TABLE public.user_roles (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  role app_role NOT NULL,\n  tenant_id UUID,\n  UNIQUE (user_id, role)\n);\n\n-- ============================================================\n-- 4. TENANTS\n-- ============================================================\nCREATE TABLE public.tenants (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  domain TEXT NOT NULL UNIQUE,\n  name TEXT NOT NULL,\n  is_active BOOLEAN DEFAULT true,\n  settings JSONB DEFAULT '{}'::jsonb,\n  provider_group_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 5. PROVIDER GROUPS\n-- ============================================================\nCREATE TABLE public.provider_groups (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL UNIQUE,\n  description TEXT DEFAULT '',\n  providers JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- Add FK from tenants to provider_groups\nALTER TABLE public.tenants\n  ADD CONSTRAINT fk_tenants_provider_group\n  FOREIGN KEY (provider_group_id) REFERENCES public.provider_groups(id) ON DELETE SET NULL;\n\n-- ============================================================\n-- 6. TENANT API KEYS\n-- ============================================================\nCREATE TABLE public.tenant_api_keys (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,\n  api_key TEXT NOT NULL UNIQUE,\n  name TEXT DEFAULT 'Default',\n  is_active BOOLEAN DEFAULT true,\n  rate_limit_per_minute INT DEFAULT 60,\n  last_used_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 7. TENANT API SETTINGS\n-- ============================================================\nCREATE TABLE public.tenant_api_settings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,\n  provider TEXT NOT NULL,\n  is_active BOOLEAN DEFAULT false,\n  settings JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  UNIQUE (tenant_id, provider)\n);\n\n-- ============================================================\n-- 8. TENANT PAYMENT SETTINGS\n-- ============================================================\nCREATE TABLE public.tenant_payment_settings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,\n  provider TEXT NOT NULL,\n  is_active BOOLEAN DEFAULT false,\n  settings JSONB DEFAULT '{}'::jsonb,\n  supported_currencies TEXT[] DEFAULT '{}',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  UNIQUE (tenant_id, provider)\n);\n\n-- ============================================================\n-- 9. API SETTINGS (global)\n-- ============================================================\nCREATE TABLE public.api_settings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  provider TEXT NOT NULL UNIQUE,\n  is_active BOOLEAN DEFAULT true,\n  settings JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 10. FLIGHTS (local inventory)\n-- ============================================================\nCREATE TABLE public.flights (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  airline TEXT NOT NULL,\n  from_city TEXT NOT NULL,\n  to_city TEXT NOT NULL,\n  departure TEXT DEFAULT '',\n  arrival TEXT DEFAULT '',\n  duration TEXT DEFAULT '',\n  price NUMERIC DEFAULT 0,\n  stops INT DEFAULT 0,\n  class TEXT DEFAULT 'Economy',\n  seats INT DEFAULT 100,\n  markup_percentage NUMERIC DEFAULT 0,\n  is_active BOOLEAN DEFAULT true,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 11. HOTELS\n-- ============================================================\nCREATE TABLE public.hotels (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  city TEXT NOT NULL,\n  rating NUMERIC DEFAULT 0,\n  reviews INT DEFAULT 0,\n  price NUMERIC DEFAULT 0,\n  image TEXT,\n  amenities JSONB DEFAULT '[]'::jsonb,\n  stars INT DEFAULT 4,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 12. TOURS\n-- ============================================================\nCREATE TABLE public.tours (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  destination TEXT NOT NULL,\n  duration TEXT DEFAULT '',\n  price NUMERIC DEFAULT 0,\n  category TEXT DEFAULT 'International',\n  rating NUMERIC DEFAULT 0,\n  image TEXT,\n  highlights JSONB DEFAULT '[]'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 13. BOOKINGS\n-- ============================================================\nCREATE TABLE public.bookings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  booking_id TEXT NOT NULL,\n  type TEXT NOT NULL DEFAULT 'Flight',\n  title TEXT NOT NULL,\n  subtitle TEXT,\n  total NUMERIC NOT NULL DEFAULT 0,\n  status TEXT NOT NULL DEFAULT 'Pending',\n  details JSONB DEFAULT '[]'::jsonb,\n  confirmation_number TEXT,\n  confirmation_data JSONB,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 14. AIRPORTS\n-- ============================================================\nCREATE TABLE public.airports (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  iata_code TEXT NOT NULL UNIQUE,\n  name TEXT NOT NULL,\n  city TEXT NOT NULL,\n  country TEXT DEFAULT '',\n  latitude NUMERIC,\n  longitude NUMERIC,\n  is_active BOOLEAN DEFAULT true,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 15. BANNERS\n-- ============================================================\nCREATE TABLE public.banners (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  title TEXT NOT NULL,\n  subtitle TEXT DEFAULT '',\n  image_url TEXT DEFAULT '',\n  link_url TEXT DEFAULT '',\n  is_active BOOLEAN DEFAULT true,\n  sort_order INT DEFAULT 0,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 16. OFFERS\n-- ============================================================\nCREATE TABLE public.offers (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  title TEXT NOT NULL,\n  description TEXT DEFAULT '',\n  discount TEXT DEFAULT '',\n  color TEXT DEFAULT 'primary',\n  is_active BOOLEAN DEFAULT true,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 17. TESTIMONIALS\n-- ============================================================\nCREATE TABLE public.testimonials (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  role TEXT DEFAULT '',\n  text TEXT NOT NULL,\n  rating INT DEFAULT 5,\n  avatar TEXT DEFAULT '',\n  is_active BOOLEAN DEFAULT true,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 18. BLOG CATEGORIES\n-- ============================================================\nCREATE TABLE public.blog_categories (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  slug TEXT NOT NULL UNIQUE,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 19. BLOG POSTS\n-- ============================================================\nCREATE TABLE public.blog_posts (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  title TEXT NOT NULL,\n  slug TEXT NOT NULL UNIQUE,\n  excerpt TEXT,\n  content TEXT NOT NULL DEFAULT '',\n  featured_image TEXT,\n  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,\n  tags JSONB DEFAULT '[]'::jsonb,\n  status TEXT DEFAULT 'draft',\n  author_name TEXT DEFAULT '',\n  published_at TIMESTAMPTZ,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 20. POPULAR ROUTES\n-- ============================================================\nCREATE TABLE public.popular_routes (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  from_code TEXT NOT NULL,\n  to_code TEXT NOT NULL,\n  from_city TEXT DEFAULT '',\n  to_city TEXT DEFAULT '',\n  search_count INT DEFAULT 1,\n  lowest_price NUMERIC DEFAULT 0,\n  currency TEXT DEFAULT 'USD',\n  airline TEXT DEFAULT '',\n  duration TEXT DEFAULT '',\n  stops INT DEFAULT 0,\n  last_searched_at TIMESTAMPTZ DEFAULT now(),\n  UNIQUE (from_code, to_code)\n);\n\n-- ============================================================\n-- 21. WALLET TRANSACTIONS\n-- ============================================================\nCREATE TABLE public.wallet_transactions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  amount NUMERIC NOT NULL DEFAULT 0,\n  type TEXT NOT NULL DEFAULT 'credit',\n  description TEXT DEFAULT '',\n  status TEXT DEFAULT 'completed',\n  reference TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 22. TICKET REQUESTS (reissue/refund)\n-- ============================================================\nCREATE TABLE public.ticket_requests (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  type TEXT NOT NULL DEFAULT 'refund',\n  status TEXT NOT NULL DEFAULT 'pending',\n  reason TEXT DEFAULT '',\n  new_travel_date TEXT,\n  admin_notes TEXT DEFAULT '',\n  quote_amount NUMERIC DEFAULT 0,\n  charges NUMERIC DEFAULT 0,\n  refund_method TEXT,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 23. SAVED PASSENGERS\n-- ============================================================\nCREATE TABLE public.saved_passengers (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  title TEXT DEFAULT '',\n  first_name TEXT NOT NULL,\n  last_name TEXT NOT NULL,\n  dob TEXT DEFAULT '',\n  nationality TEXT DEFAULT '',\n  passport_country TEXT DEFAULT '',\n  passport_number TEXT DEFAULT '',\n  passport_expiry TEXT DEFAULT '',\n  frequent_flyer TEXT DEFAULT '',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 24. AIRLINE SETTINGS\n-- ============================================================\nCREATE TABLE public.airline_settings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  airline_code TEXT NOT NULL UNIQUE,\n  airline_name TEXT DEFAULT '',\n  cabin_baggage TEXT DEFAULT '7 Kg',\n  checkin_baggage TEXT DEFAULT '20 Kg',\n  cancellation_policy TEXT DEFAULT '',\n  date_change_policy TEXT DEFAULT '',\n  name_change_policy TEXT DEFAULT '',\n  no_show_policy TEXT DEFAULT '',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- 25. FLIGHT PRICE CACHE\n-- ============================================================\nCREATE TABLE public.flight_price_cache (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  from_code TEXT NOT NULL,\n  to_code TEXT NOT NULL,\n  travel_date DATE NOT NULL,\n  lowest_price NUMERIC DEFAULT 0,\n  currency TEXT DEFAULT 'USD',\n  source TEXT DEFAULT '',\n  expires_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  UNIQUE (from_code, to_code, travel_date)\n);\n\n-- ============================================================\n-- 26. NEWSLETTER SUBSCRIBERS\n-- ============================================================\nCREATE TABLE public.newsletter_subscribers (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  email TEXT NOT NULL UNIQUE,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- INDEXES\n-- ============================================================\nCREATE INDEX idx_profiles_user_id ON public.profiles(user_id);\nCREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);\nCREATE INDEX idx_bookings_user_id ON public.bookings(user_id);\nCREATE INDEX idx_bookings_tenant_id ON public.bookings(tenant_id);\nCREATE INDEX idx_bookings_status ON public.bookings(status);\nCREATE INDEX idx_airports_iata ON public.airports(iata_code);\nCREATE INDEX idx_airports_active ON public.airports(is_active);\nCREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);\nCREATE INDEX idx_blog_posts_status ON public.blog_posts(status);\nCREATE INDEX idx_wallet_user_id ON public.wallet_transactions(user_id);\nCREATE INDEX idx_ticket_requests_booking ON public.ticket_requests(booking_id);\nCREATE INDEX idx_saved_passengers_user ON public.saved_passengers(user_id);\nCREATE INDEX idx_flight_cache ON public.flight_price_cache(from_code, to_code);\nCREATE INDEX idx_tenant_api_keys_key ON public.tenant_api_keys(api_key);\n"}		ars@travelvela.com	\N	\N
20260308215429	{"\n-- ============================================================\n-- DESTINATIONS TABLE\n-- ============================================================\nCREATE TABLE public.destinations (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  country TEXT DEFAULT '',\n  image_url TEXT,\n  price NUMERIC DEFAULT 0,\n  rating NUMERIC DEFAULT 0,\n  flights INT DEFAULT 0,\n  is_active BOOLEAN DEFAULT true,\n  sort_order INT DEFAULT 0,\n  tenant_id UUID,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- ============================================================\n-- DATABASE FUNCTIONS\n-- ============================================================\n\n-- has_role: check if a user has a specific role\nCREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT EXISTS (\n    SELECT 1 FROM public.user_roles\n    WHERE user_id = _user_id AND role = _role\n  )\n$$;\n\n-- get_admin_tenant_id: returns the tenant_id for an admin user (null = super admin)\nCREATE OR REPLACE FUNCTION public.get_admin_tenant_id(_user_id UUID)\nRETURNS UUID\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT tenant_id FROM public.user_roles\n  WHERE user_id = _user_id AND role = 'admin'\n  LIMIT 1\n$$;\n\n-- get_tenant_wallet_balance: sum wallet transactions for a tenant\nCREATE OR REPLACE FUNCTION public.get_tenant_wallet_balance(_tenant_id UUID)\nRETURNS NUMERIC\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT COALESCE(\n    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END),\n    0\n  )\n  FROM public.wallet_transactions wt\n  JOIN public.profiles p ON p.user_id = wt.user_id\n  WHERE p.tenant_id = _tenant_id\n$$;\n\n-- generate_tenant_api_key: generates a random API key\nCREATE OR REPLACE FUNCTION public.generate_tenant_api_key()\nRETURNS TEXT\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  RETURN 'tvk_' || encode(gen_random_bytes(32), 'hex');\nEND;\n$$;\n\n-- Auto-create profile on signup\nCREATE OR REPLACE FUNCTION public.handle_new_user()\nRETURNS TRIGGER\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.profiles (user_id, full_name, email)\n  VALUES (\n    NEW.id,\n    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),\n    NEW.email\n  );\n  RETURN NEW;\nEND;\n$$;\n\nCREATE OR REPLACE TRIGGER on_auth_user_created\n  AFTER INSERT ON auth.users\n  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();\n\n-- ============================================================\n-- RLS POLICIES\n-- ============================================================\n\n-- PROFILES\nCREATE POLICY \\"Users can view own profile\\" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Users can update own profile\\" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Admins can view all profiles\\" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Admins can update all profiles\\" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Profiles insert on signup\\" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\n\n-- USER ROLES\nCREATE POLICY \\"Admins can manage roles\\" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Users can view own roles\\" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);\n\n-- BOOKINGS\nCREATE POLICY \\"Users can view own bookings\\" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Users can insert own bookings\\" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\nCREATE POLICY \\"Users can update own bookings\\" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Admins can manage all bookings\\" ON public.bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- WALLET TRANSACTIONS\nCREATE POLICY \\"Users can view own wallet\\" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Users can insert wallet txns\\" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\nCREATE POLICY \\"Admins can manage wallet\\" ON public.wallet_transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- SAVED PASSENGERS\nCREATE POLICY \\"Users can manage own passengers\\" ON public.saved_passengers FOR ALL TO authenticated USING (auth.uid() = user_id);\n\n-- TICKET REQUESTS\nCREATE POLICY \\"Users can view own requests\\" ON public.ticket_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Users can create requests\\" ON public.ticket_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\nCREATE POLICY \\"Admins can manage all requests\\" ON public.ticket_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- PUBLIC READ tables (flights, hotels, tours, airports, banners, offers, testimonials, destinations, blog_posts, blog_categories, popular_routes, api_settings, airline_settings)\nCREATE POLICY \\"Public read flights\\" ON public.flights FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage flights\\" ON public.flights FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read hotels\\" ON public.hotels FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage hotels\\" ON public.hotels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read tours\\" ON public.tours FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage tours\\" ON public.tours FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read airports\\" ON public.airports FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Service manage airports\\" ON public.airports FOR ALL TO service_role USING (true);\n\nCREATE POLICY \\"Public read banners\\" ON public.banners FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage banners\\" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read offers\\" ON public.offers FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage offers\\" ON public.offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read testimonials\\" ON public.testimonials FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage testimonials\\" ON public.testimonials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read destinations\\" ON public.destinations FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage destinations\\" ON public.destinations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read blog_posts\\" ON public.blog_posts FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage blog_posts\\" ON public.blog_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read blog_categories\\" ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage blog_categories\\" ON public.blog_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read popular_routes\\" ON public.popular_routes FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage popular_routes\\" ON public.popular_routes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Service manage popular_routes\\" ON public.popular_routes FOR ALL TO service_role USING (true);\n\nCREATE POLICY \\"Public read api_settings\\" ON public.api_settings FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage api_settings\\" ON public.api_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read airline_settings\\" ON public.airline_settings FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Admin manage airline_settings\\" ON public.airline_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public read flight_price_cache\\" ON public.flight_price_cache FOR SELECT TO anon, authenticated USING (true);\nCREATE POLICY \\"Service manage flight_price_cache\\" ON public.flight_price_cache FOR ALL TO service_role USING (true);\n\nCREATE POLICY \\"Anyone can subscribe newsletter\\" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);\nCREATE POLICY \\"Admin read newsletter\\" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- TENANTS\nCREATE POLICY \\"Public read active tenants\\" ON public.tenants FOR SELECT TO anon, authenticated USING (is_active = true);\nCREATE POLICY \\"Admin manage tenants\\" ON public.tenants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- PROVIDER GROUPS\nCREATE POLICY \\"Admin manage provider_groups\\" ON public.provider_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Public read provider_groups\\" ON public.provider_groups FOR SELECT TO anon, authenticated USING (true);\n\n-- TENANT API KEYS\nCREATE POLICY \\"Admin manage tenant_api_keys\\" ON public.tenant_api_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Service manage tenant_api_keys\\" ON public.tenant_api_keys FOR ALL TO service_role USING (true);\n\n-- TENANT API SETTINGS\nCREATE POLICY \\"Admin manage tenant_api_settings\\" ON public.tenant_api_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\nCREATE POLICY \\"Service read tenant_api_settings\\" ON public.tenant_api_settings FOR SELECT TO service_role USING (true);\n\n-- TENANT PAYMENT SETTINGS\nCREATE POLICY \\"Admin manage tenant_payment_settings\\" ON public.tenant_payment_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n"}		ars@travelvela.com	\N	\N
20260308215508	{"\n-- Create storage buckets\nINSERT INTO storage.buckets (id, name, public) VALUES ('ticket-files', 'ticket-files', true) ON CONFLICT (id) DO NOTHING;\nINSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true) ON CONFLICT (id) DO NOTHING;\n\n-- Storage policies for ticket-files\nCREATE POLICY \\"Admins can manage ticket files\\" ON storage.objects FOR ALL TO authenticated\n  USING (bucket_id = 'ticket-files' AND public.has_role(auth.uid(), 'admin'))\n  WITH CHECK (bucket_id = 'ticket-files' AND public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public can read ticket files\\" ON storage.objects FOR SELECT TO anon, authenticated\n  USING (bucket_id = 'ticket-files');\n\n-- Storage policies for blog-images\nCREATE POLICY \\"Admins can manage blog images\\" ON storage.objects FOR ALL TO authenticated\n  USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'))\n  WITH CHECK (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'));\n\nCREATE POLICY \\"Public can read blog images\\" ON storage.objects FOR SELECT TO anon, authenticated\n  USING (bucket_id = 'blog-images');\n"}		ars@travelvela.com	\N	\N
20260308220051	{"\n-- Fix flight_price_cache: add missing columns from CSV\nALTER TABLE public.flight_price_cache \n  ADD COLUMN IF NOT EXISTS cabin_class TEXT DEFAULT 'Economy',\n  ADD COLUMN IF NOT EXISTS adults INT DEFAULT 1,\n  ADD COLUMN IF NOT EXISTS children INT DEFAULT 0,\n  ADD COLUMN IF NOT EXISTS infants INT DEFAULT 0,\n  ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT now();\n\n-- Drop old unique constraint and add new one\nALTER TABLE public.flight_price_cache DROP CONSTRAINT IF EXISTS flight_price_cache_from_code_to_code_travel_date_key;\nALTER TABLE public.flight_price_cache ADD CONSTRAINT flight_price_cache_unique UNIQUE (from_code, to_code, travel_date, cabin_class, adults, children, infants);\n\n-- Create b2b_access_requests table\nCREATE TABLE public.b2b_access_requests (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,\n  request_type TEXT NOT NULL DEFAULT 'api_access',\n  status TEXT NOT NULL DEFAULT 'pending',\n  company_name TEXT DEFAULT '',\n  domain_requested TEXT DEFAULT '',\n  business_justification TEXT DEFAULT '',\n  admin_notes TEXT DEFAULT '',\n  reviewed_by UUID,\n  reviewed_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE POLICY \\"Users can view own b2b requests\\" ON public.b2b_access_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);\nCREATE POLICY \\"Users can create b2b requests\\" ON public.b2b_access_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\nCREATE POLICY \\"Admins can manage b2b requests\\" ON public.b2b_access_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));\n\n-- Add updated_at column to airline_settings  \nALTER TABLE public.airline_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();\n"}		ars@travelvela.com	\N	\N
20260308220249	{"\n-- Insert airline_settings\nINSERT INTO public.airline_settings (id, airline_code, airline_name, cabin_baggage, checkin_baggage, cancellation_policy, date_change_policy, name_change_policy, no_show_policy, created_at)\nVALUES \n  ('db9c328c-1832-4696-97d2-78a618448bdf', 'BG', 'Biman Bangladesh', '7 Kg', '10 Kg', 'Free cancellation within 24 hours of booking', 'As Per Airline', 'As Per Airline', 'As Per Airline', '2026-02-27 19:28:50.106068+00'),\n  ('5ccd4984-08fc-42df-993e-ba05a74191ea', 'CZ', 'China Southern Airlines', '7 Kg', '23 Kg', 'Varies by fare class', 'Varies by fare class', 'Name changes up to 48h before departure ($50 fee)', 'No-show results in full fare forfeiture', '2026-03-03 01:01:54.981512+00'),\n  ('e6f3a985-4038-48fb-9c79-fce4f48fa399', 'MU', 'China Eastern Airlines', '7 Kg', '23 Kg', 'Varies by fare class', 'Varies by fare class', 'Name changes up to 48h before departure ($50 fee)', 'No-show results in full fare forfeiture', '2026-03-03 01:01:54.981512+00')\nON CONFLICT (airline_code) DO NOTHING;\n\n-- Insert blog_categories\nINSERT INTO public.blog_categories (id, name, slug, created_at)\nVALUES \n  ('3a9b8b75-ae21-45e3-bf74-a384599f3aa7', 'Travel', 'travel', '2026-03-01 09:05:39.072992+00'),\n  ('84365e96-700a-4c88-9a13-e70541f5c70d', 'Tour', 'tour', '2026-03-01 09:05:51.01216+00'),\n  ('9ed6ef1d-b5e1-4b2a-8eb1-6a113d2bc08f', 'Flight', 'flight', '2026-03-01 09:06:01.090816+00'),\n  ('fcfee9c2-1794-4aa5-8bf4-0fa8cb6f7449', 'Travel Tips', 'travel-tips', '2026-03-01 09:42:04.598627+00'),\n  ('6d5340c9-e7dc-45c6-aa19-39688f54a566', 'Destinations', 'destinations', '2026-03-01 09:42:04.598627+00'),\n  ('1994ecc8-0228-4491-9fa7-00d150bd89bc', 'Budget Travel', 'budget-travel', '2026-03-01 09:42:04.598627+00')\nON CONFLICT (slug) DO NOTHING;\n\n-- Insert banners\nINSERT INTO public.banners (id, title, subtitle, image_url, link_url, is_active, sort_order, created_at)\nVALUES\n  ('fd065a59-ebd2-4031-af79-e1ea7e2b4e6a', 'banner 2', '', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', true, 2, '2026-03-01 10:12:00.403651+00'),\n  ('a1bee4a8-8888-4339-ae15-c306d2e6508a', 'offer', '', 'https://travelvela-html.vercel.app/images/offer-banner/1.avif', 'https://travelvela-html.vercel.app/pricing.html', true, 1, '2026-03-01 10:11:33.554895+00'),\n  ('63cec0cf-4d64-4e0d-8239-8ea2abff26ae', 'gfd', '', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', true, 3, '2026-03-01 10:12:20.586118+00')\nON CONFLICT (id) DO NOTHING;\n\n-- Insert api_settings\nINSERT INTO public.api_settings (id, provider, settings, is_active, created_at)\nVALUES\n  ('b1ab890f-ca84-4e18-b41a-78e97ff3db46', 'local_inventory', '{\\"type\\":\\"flights\\"}', false, '2026-02-27 16:38:01.442505+00'),\n  ('86430c54-38ec-4282-bde4-11e3d9fd7999', 'travelvela', '{}', false, '2026-02-28 20:42:07.55977+00'),\n  ('f473fc93-a72f-44f1-81fa-e1f45fbb9bcd', 'flight_markup', '{\\"type\\":\\"percentage\\",\\"value\\":5}', true, '2026-02-27 18:45:28.747665+00'),\n  ('cea2d7cc-4846-4ded-8089-69179598d7c2', 'site_general', '{\\"default_currency\\":\\"BDT\\",\\"default_language\\":\\"English\\",\\"maintenance_mode\\":false,\\"show_prices_bdt\\":true,\\"site_name\\":\\"Travel Vela\\",\\"tagline\\":\\"Travel Simply\\",\\"user_registration\\":true}', true, '2026-03-01 09:27:03.782371+00'),\n  ('fe1d91f8-303f-4ade-8c19-d34e40991f8c', 'taxes_fees', '{\\"convenience_fee_percentage\\":0,\\"service_fee\\":0,\\"tax_percentage\\":0}', true, '2026-02-27 20:26:59.851389+00'),\n  ('726ce839-62ce-4330-9bfa-59981115d120', 'travelvela_hotel', '{}', true, '2026-03-05 21:49:50.643685+00'),\n  ('c891a08b-0f11-4606-aefb-b5b64edd973e', 'tripjack_hotel', '{\\"environment\\":\\"production\\",\\"production_host\\":\\"api.tripjack.com\\"}', false, '2026-03-05 19:39:50.068189+00'),\n  ('f718222f-4d41-4663-b467-726609312e14', 'ait_settings', '{\\"per_api\\":{\\"amadeus\\":0,\\"travelport\\":0.3,\\"travelvela\\":0,\\"tripjack\\":0}}', true, '2026-03-08 08:27:59.985811+00'),\n  ('ed401a06-4015-44c8-ab6a-9071e888e518', 'amadeus', '{\\"environment\\":\\"test\\"}', false, '2026-02-27 16:36:07.813547+00'),\n  ('f3d8950d-f005-4f0c-ae3a-1b581391fb77', 'travelport', '{\\"endpoint\\":\\"https://apac.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService\\",\\"environment\\":\\"production\\",\\"student_fare_enabled\\":true}', true, '2026-02-27 15:30:28.453661+00'),\n  ('e7239b98-8cf9-4fb1-9a89-54f66f72282e', 'tripjack_flight', '{\\"environment\\":\\"production\\"}', true, '2026-03-05 20:16:27.587296+00'),\n  ('9dc9f7ff-78a7-4616-a632-36b93be3a226', 'site_apps', '{\\"crisp_enabled\\":true,\\"crisp_website_id\\":\\"7b6ec17d-256a-41e8-9732-17ff58bd51e9\\",\\"google_place_id\\":\\"\\",\\"google_reviews\\":false,\\"tawkto\\":false,\\"tawkto_id\\":\\"\\",\\"whatsapp_number\\":\\"\\",\\"whatsapp_widget\\":true}', true, '2026-03-08 09:41:25.106574+00'),\n  ('0d90080f-6179-4127-b6ee-b5663bda7ac9', 'site_payment', '{\\"bank_transfer_enabled\\":true,\\"bkash_enabled\\":true,\\"nagad_enabled\\":false,\\"sandbox_mode\\":true,\\"stripe_enabled\\":false,\\"stripe_pk\\":\\"\\",\\"stripe_sk\\":\\"\\"}', true, '2026-03-04 15:08:48.583663+00'),\n  ('dd65d03a-8493-4af0-b682-0ffdcde4700c', 'site_contact', '{\\"address\\":\\"Bashori Bhaban, Police Line Road, Barishal\\",\\"business_name\\":\\"Travel Vela\\",\\"civil_aviation_license\\":\\"\\",\\"email\\":\\"\\",\\"iata_number\\":\\"\\",\\"maps_url\\":\\"\\",\\"phone\\":\\"01870802030\\",\\"whatsapp\\":\\"\\"}', true, '2026-03-04 16:45:21.513499+00'),\n  ('5bcc887b-62df-4e43-a568-32df0edd0be6', 'api_markup', '{\\"airline_markups\\":{},\\"markup_percentage\\":2,\\"per_api\\":{\\"amadeus\\":{\\"airlines\\":{},\\"global\\":1},\\"travelport\\":{\\"airlines\\":{},\\"global\\":2},\\"travelvela\\":{\\"airlines\\":{},\\"global\\":1},\\"tripjack\\":{\\"airlines\\":{},\\"global\\":3}}}', true, '2026-02-27 19:00:53.475606+00'),\n  ('c045246d-3197-475c-88cf-7c949ebee186', 'site_branding', '{\\"accent_color\\":\\"#10b981\\",\\"color_accent\\":\\"#ff6b2c\\",\\"color_accent_foreground\\":\\"#ffffff\\",\\"color_background\\":\\"#f7fafd\\",\\"color_border\\":\\"#d0e3f2\\",\\"color_card\\":\\"#ffffff\\",\\"color_card_foreground\\":\\"#0a1929\\",\\"color_destructive\\":\\"#e53935\\",\\"color_foreground\\":\\"#0a1929\\",\\"color_muted\\":\\"#edf3f8\\",\\"color_muted_foreground\\":\\"#5a7a99\\",\\"color_primary\\":\\"#0092ff\\",\\"color_primary_foreground\\":\\"#ffffff\\",\\"color_secondary\\":\\"#e8f4ff\\",\\"color_secondary_foreground\\":\\"#003d6b\\",\\"favicon_url\\":\\"https://travelvela-html.vercel.app/images/favicon.png\\",\\"footer_text\\":\\"© 2026 Travel Vela. All rights reserved.\\",\\"logo_url\\":\\"https://travelvela-html.vercel.app/images/logo.png\\",\\"primary_color\\":\\"#0092ff\\",\\"secondary_color\\":\\"#f59e0b\\"}', true, '2026-03-01 09:28:10.92761+00')\nON CONFLICT (provider) DO UPDATE SET settings = EXCLUDED.settings, is_active = EXCLUDED.is_active;\n"}		ars@travelvela.com	\N	\N
20260308220351	{"\n-- Insert remaining api_settings (currency_rates with live rates)\nINSERT INTO public.api_settings (id, provider, settings, is_active, created_at)\nVALUES\n  ('1f615d7b-d9dc-4786-933e-1f154b28f0f3', 'currency_rates', '{\\"api_source_currencies\\":{\\"amadeus\\":\\"USD\\",\\"local_inventory\\":\\"USD\\",\\"travelport\\":\\"BDT\\",\\"travelvela\\":\\"BDT\\"},\\"conversion_markup\\":3,\\"last_fetched\\":\\"2026-03-04T10:37:03.477Z\\",\\"live_rates\\":{\\"AED\\":3.6725,\\"AUD\\":1.421306,\\"BDT\\":122.299479,\\"CAD\\":1.368024,\\"CNY\\":6.915072,\\"EUR\\":0.860948,\\"GBP\\":0.749722,\\"HKD\\":7.804472,\\"INR\\":92.108456,\\"JPY\\":157.706313,\\"KRW\\":1477.311478,\\"MYR\\":3.942914,\\"NPR\\":147.37432,\\"NZD\\":1.697866,\\"PKR\\":279.490668,\\"QAR\\":3.64,\\"SAR\\":3.75,\\"SGD\\":1.277508,\\"THB\\":31.653168,\\"TRY\\":43.966313,\\"USD\\":1}}', true, '2026-02-27 17:39:10.336609+00'),\n  ('d02d3ca5-69d9-49e4-b3ed-5e5a5b2cdec1', 'airline_commissions', '{\\"rules\\":[{\\"airline_code\\":\\"QR\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":5.7,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"EK\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"SQ\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"MH\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":5.5,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"BG\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"CA\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6.3,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"CZ\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6.3,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"TG\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6.4,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"},{\\"airline_code\\":\\"MU\\",\\"api_source\\":\\"travelport\\",\\"commission_pct\\":6.4,\\"destination\\":\\"\\",\\"markup_pct\\":0,\\"module\\":\\"flights\\",\\"origin\\":\\"DAC\\",\\"profit_type\\":\\"percentage\\",\\"type\\":\\"commission\\"}]}', true, '2026-03-02 23:41:31.101687+00')\nON CONFLICT (provider) DO UPDATE SET settings = EXCLUDED.settings, is_active = EXCLUDED.is_active;\n\n-- Insert blog posts\nINSERT INTO public.blog_posts (id, title, slug, excerpt, content, featured_image, category_id, tags, status, author_name, published_at, created_at)\nVALUES\n  ('73617487-4d29-4344-a639-667d8dccff7c', '10 Must-Know Tips for First-Time International Travelers', '10-tips-first-time-international-travelers', 'Planning your first trip abroad? These essential tips will help you navigate airports, currencies, and cultures like a pro.', '<h2>Traveling Abroad for the First Time?</h2><p>International travel can be both exciting and overwhelming.</p><h3>1. Check Passport Validity</h3><p>Many countries require your passport to be valid for at least 6 months beyond your travel dates.</p><h3>2. Research Visa Requirements</h3><p>Some destinations offer visa-on-arrival, while others require advance applications.</p><h3>3. Get Travel Insurance</h3><p>Medical emergencies abroad can be incredibly expensive.</p><h3>4. Notify Your Bank</h3><p>Let your bank know about your travel plans.</p><h3>5. Pack Light</h3><p>Stick to versatile clothing and leave room for souvenirs.</p><h3>6. Learn Basic Phrases</h3><p>A simple hello and thank you in the local language goes a long way.</p><h3>7. Keep Digital Copies</h3><p>Scan your passport, tickets, and hotel confirmations.</p><h3>8. Stay Connected</h3><p>Consider getting a local SIM card or an international data plan.</p><h3>9. Be Aware of Local Customs</h3><p>Research cultural norms to avoid unintentional faux pas.</p><h3>10. Enjoy the Journey</h3><p>Leave room for spontaneous adventures.</p>', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800', 'fcfee9c2-1794-4aa5-8bf4-0fa8cb6f7449', '[\\"tips\\",\\"international\\",\\"beginners\\"]', 'published', 'Travel Team', '2026-02-27 09:43:10.905303+00', '2026-03-01 09:43:10.905303+00'),\n  ('441524eb-6417-407a-b62d-cef1237bbebf', 'Top 5 Budget-Friendly Destinations for 2026', 'top-5-budget-friendly-destinations-2026', 'Dreaming of a vacation that won''t break the bank? These stunning destinations offer incredible experiences at a fraction of the cost.', '<h2>Travel More, Spend Less</h2><p>You don''t need a massive budget to explore the world.</p><h3>1. Vietnam</h3><p>World-class experiences for under $40/day.</p><h3>2. Portugal</h3><p>Stunning coastlines, rich history, and incredible cuisine at lower prices.</p><h3>3. Colombia</h3><p>One of South America''s hottest destinations.</p><h3>4. Georgia</h3><p>Breathtaking mountain scenery and legendary hospitality.</p><h3>5. Sri Lanka</h3><p>Beaches, temples, tea plantations, and wildlife safaris.</p>', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', '1994ecc8-0228-4491-9fa7-00d150bd89bc', '[\\"budget\\",\\"destinations\\",\\"2026\\"]', 'published', 'Travel Team', '2026-02-24 09:43:10.905303+00', '2026-03-01 09:43:10.905303+00'),\n  ('4d5df5a6-c5a4-4340-815f-61a933028809', 'Exploring the Magic of Santorini: A Travel Diary', 'exploring-magic-of-santorini', 'White-washed buildings, stunning sunsets, and crystal-clear waters — discover why Santorini remains one of the world''s most enchanting destinations.', '<h2>A Week in Paradise</h2><p>Santorini has been on my bucket list for years, and it did not disappoint.</p><h3>Day 1-2: Oia</h3><p>Famous for its blue-domed churches and spectacular sunsets.</p><h3>Day 3-4: Fira & Hiking</h3><p>The hike from Fira to Oia offers panoramic views.</p><h3>Day 5: Beach Day</h3><p>Red Beach with its dramatic crimson cliffs.</p><h3>Day 6-7: Food & Culture</h3><p>Fresh seafood and Assyrtiko wine from local vineyards.</p>', 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800', '6d5340c9-e7dc-45c6-aa19-39688f54a566', '[\\"santorini\\",\\"greece\\",\\"destinations\\",\\"diary\\"]', 'published', 'Sarah Mitchell', '2026-02-26 09:43:10.905303+00', '2026-03-01 09:43:10.905303+00'),\n  ('c33a33f7-5562-40c4-8d1f-f389c2e99562', 'The Ultimate Dubai Travel Guide for 2026', 'ultimate-dubai-travel-guide-2026', 'From towering skyscrapers to ancient souks, Dubai blends tradition and futurism like no other city.', '<h2>Welcome to the City of the Future</h2><p>Dubai is a city that defies expectations at every turn.</p><h3>Must-See Attractions</h3><p>Burj Khalifa, Dubai Mall, Old Dubai.</p><h3>Best Time to Visit</h3><p>November to March offers the most pleasant weather.</p><h3>Getting Around</h3><p>The Dubai Metro is clean, efficient, and affordable.</p><h3>Food Scene</h3><p>Dubai''s dining scene is world-class.</p>', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800', '6d5340c9-e7dc-45c6-aa19-39688f54a566', '[\\"dubai\\",\\"guide\\",\\"destinations\\"]', 'published', 'Travel Team', '2026-02-22 09:43:10.905303+00', '2026-03-01 09:43:10.905303+00'),\n  ('1c6ffa04-248a-4732-97e4-57ef4cb3f0e5', 'How to Find the Cheapest Flights: A Complete Guide', 'how-to-find-cheapest-flights-guide', 'Unlock the secrets to scoring the best flight deals with these proven strategies.', '<h2>Stop Overpaying for Flights</h2><p>Flight prices can vary dramatically depending on when and how you book.</p><h3>Be Flexible with Dates</h3><p>Flying mid-week is often significantly cheaper.</p><h3>Book at the Right Time</h3><p>For domestic flights, booking 1-3 months in advance typically yields the best prices.</p><h3>Use Incognito Mode</h3><p>Airlines and booking sites may track your searches.</p><h3>Consider Nearby Airports</h3><p>Flying into a secondary airport can save you hundreds.</p><h3>Set Price Alerts</h3><p>Use fare tracking tools to monitor prices.</p>', 'https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=800', '9ed6ef1d-b5e1-4b2a-8eb1-6a113d2bc08f', '[\\"flights\\",\\"deals\\",\\"tips\\"]', 'published', 'Travel Team', '2026-03-01 10:05:15.176+00', '2026-03-01 09:43:10.905303+00')\nON CONFLICT (slug) DO NOTHING;\n"}		ars@travelvela.com	\N	\N
20260308220555	{"\n-- Create hotel_interactions table\nCREATE TABLE IF NOT EXISTS public.hotel_interactions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  hotel_id text NOT NULL,\n  hotel_name text NOT NULL DEFAULT '',\n  city text NOT NULL DEFAULT '',\n  stars integer DEFAULT 0,\n  action text NOT NULL DEFAULT 'view',\n  session_id uuid,\n  user_id uuid,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\n-- RLS\nALTER TABLE public.hotel_interactions ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY \\"Public insert hotel_interactions\\" ON public.hotel_interactions FOR INSERT WITH CHECK (true);\nCREATE POLICY \\"Admin read hotel_interactions\\" ON public.hotel_interactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));\nCREATE POLICY \\"Service manage hotel_interactions\\" ON public.hotel_interactions FOR ALL USING (true);\n\n-- Add missing profile columns\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_address text DEFAULT '';\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade_license text DEFAULT '';\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by uuid;\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();\n"}		ars@travelvela.com	\N	\N
20260308220938	{"\n-- Add missing columns\nALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;\nALTER TABLE public.popular_routes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();\n\n-- Hotels data\nINSERT INTO public.hotels (id, name, city, rating, reviews, price, image, amenities, stars, is_active, created_at)\nVALUES\n('ada54958-ce57-476d-9e72-5ea76e7a13a2','Grand Palace Hotel','Paris',4.8,2340,250,'dest-paris','[\\"WiFi\\",\\"Pool\\",\\"Spa\\",\\"Restaurant\\",\\"Gym\\"]'::jsonb,5,true,'2026-02-27 13:11:27.452392+00'),\n('91514563-23a8-46d1-b4e4-eb09d3c8b781','Tokyo Bay Resort','Tokyo',4.7,1890,180,'dest-tokyo','[\\"WiFi\\",\\"Restaurant\\",\\"Bar\\",\\"Gym\\"]'::jsonb,4,true,'2026-02-27 13:11:27.452392+00'),\n('c57ae804-0fcb-4a11-ac4e-ad3efed45ff7','Bali Zen Villas','Bali',4.9,3200,320,'dest-bali','[\\"WiFi\\",\\"Pool\\",\\"Spa\\",\\"Restaurant\\",\\"Beach Access\\"]'::jsonb,5,true,'2026-02-27 13:11:27.452392+00'),\n('5dd36b87-dea0-4eb9-8a05-aa450caa6634','Burj View Suites','Dubai',4.6,1560,400,'dest-dubai','[\\"WiFi\\",\\"Pool\\",\\"Spa\\",\\"Restaurant\\",\\"Gym\\",\\"Bar\\"]'::jsonb,5,true,'2026-02-27 13:11:27.452392+00'),\n('c7c236c9-0a3b-46f3-86cc-0ec9d3873564','Aegean Blue Hotel','Santorini',4.8,980,280,'dest-santorini','[\\"WiFi\\",\\"Pool\\",\\"Restaurant\\",\\"Sea View\\"]'::jsonb,4,true,'2026-02-27 13:11:27.452392+00'),\n('4532d67d-5b5e-4de3-b312-64f6fe266d33','Manhattan Central Inn','New York',4.4,4100,199,'dest-newyork','[\\"WiFi\\",\\"Restaurant\\",\\"Gym\\",\\"Bar\\"]'::jsonb,4,true,'2026-02-27 13:11:27.452392+00')\nON CONFLICT (id) DO NOTHING;\n\n-- Offers data\nINSERT INTO public.offers (id, title, description, discount, color, is_active, created_at)\nVALUES\n('ae8a3435-022a-41b6-b965-618e01322c93','Summer Sale','Flights & Hotels','40% OFF','primary',true,'2026-03-03 07:59:54.161211+00'),\n('79865e24-f964-4266-abd1-6f41771a1755','Hotel Deals','Luxury stays at budget prices','10% OFF','accent',true,'2026-03-03 07:59:54.161211+00'),\n('9f137e8a-07da-4922-a64b-1634e00ea357','Honeymoon Special','Free room upgrade on packages','FREE UPGRADE','success',true,'2026-03-03 07:59:54.161211+00')\nON CONFLICT (id) DO NOTHING;\n\n-- Provider groups data\nINSERT INTO public.provider_groups (id, name, description, providers, created_at)\nVALUES\n('cb3d35b4-00e5-45d9-9ab9-ff2f091b7e0c','APAC','Asia-Pacific region — Travelport + Tripjack','{\\"amadeus\\":false,\\"travelport\\":true,\\"travelvela\\":false,\\"tripjack\\":true}'::jsonb,'2026-03-07 18:45:43.151033+00'),\n('5b78950f-9b8e-4048-91d5-076d65814ac2','Europe','Europe region — Amadeus + Travelport','{\\"amadeus\\":true,\\"travelport\\":true,\\"travelvela\\":false,\\"tripjack\\":false}'::jsonb,'2026-03-07 18:45:43.151033+00'),\n('447d9a4c-4ebd-4ec9-a20c-9689d77ffdb4','Global','Full access to all providers','{\\"amadeus\\":true,\\"travelport\\":true,\\"travelvela\\":true,\\"tripjack\\":true}'::jsonb,'2026-03-07 18:45:43.151033+00')\nON CONFLICT (id) DO NOTHING;\n\n-- Popular routes data\nINSERT INTO public.popular_routes (id, from_code, to_code, from_city, to_city, search_count, lowest_price, currency, airline, duration, stops, last_searched_at, created_at)\nVALUES\n('58612889-1634-4a08-832b-6be035f8352d','DAC','CGP','Dhaka','Chittagong',38,4500,'BDT','BG','45m',0,'2026-03-03 13:58:40.627823+00','2026-03-03 13:58:40.627823+00'),\n('90bb15ed-8320-47d6-b9fa-2a6de70f43c3','DAC','MLE','DAC','DAC',1,47490,'INR','8D','24h 16m',3,'2026-03-08 09:06:25.496583+00','2026-03-08 09:06:25.496583+00'),\n('1280e38f-048e-49dd-8ddb-44bc34a11008','DAC','KUL','Dhaka','Kuala Lumpur',25,28500,'BDT','MH','4h 15m',0,'2026-03-03 13:58:40.627823+00','2026-03-03 13:58:40.627823+00'),\n('65df622b-4b21-4ffa-a424-b7ef2b0b7029','DAC','DXB','DAC','DXB',49,28217,'INR','AI','8h 30m',1,'2026-03-08 10:49:21.676184+00','2026-03-03 13:55:25.780713+00'),\n('9cd0464c-8e49-4e92-a49b-fd2ebcd37e7f','DAC','ROR','DAC','ROR',12,225392,'INR','CZ','41h 0m',2,'2026-03-06 21:03:01.275356+00','2026-03-06 20:50:47.660625+00'),\n('71395c88-f9cd-4784-8626-ce1beb500a11','DAC','FCO','DAC','FCO',9,38787,'INR','MU','33h 35m',2,'2026-03-06 21:16:24.061608+00','2026-03-06 21:03:59.395375+00'),\n('58b94490-d5b6-4f08-8192-bc2e9c984e26','CKG','DAC','CKG','DAC',1,44728,'BDT','CZ','20h 15m',1,'2026-03-08 16:18:52.395111+00','2026-03-08 16:18:52.395111+00'),\n('c75ed1f3-220e-49f5-83cb-41b64b6fe915','DAC','CAN','DAC','CAN',33,22063,'INR','6E','7h 50m',1,'2026-03-08 16:53:09.579912+00','2026-03-04 15:07:36.975762+00'),\n('bd8c88da-2daa-4da7-a9ef-593d070e081e','DAC','CKG','DAC','CKG',127,24953,'INR','MU','17h 30m',1,'2026-03-08 17:41:08.363734+00','2026-03-03 18:27:42.29487+00'),\n('8e9a64db-d3cb-4593-8cce-52b7fe42513e','DAC','DAC','DAC','USM',1,215161,'BDT','SQ','7h 5m',1,'2026-03-08 17:42:29.05368+00','2026-03-08 17:42:29.05368+00'),\n('263188a7-0dd1-4610-8f08-7526f867342a','DAC','BKK','DAC','DAC',23,22800,'BDT','TG','3h 30m',0,'2026-03-08 17:48:05.017973+00','2026-03-03 13:58:40.627823+00'),\n('86644807-bef0-45ea-bbdd-c11586fb0e43','DAC','PVG','DAC','PVG',1,30051,'BDT','MU','6h 40m',1,'2026-03-03 20:23:21.341559+00','2026-03-03 20:23:21.341559+00'),\n('e531f8ba-5111-468c-afc0-c5090a1159c0','DAC','CDG','DAC','CDG',18,38787,'INR','MU','20h 55m',2,'2026-03-06 21:49:02.63136+00','2026-03-06 21:21:07.840801+00'),\n('19d11d50-eed4-492c-b46f-ef03229fd8a4','DAC','CXB','DAC','CXB',41,5049,'BDT','BS','1h 5m',0,'2026-03-05 21:39:27.494046+00','2026-03-03 13:58:40.627823+00'),\n('7ba08535-90fc-4dd1-9b25-c64742456e79','DAC','SIN','DAC','SIN',16,31200,'BDT','SQ','4h 45m',0,'2026-03-04 13:28:36.503955+00','2026-03-03 13:58:40.627823+00'),\n('8daed13b-42a7-4cb9-86d8-3f4820dc885f','CAN','DAC','CAN','DAC',2,18267,'BDT','UL','11h 30m',1,'2026-03-04 16:17:51.670869+00','2026-03-04 15:10:31.704778+00'),\n('3aad3311-3037-4232-bc99-0f05c0f3db50','DAC','DEL','DAC','DEL',63,10720,'INR','6E','16h 10m',1,'2026-03-07 21:34:04.111952+00','2026-03-07 16:27:37.090335+00'),\n('5561811f-f33c-4937-9575-354e2ae1a665','DAC','CCU','DAC','CCU',42,6259,'INR','6E','1h 5m',0,'2026-03-07 21:53:11.216374+00','2026-03-06 20:17:07.88747+00'),\n('0696343e-77cc-4797-a7f6-25ef573c288a','DAC','SHJ','DAC','SHJ',1,39426,'INR','X1','15h 35m',1,'2026-03-07 16:03:43.317328+00','2026-03-07 16:03:43.317328+00')\nON CONFLICT (id) DO NOTHING;\n\n-- Hotel interactions data\nINSERT INTO public.hotel_interactions (id, hotel_id, hotel_name, city, stars, action, session_id, user_id, created_at)\nVALUES\n('a367edbc-9855-4e17-a204-dad8d913744a','hsid6808994338-41618602','SAPPHIRE GUEST HOUSE','Kolkata',3,'view','e119e407-2eda-40d4-ac9c-0657ef70462d',NULL,'2026-03-05 23:08:25.220511+00'),\n('3dd3baa2-497c-4f44-9f04-fbea424d94ec','hsid6808994338-41618602','SAPPHIRE GUEST HOUSE','Kolkata',3,'view','e119e407-2eda-40d4-ac9c-0657ef70462d',NULL,'2026-03-05 23:08:44.917506+00'),\n('5dca3e48-deee-477b-b115-f485751060aa','hsid6808994338-41618602','SAPPHIRE GUEST HOUSE','Kolkata',3,'view','e119e407-2eda-40d4-ac9c-0657ef70462d',NULL,'2026-03-05 23:11:11.326032+00'),\n('2058e9bb-d37c-49fc-979b-64f150d7f9a7','hsid1673366645-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'view','3f080520-9a8b-432c-b315-de5d0c2999c2',NULL,'2026-03-05 23:11:43.05981+00'),\n('71411a55-dfae-46b5-9edc-fc6a60a439f3','hsid1673366645-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'click','3f080520-9a8b-432c-b315-de5d0c2999c2',NULL,'2026-03-05 23:11:43.46401+00'),\n('7c250dff-9aa3-4aef-86b9-b7a25534d94e','hsid6808994338-41618602','SAPPHIRE GUEST HOUSE','Kolkata',3,'view','e119e407-2eda-40d4-ac9c-0657ef70462d',NULL,'2026-03-05 23:14:22.74352+00'),\n('05ebb2ca-133d-455b-a6f7-ee06941559a8','hsid6701909147-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'view','9d587638-caa6-4100-86fe-93568d37277f',NULL,'2026-03-05 23:15:36.965854+00'),\n('1c0275f7-32f6-45d2-9990-817004835e02','hsid6701909147-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'click','9d587638-caa6-4100-86fe-93568d37277f',NULL,'2026-03-05 23:15:36.995855+00'),\n('7a1e8475-8cd2-4cc0-bbb7-89f31b52ab90','hsid6808994338-41618602','SAPPHIRE GUEST HOUSE','Kolkata',3,'view','e119e407-2eda-40d4-ac9c-0657ef70462d',NULL,'2026-03-05 23:18:38.581788+00'),\n('7b2996c2-b32b-4ae7-8340-4a321bfe0b25','hsid7585180694-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'view','3614ea92-b9d6-4430-909a-a8894f449fd9',NULL,'2026-03-06 06:56:36.878553+00'),\n('60e1dca5-9209-4906-a130-878b09d32b3e','hsid7585180694-31981013','ITC Royal Bengal, a Luxury Collection Hotel, Kolkata','Kolkata',5,'click','3614ea92-b9d6-4430-909a-a8894f449fd9',NULL,'2026-03-06 06:56:36.878551+00'),\n('d02b0599-50c3-4bab-86b8-edd6041b523a','hsid3218963219-16312832','ITC Sonar, a Luxury Collection Hotel, Kolkata','Kolkata',5,'view','b53804f9-8e54-4026-bb1e-a1bbd927e044',NULL,'2026-03-07 14:05:09.509215+00'),\n('f042a581-0114-4c0b-ac00-de2ccbb56f51','hsid3218963219-16312832','ITC Sonar, a Luxury Collection Hotel, Kolkata','Kolkata',5,'view','b53804f9-8e54-4026-bb1e-a1bbd927e044',NULL,'2026-03-07 14:05:09.647456+00'),\n('15ebddb7-f2aa-46eb-91f8-b018b9d35ca5','hsid3218963219-16312832','ITC Sonar, a Luxury Collection Hotel, Kolkata','Kolkata',5,'click','b53804f9-8e54-4026-bb1e-a1bbd927e044',NULL,'2026-03-07 14:05:09.725789+00')\nON CONFLICT (id) DO NOTHING;\n"}		ars@travelvela.com	\N	\N
20260308221431	{"\n-- Create tour_inquiries table\nCREATE TABLE IF NOT EXISTS public.tour_inquiries (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  visitor_name text NOT NULL DEFAULT '',\n  visitor_email text NOT NULL DEFAULT '',\n  visitor_phone text DEFAULT '',\n  destination text DEFAULT '',\n  travel_dates text DEFAULT '',\n  duration text DEFAULT '',\n  travelers integer DEFAULT 1,\n  budget text DEFAULT '',\n  interests text DEFAULT '',\n  ai_itinerary text DEFAULT '',\n  status text NOT NULL DEFAULT 'pending',\n  admin_notes text DEFAULT '',\n  source text DEFAULT 'website',\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nALTER TABLE public.tour_inquiries ENABLE ROW LEVEL SECURITY;\nCREATE POLICY \\"Public insert tour_inquiries\\" ON public.tour_inquiries FOR INSERT WITH CHECK (true);\nCREATE POLICY \\"Admin manage tour_inquiries\\" ON public.tour_inquiries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));\n\n-- Create tripjack_cities table\nCREATE TABLE IF NOT EXISTS public.tripjack_cities (\n  id integer PRIMARY KEY,\n  city_name text NOT NULL DEFAULT '',\n  country_name text DEFAULT '',\n  type text DEFAULT 'CITY',\n  full_region_name text DEFAULT '',\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\nALTER TABLE public.tripjack_cities ENABLE ROW LEVEL SECURITY;\nCREATE POLICY \\"Public read tripjack_cities\\" ON public.tripjack_cities FOR SELECT USING (true);\nCREATE POLICY \\"Service manage tripjack_cities\\" ON public.tripjack_cities FOR ALL USING (true);\n\n-- Create tripjack_hotels table\nCREATE TABLE IF NOT EXISTS public.tripjack_hotels (\n  tj_hotel_id bigint PRIMARY KEY,\n  unica_id bigint,\n  name text NOT NULL DEFAULT '',\n  rating integer DEFAULT 0,\n  property_type text DEFAULT 'Hotel',\n  city_name text DEFAULT '',\n  city_code text DEFAULT '',\n  state_name text DEFAULT '',\n  country_name text DEFAULT '',\n  country_code text DEFAULT '',\n  latitude numeric,\n  longitude numeric,\n  address text DEFAULT '',\n  postal_code text DEFAULT '',\n  image_url text DEFAULT '',\n  is_deleted boolean DEFAULT false,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n);\n\nALTER TABLE public.tripjack_hotels ENABLE ROW LEVEL SECURITY;\nCREATE POLICY \\"Public read tripjack_hotels\\" ON public.tripjack_hotels FOR SELECT USING (true);\nCREATE POLICY \\"Service manage tripjack_hotels\\" ON public.tripjack_hotels FOR ALL USING (true);\n\n-- Add is_active to tours if missing\nALTER TABLE public.tours ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;\nALTER TABLE public.tours ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();\n\n-- Import tours data\nINSERT INTO public.tours (id, name, destination, duration, price, category, rating, image, highlights, is_active, created_at)\nVALUES\n('2650592a-505c-4635-9cb4-229c7b5dab4e','Romantic Paris','Paris','5 Days',1299,'International',4.8,'dest-paris','[\\"Eiffel Tower\\",\\"Louvre Museum\\",\\"Seine Cruise\\",\\"Montmartre\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00'),\n('5b8c4132-c606-4420-80b0-e3d871f68167','Japan Explorer','Tokyo','7 Days',2499,'International',4.9,'dest-tokyo','[\\"Mt. Fuji\\",\\"Shibuya\\",\\"Kyoto Temples\\",\\"Osaka Street Food\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00'),\n('093b5c1b-5bd6-4889-b929-f44d6d10aeb5','Bali Paradise','Bali','6 Days',1599,'International',4.7,'dest-bali','[\\"Rice Terraces\\",\\"Uluwatu Temple\\",\\"Snorkeling\\",\\"Ubud Market\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00'),\n('1ec17db4-629f-4e79-b485-883c8c320652','Dubai Luxury','Dubai','4 Days',1899,'International',4.6,'dest-dubai','[\\"Burj Khalifa\\",\\"Desert Safari\\",\\"Dubai Mall\\",\\"Palm Jumeirah\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00'),\n('46d2c47f-6ee9-4fb4-a9b8-cd3ebd495d32','Greek Islands','Santorini','5 Days',1799,'International',4.9,'dest-santorini','[\\"Oia Sunset\\",\\"Wine Tasting\\",\\"Volcanic Hot Springs\\",\\"Beach Hopping\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00'),\n('e41683bf-9fce-4caf-a19d-ab1b9174287e','NYC Adventure','New York','4 Days',999,'Domestic',4.5,'dest-newyork','[\\"Statue of Liberty\\",\\"Central Park\\",\\"Broadway Show\\",\\"Times Square\\"]'::jsonb,true,'2026-02-27 13:11:27.452392+00')\nON CONFLICT (id) DO NOTHING;\n"}		ars@travelvela.com	\N	\N
20260308225933	{"INSERT INTO public.api_settings (provider, is_active, settings) VALUES ('agoda_hotel', true, '{\\"cityMapping\\": {}}') ON CONFLICT DO NOTHING;"}		ars@travelvela.com	\N	\N
20260309000750	{"-- Remove demo/seed tour records\nDELETE FROM public.tours WHERE id IN (\n  '2650592a-505c-4635-9cb4-229c7b5dab4e', -- Romantic Paris\n  '5b8c4132-c606-4420-80b0-e3d871f68167', -- Japan Explorer\n  '093b5c1b-5bd6-4889-b929-f44d6d10aeb5', -- Bali Paradise\n  '1ec17db4-629f-4e79-b485-883c8c320652', -- Dubai Luxury\n  '46d2c47f-6ee9-4fb4-a9b8-cd3ebd495d32', -- Greek Islands\n  'e41683bf-9fce-4caf-a19d-ab1b9174287e'  -- NYC Adventure\n);"}		ars@travelvela.com	\N	\N
20260309080054	{"\n-- Ensure travelvela_hotel row exists and is disabled\nINSERT INTO public.api_settings (provider, is_active, settings)\nVALUES ('travelvela_hotel', false, '{}')\nON CONFLICT (provider) DO UPDATE SET is_active = false;\n\n-- Ensure tripjack_hotel is disabled\nUPDATE public.api_settings SET is_active = false WHERE provider = 'tripjack_hotel';\n\n-- Ensure agoda_hotel is enabled\nINSERT INTO public.api_settings (provider, is_active, settings)\nVALUES ('agoda_hotel', true, '{}')\nON CONFLICT (provider) DO UPDATE SET is_active = true;\n"}		ars@travelvela.com	\N	\N
20260309090603	{"-- Fix 1: Replace public SELECT on api_settings with a policy that only exposes non-sensitive providers\nDROP POLICY IF EXISTS \\"Public read api_settings\\" ON public.api_settings;\n\nCREATE POLICY \\"Public read non-sensitive api_settings\\"\n  ON public.api_settings FOR SELECT\n  USING (\n    provider IN (\n      'site_branding', 'site_general', 'site_footer', 'site_contact', 'site_social',\n      'site_seo', 'site_payment', 'currency_rates', 'taxes_fees',\n      'site_privacy_policy', 'site_terms', 'site_refund_policy',\n      'site_hero', 'site_stats', 'site_why_choose', 'site_newsletter',\n      'site_app_download', 'site_trending', 'site_blog_section'\n    )\n    OR has_role(auth.uid(), 'admin'::app_role)\n  );\n\n-- Fix 2: Drop the permissive wallet INSERT policy (users should not self-credit)\nDROP POLICY IF EXISTS \\"Users can insert wallet txns\\" ON public.wallet_transactions;"}		ars@travelvela.com	\N	\N
\.


--
-- TOC entry 3768 (class 0 OID 16612)
-- Dependencies: 281
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4949 (class 0 OID 0)
-- Dependencies: 276
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 8, true);


--
-- TOC entry 4950 (class 0 OID 0)
-- Dependencies: 302
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- TOC entry 4162 (class 2606 OID 16783)
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- TOC entry 4131 (class 2606 OID 16535)
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4217 (class 2606 OID 17115)
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- TOC entry 4219 (class 2606 OID 17113)
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4185 (class 2606 OID 16889)
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- TOC entry 4140 (class 2606 OID 16907)
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- TOC entry 4142 (class 2606 OID 16917)
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- TOC entry 4129 (class 2606 OID 16528)
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- TOC entry 4164 (class 2606 OID 16776)
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- TOC entry 4160 (class 2606 OID 16764)
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- TOC entry 4152 (class 2606 OID 16957)
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- TOC entry 4154 (class 2606 OID 16751)
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- TOC entry 4198 (class 2606 OID 17016)
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- TOC entry 4200 (class 2606 OID 17014)
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- TOC entry 4202 (class 2606 OID 17012)
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4212 (class 2606 OID 17074)
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- TOC entry 4195 (class 2606 OID 16976)
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4206 (class 2606 OID 17038)
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- TOC entry 4208 (class 2606 OID 17040)
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- TOC entry 4189 (class 2606 OID 16942)
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4123 (class 2606 OID 16518)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4126 (class 2606 OID 16694)
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- TOC entry 4174 (class 2606 OID 16823)
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- TOC entry 4176 (class 2606 OID 16821)
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4181 (class 2606 OID 16837)
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- TOC entry 4134 (class 2606 OID 16541)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4147 (class 2606 OID 16715)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4171 (class 2606 OID 16804)
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- TOC entry 4166 (class 2606 OID 16795)
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4116 (class 2606 OID 16877)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 4118 (class 2606 OID 16505)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4342 (class 2606 OID 17915)
-- Name: airline_settings airline_settings_airline_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.airline_settings
    ADD CONSTRAINT airline_settings_airline_code_key UNIQUE (airline_code);


--
-- TOC entry 4344 (class 2606 OID 17913)
-- Name: airline_settings airline_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.airline_settings
    ADD CONSTRAINT airline_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4307 (class 2606 OID 17742)
-- Name: airports airports_iata_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_iata_code_key UNIQUE (iata_code);


--
-- TOC entry 4309 (class 2606 OID 17740)
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (id);


--
-- TOC entry 4292 (class 2606 OID 17663)
-- Name: api_settings api_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_settings
    ADD CONSTRAINT api_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4294 (class 2606 OID 17665)
-- Name: api_settings api_settings_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_settings
    ADD CONSTRAINT api_settings_provider_key UNIQUE (provider);


--
-- TOC entry 4357 (class 2606 OID 18070)
-- Name: b2b_access_requests b2b_access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.b2b_access_requests
    ADD CONSTRAINT b2b_access_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4313 (class 2606 OID 17756)
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- TOC entry 4319 (class 2606 OID 17791)
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4321 (class 2606 OID 17793)
-- Name: blog_categories blog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_slug_key UNIQUE (slug);


--
-- TOC entry 4323 (class 2606 OID 17806)
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- TOC entry 4325 (class 2606 OID 17808)
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- TOC entry 4302 (class 2606 OID 17724)
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- TOC entry 4355 (class 2606 OID 17972)
-- Name: destinations destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.destinations
    ADD CONSTRAINT destinations_pkey PRIMARY KEY (id);


--
-- TOC entry 4346 (class 2606 OID 17927)
-- Name: flight_price_cache flight_price_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_price_cache
    ADD CONSTRAINT flight_price_cache_pkey PRIMARY KEY (id);


--
-- TOC entry 4348 (class 2606 OID 18054)
-- Name: flight_price_cache flight_price_cache_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flight_price_cache
    ADD CONSTRAINT flight_price_cache_unique UNIQUE (from_code, to_code, travel_date, cabin_class, adults, children, infants);


--
-- TOC entry 4296 (class 2606 OID 17683)
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (id);


--
-- TOC entry 4359 (class 2606 OID 18097)
-- Name: hotel_interactions hotel_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hotel_interactions
    ADD CONSTRAINT hotel_interactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4298 (class 2606 OID 17697)
-- Name: hotels hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);


--
-- TOC entry 4351 (class 2606 OID 17940)
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- TOC entry 4353 (class 2606 OID 17938)
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- TOC entry 4315 (class 2606 OID 17769)
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- TOC entry 4329 (class 2606 OID 17832)
-- Name: popular_routes popular_routes_from_code_to_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.popular_routes
    ADD CONSTRAINT popular_routes_from_code_to_code_key UNIQUE (from_code, to_code);


--
-- TOC entry 4331 (class 2606 OID 17830)
-- Name: popular_routes popular_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.popular_routes
    ADD CONSTRAINT popular_routes_pkey PRIMARY KEY (id);


--
-- TOC entry 4263 (class 2606 OID 17545)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4265 (class 2606 OID 17547)
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- TOC entry 4275 (class 2606 OID 17591)
-- Name: provider_groups provider_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_groups
    ADD CONSTRAINT provider_groups_name_key UNIQUE (name);


--
-- TOC entry 4277 (class 2606 OID 17589)
-- Name: provider_groups provider_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_groups
    ADD CONSTRAINT provider_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4340 (class 2606 OID 17892)
-- Name: saved_passengers saved_passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_passengers
    ADD CONSTRAINT saved_passengers_pkey PRIMARY KEY (id);


--
-- TOC entry 4280 (class 2606 OID 17610)
-- Name: tenant_api_keys tenant_api_keys_api_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_api_key_key UNIQUE (api_key);


--
-- TOC entry 4282 (class 2606 OID 17608)
-- Name: tenant_api_keys tenant_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_pkey PRIMARY KEY (id);


--
-- TOC entry 4284 (class 2606 OID 17626)
-- Name: tenant_api_settings tenant_api_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_settings
    ADD CONSTRAINT tenant_api_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4286 (class 2606 OID 17628)
-- Name: tenant_api_settings tenant_api_settings_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_settings
    ADD CONSTRAINT tenant_api_settings_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- TOC entry 4288 (class 2606 OID 17645)
-- Name: tenant_payment_settings tenant_payment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_payment_settings
    ADD CONSTRAINT tenant_payment_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4290 (class 2606 OID 17647)
-- Name: tenant_payment_settings tenant_payment_settings_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_payment_settings
    ADD CONSTRAINT tenant_payment_settings_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- TOC entry 4271 (class 2606 OID 17578)
-- Name: tenants tenants_domain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);


--
-- TOC entry 4273 (class 2606 OID 17576)
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- TOC entry 4317 (class 2606 OID 17782)
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- TOC entry 4337 (class 2606 OID 17866)
-- Name: ticket_requests ticket_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4361 (class 2606 OID 18133)
-- Name: tour_inquiries tour_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tour_inquiries
    ADD CONSTRAINT tour_inquiries_pkey PRIMARY KEY (id);


--
-- TOC entry 4300 (class 2606 OID 17711)
-- Name: tours tours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tours
    ADD CONSTRAINT tours_pkey PRIMARY KEY (id);


--
-- TOC entry 4363 (class 2606 OID 18147)
-- Name: tripjack_cities tripjack_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tripjack_cities
    ADD CONSTRAINT tripjack_cities_pkey PRIMARY KEY (id);


--
-- TOC entry 4365 (class 2606 OID 18170)
-- Name: tripjack_hotels tripjack_hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tripjack_hotels
    ADD CONSTRAINT tripjack_hotels_pkey PRIMARY KEY (tj_hotel_id);


--
-- TOC entry 4267 (class 2606 OID 17558)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4269 (class 2606 OID 17560)
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- TOC entry 4334 (class 2606 OID 17845)
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4255 (class 2606 OID 17488)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- TOC entry 4225 (class 2606 OID 17153)
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- TOC entry 4222 (class 2606 OID 17126)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4246 (class 2606 OID 17394)
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- TOC entry 4233 (class 2606 OID 17237)
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- TOC entry 4249 (class 2606 OID 17370)
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- TOC entry 4228 (class 2606 OID 17228)
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- TOC entry 4230 (class 2606 OID 17226)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4239 (class 2606 OID 17249)
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- TOC entry 4244 (class 2606 OID 17311)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- TOC entry 4242 (class 2606 OID 17296)
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- TOC entry 4252 (class 2606 OID 17380)
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- TOC entry 4257 (class 2606 OID 17522)
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 4259 (class 2606 OID 17520)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- TOC entry 4132 (class 1259 OID 16536)
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- TOC entry 4106 (class 1259 OID 16704)
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4213 (class 1259 OID 17119)
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- TOC entry 4214 (class 1259 OID 17118)
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- TOC entry 4215 (class 1259 OID 17116)
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- TOC entry 4220 (class 1259 OID 17117)
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- TOC entry 4107 (class 1259 OID 16706)
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4108 (class 1259 OID 16707)
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4150 (class 1259 OID 16785)
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- TOC entry 4183 (class 1259 OID 16893)
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- TOC entry 4138 (class 1259 OID 16873)
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- TOC entry 4951 (class 0 OID 0)
-- Dependencies: 4138
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- TOC entry 4143 (class 1259 OID 16701)
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- TOC entry 4186 (class 1259 OID 16890)
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- TOC entry 4210 (class 1259 OID 17075)
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- TOC entry 4187 (class 1259 OID 16891)
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- TOC entry 4158 (class 1259 OID 16896)
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- TOC entry 4155 (class 1259 OID 16757)
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- TOC entry 4156 (class 1259 OID 16902)
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- TOC entry 4196 (class 1259 OID 17027)
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- TOC entry 4193 (class 1259 OID 16980)
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- TOC entry 4203 (class 1259 OID 17053)
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- TOC entry 4204 (class 1259 OID 17051)
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- TOC entry 4209 (class 1259 OID 17052)
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- TOC entry 4190 (class 1259 OID 16949)
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- TOC entry 4191 (class 1259 OID 16948)
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- TOC entry 4192 (class 1259 OID 16950)
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- TOC entry 4109 (class 1259 OID 16708)
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4110 (class 1259 OID 16705)
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- TOC entry 4119 (class 1259 OID 16519)
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- TOC entry 4120 (class 1259 OID 16520)
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- TOC entry 4121 (class 1259 OID 16700)
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- TOC entry 4124 (class 1259 OID 16787)
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- TOC entry 4127 (class 1259 OID 16892)
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- TOC entry 4177 (class 1259 OID 16829)
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- TOC entry 4178 (class 1259 OID 16894)
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- TOC entry 4179 (class 1259 OID 16844)
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- TOC entry 4182 (class 1259 OID 16843)
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- TOC entry 4144 (class 1259 OID 16895)
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- TOC entry 4145 (class 1259 OID 17065)
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- TOC entry 4148 (class 1259 OID 16786)
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- TOC entry 4169 (class 1259 OID 16811)
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- TOC entry 4172 (class 1259 OID 16810)
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- TOC entry 4167 (class 1259 OID 16796)
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- TOC entry 4168 (class 1259 OID 16958)
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- TOC entry 4157 (class 1259 OID 16955)
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- TOC entry 4149 (class 1259 OID 16784)
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- TOC entry 4111 (class 1259 OID 16864)
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- TOC entry 4952 (class 0 OID 0)
-- Dependencies: 4111
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- TOC entry 4112 (class 1259 OID 16702)
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- TOC entry 4113 (class 1259 OID 16509)
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- TOC entry 4114 (class 1259 OID 16919)
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- TOC entry 4310 (class 1259 OID 17947)
-- Name: idx_airports_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_airports_active ON public.airports USING btree (is_active);


--
-- TOC entry 4311 (class 1259 OID 17946)
-- Name: idx_airports_iata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_airports_iata ON public.airports USING btree (iata_code);


--
-- TOC entry 4326 (class 1259 OID 17948)
-- Name: idx_blog_posts_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug);


--
-- TOC entry 4327 (class 1259 OID 17949)
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- TOC entry 4303 (class 1259 OID 17945)
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- TOC entry 4304 (class 1259 OID 17944)
-- Name: idx_bookings_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_tenant_id ON public.bookings USING btree (tenant_id);


--
-- TOC entry 4305 (class 1259 OID 17943)
-- Name: idx_bookings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);


--
-- TOC entry 4349 (class 1259 OID 17953)
-- Name: idx_flight_cache; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_flight_cache ON public.flight_price_cache USING btree (from_code, to_code);


--
-- TOC entry 4260 (class 1259 OID 17942)
-- Name: idx_profiles_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_tenant_id ON public.profiles USING btree (tenant_id);


--
-- TOC entry 4261 (class 1259 OID 17941)
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- TOC entry 4338 (class 1259 OID 17952)
-- Name: idx_saved_passengers_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_saved_passengers_user ON public.saved_passengers USING btree (user_id);


--
-- TOC entry 4278 (class 1259 OID 17954)
-- Name: idx_tenant_api_keys_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_api_keys_key ON public.tenant_api_keys USING btree (api_key);


--
-- TOC entry 4335 (class 1259 OID 17951)
-- Name: idx_ticket_requests_booking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_requests_booking ON public.ticket_requests USING btree (booking_id);


--
-- TOC entry 4332 (class 1259 OID 17950)
-- Name: idx_wallet_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallet_user_id ON public.wallet_transactions USING btree (user_id);


--
-- TOC entry 4223 (class 1259 OID 17489)
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- TOC entry 4253 (class 1259 OID 17490)
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- TOC entry 4226 (class 1259 OID 17493)
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- TOC entry 4231 (class 1259 OID 17238)
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- TOC entry 4234 (class 1259 OID 17255)
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- TOC entry 4247 (class 1259 OID 17395)
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- TOC entry 4240 (class 1259 OID 17322)
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- TOC entry 4235 (class 1259 OID 17287)
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- TOC entry 4236 (class 1259 OID 17402)
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- TOC entry 4237 (class 1259 OID 17256)
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- TOC entry 4250 (class 1259 OID 17386)
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- TOC entry 4400 (class 2620 OID 17978)
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- TOC entry 4401 (class 2620 OID 17158)
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- TOC entry 4402 (class 2620 OID 17341)
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- TOC entry 4403 (class 2620 OID 17404)
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- TOC entry 4404 (class 2620 OID 17405)
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- TOC entry 4405 (class 2620 OID 17275)
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- TOC entry 4367 (class 2606 OID 16688)
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4372 (class 2606 OID 16777)
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- TOC entry 4371 (class 2606 OID 16765)
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- TOC entry 4370 (class 2606 OID 16752)
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4378 (class 2606 OID 17017)
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 4379 (class 2606 OID 17022)
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4380 (class 2606 OID 17046)
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 4381 (class 2606 OID 17041)
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4377 (class 2606 OID 16943)
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4366 (class 2606 OID 16721)
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- TOC entry 4374 (class 2606 OID 16824)
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 4375 (class 2606 OID 16897)
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- TOC entry 4376 (class 2606 OID 16838)
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 4368 (class 2606 OID 17060)
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- TOC entry 4369 (class 2606 OID 16716)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4373 (class 2606 OID 16805)
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- TOC entry 4399 (class 2606 OID 18071)
-- Name: b2b_access_requests b2b_access_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.b2b_access_requests
    ADD CONSTRAINT b2b_access_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4394 (class 2606 OID 17809)
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;


--
-- TOC entry 4393 (class 2606 OID 17725)
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4389 (class 2606 OID 17592)
-- Name: tenants fk_tenants_provider_group; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT fk_tenants_provider_group FOREIGN KEY (provider_group_id) REFERENCES public.provider_groups(id) ON DELETE SET NULL;


--
-- TOC entry 4387 (class 2606 OID 17548)
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4398 (class 2606 OID 17893)
-- Name: saved_passengers saved_passengers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_passengers
    ADD CONSTRAINT saved_passengers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4390 (class 2606 OID 17611)
-- Name: tenant_api_keys tenant_api_keys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 4391 (class 2606 OID 17629)
-- Name: tenant_api_settings tenant_api_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_settings
    ADD CONSTRAINT tenant_api_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 4392 (class 2606 OID 17648)
-- Name: tenant_payment_settings tenant_payment_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_payment_settings
    ADD CONSTRAINT tenant_payment_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 4396 (class 2606 OID 17867)
-- Name: ticket_requests ticket_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- TOC entry 4397 (class 2606 OID 17872)
-- Name: ticket_requests ticket_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_requests
    ADD CONSTRAINT ticket_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4388 (class 2606 OID 17561)
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4395 (class 2606 OID 17846)
-- Name: wallet_transactions wallet_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4382 (class 2606 OID 17250)
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 4383 (class 2606 OID 17297)
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 4384 (class 2606 OID 17317)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- TOC entry 4385 (class 2606 OID 17312)
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- TOC entry 4386 (class 2606 OID 17381)
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- TOC entry 4557 (class 0 OID 16529)
-- Dependencies: 279
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4568 (class 0 OID 16883)
-- Dependencies: 293
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4559 (class 0 OID 16681)
-- Dependencies: 284
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4556 (class 0 OID 16522)
-- Dependencies: 278
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4563 (class 0 OID 16770)
-- Dependencies: 288
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4562 (class 0 OID 16758)
-- Dependencies: 287
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4561 (class 0 OID 16745)
-- Dependencies: 286
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4569 (class 0 OID 16933)
-- Dependencies: 294
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4555 (class 0 OID 16511)
-- Dependencies: 277
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4566 (class 0 OID 16812)
-- Dependencies: 291
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4567 (class 0 OID 16830)
-- Dependencies: 292
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4558 (class 0 OID 16537)
-- Dependencies: 280
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4560 (class 0 OID 16711)
-- Dependencies: 285
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4565 (class 0 OID 16797)
-- Dependencies: 290
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4564 (class 0 OID 16788)
-- Dependencies: 289
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4554 (class 0 OID 16499)
-- Dependencies: 275
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4652 (class 3256 OID 18023)
-- Name: airline_settings Admin manage airline_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage airline_settings" ON public.airline_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4650 (class 3256 OID 18021)
-- Name: api_settings Admin manage api_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage api_settings" ON public.api_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4637 (class 3256 OID 18006)
-- Name: banners Admin manage banners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage banners" ON public.banners TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4646 (class 3256 OID 18016)
-- Name: blog_categories Admin manage blog_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage blog_categories" ON public.blog_categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4644 (class 3256 OID 18014)
-- Name: blog_posts Admin manage blog_posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage blog_posts" ON public.blog_posts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4642 (class 3256 OID 18012)
-- Name: destinations Admin manage destinations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage destinations" ON public.destinations TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4629 (class 3256 OID 17998)
-- Name: flights Admin manage flights; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage flights" ON public.flights TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4631 (class 3256 OID 18000)
-- Name: hotels Admin manage hotels; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage hotels" ON public.hotels TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4639 (class 3256 OID 18008)
-- Name: offers Admin manage offers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage offers" ON public.offers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4648 (class 3256 OID 18018)
-- Name: popular_routes Admin manage popular_routes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage popular_routes" ON public.popular_routes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4659 (class 3256 OID 18030)
-- Name: provider_groups Admin manage provider_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage provider_groups" ON public.provider_groups TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4661 (class 3256 OID 18032)
-- Name: tenant_api_keys Admin manage tenant_api_keys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tenant_api_keys" ON public.tenant_api_keys TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4663 (class 3256 OID 18034)
-- Name: tenant_api_settings Admin manage tenant_api_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tenant_api_settings" ON public.tenant_api_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4665 (class 3256 OID 18036)
-- Name: tenant_payment_settings Admin manage tenant_payment_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tenant_payment_settings" ON public.tenant_payment_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4658 (class 3256 OID 18029)
-- Name: tenants Admin manage tenants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tenants" ON public.tenants TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4641 (class 3256 OID 18010)
-- Name: testimonials Admin manage testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage testimonials" ON public.testimonials TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4677 (class 3256 OID 18135)
-- Name: tour_inquiries Admin manage tour_inquiries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tour_inquiries" ON public.tour_inquiries USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4633 (class 3256 OID 18002)
-- Name: tours Admin manage tours; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin manage tours" ON public.tours TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4674 (class 3256 OID 18099)
-- Name: hotel_interactions Admin read hotel_interactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin read hotel_interactions" ON public.hotel_interactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4656 (class 3256 OID 18027)
-- Name: newsletter_subscribers Admin read newsletter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin read newsletter" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4620 (class 3256 OID 17989)
-- Name: bookings Admins can manage all bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all bookings" ON public.bookings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4627 (class 3256 OID 17996)
-- Name: ticket_requests Admins can manage all requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all requests" ON public.ticket_requests TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4672 (class 3256 OID 18078)
-- Name: b2b_access_requests Admins can manage b2b requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage b2b requests" ON public.b2b_access_requests TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4615 (class 3256 OID 17984)
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4622 (class 3256 OID 17992)
-- Name: wallet_transactions Admins can manage wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage wallet" ON public.wallet_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4613 (class 3256 OID 17982)
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4612 (class 3256 OID 17981)
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- TOC entry 4655 (class 3256 OID 18026)
-- Name: newsletter_subscribers Anyone can subscribe newsletter; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can subscribe newsletter" ON public.newsletter_subscribers FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- TOC entry 4614 (class 3256 OID 17983)
-- Name: profiles Profiles insert on signup; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Profiles insert on signup" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4673 (class 3256 OID 18098)
-- Name: hotel_interactions Public insert hotel_interactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public insert hotel_interactions" ON public.hotel_interactions FOR INSERT WITH CHECK (true);


--
-- TOC entry 4676 (class 3256 OID 18134)
-- Name: tour_inquiries Public insert tour_inquiries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public insert tour_inquiries" ON public.tour_inquiries FOR INSERT WITH CHECK (true);


--
-- TOC entry 4657 (class 3256 OID 18028)
-- Name: tenants Public read active tenants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read active tenants" ON public.tenants FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- TOC entry 4651 (class 3256 OID 18022)
-- Name: airline_settings Public read airline_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read airline_settings" ON public.airline_settings FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4634 (class 3256 OID 18003)
-- Name: airports Public read airports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read airports" ON public.airports FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4636 (class 3256 OID 18005)
-- Name: banners Public read banners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read banners" ON public.banners FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4645 (class 3256 OID 18015)
-- Name: blog_categories Public read blog_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read blog_categories" ON public.blog_categories FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4643 (class 3256 OID 18013)
-- Name: blog_posts Public read blog_posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read blog_posts" ON public.blog_posts FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4623 (class 3256 OID 18011)
-- Name: destinations Public read destinations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read destinations" ON public.destinations FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4653 (class 3256 OID 18024)
-- Name: flight_price_cache Public read flight_price_cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read flight_price_cache" ON public.flight_price_cache FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4628 (class 3256 OID 17997)
-- Name: flights Public read flights; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read flights" ON public.flights FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4630 (class 3256 OID 17999)
-- Name: hotels Public read hotels; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read hotels" ON public.hotels FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4682 (class 3256 OID 18197)
-- Name: api_settings Public read non-sensitive api_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read non-sensitive api_settings" ON public.api_settings FOR SELECT USING (((provider = ANY (ARRAY['site_branding'::text, 'site_general'::text, 'site_footer'::text, 'site_contact'::text, 'site_social'::text, 'site_seo'::text, 'site_payment'::text, 'currency_rates'::text, 'taxes_fees'::text, 'site_privacy_policy'::text, 'site_terms'::text, 'site_refund_policy'::text, 'site_hero'::text, 'site_stats'::text, 'site_why_choose'::text, 'site_newsletter'::text, 'site_app_download'::text, 'site_trending'::text, 'site_blog_section'::text])) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- TOC entry 4638 (class 3256 OID 18007)
-- Name: offers Public read offers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read offers" ON public.offers FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4647 (class 3256 OID 18017)
-- Name: popular_routes Public read popular_routes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read popular_routes" ON public.popular_routes FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4660 (class 3256 OID 18031)
-- Name: provider_groups Public read provider_groups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read provider_groups" ON public.provider_groups FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4640 (class 3256 OID 18009)
-- Name: testimonials Public read testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read testimonials" ON public.testimonials FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4632 (class 3256 OID 18001)
-- Name: tours Public read tours; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read tours" ON public.tours FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4678 (class 3256 OID 18148)
-- Name: tripjack_cities Public read tripjack_cities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read tripjack_cities" ON public.tripjack_cities FOR SELECT USING (true);


--
-- TOC entry 4680 (class 3256 OID 18171)
-- Name: tripjack_hotels Public read tripjack_hotels; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read tripjack_hotels" ON public.tripjack_hotels FOR SELECT USING (true);


--
-- TOC entry 4635 (class 3256 OID 18004)
-- Name: airports Service manage airports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage airports" ON public.airports TO service_role USING (true);


--
-- TOC entry 4654 (class 3256 OID 18025)
-- Name: flight_price_cache Service manage flight_price_cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage flight_price_cache" ON public.flight_price_cache TO service_role USING (true);


--
-- TOC entry 4675 (class 3256 OID 18100)
-- Name: hotel_interactions Service manage hotel_interactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage hotel_interactions" ON public.hotel_interactions USING (true);


--
-- TOC entry 4649 (class 3256 OID 18019)
-- Name: popular_routes Service manage popular_routes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage popular_routes" ON public.popular_routes TO service_role USING (true);


--
-- TOC entry 4662 (class 3256 OID 18033)
-- Name: tenant_api_keys Service manage tenant_api_keys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage tenant_api_keys" ON public.tenant_api_keys TO service_role USING (true);


--
-- TOC entry 4679 (class 3256 OID 18149)
-- Name: tripjack_cities Service manage tripjack_cities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage tripjack_cities" ON public.tripjack_cities USING (true);


--
-- TOC entry 4681 (class 3256 OID 18172)
-- Name: tripjack_hotels Service manage tripjack_hotels; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service manage tripjack_hotels" ON public.tripjack_hotels USING (true);


--
-- TOC entry 4664 (class 3256 OID 18035)
-- Name: tenant_api_settings Service read tenant_api_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service read tenant_api_settings" ON public.tenant_api_settings FOR SELECT TO service_role USING (true);


--
-- TOC entry 4671 (class 3256 OID 18077)
-- Name: b2b_access_requests Users can create b2b requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create b2b requests" ON public.b2b_access_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4626 (class 3256 OID 17995)
-- Name: ticket_requests Users can create requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create requests" ON public.ticket_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4618 (class 3256 OID 17987)
-- Name: bookings Users can insert own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4624 (class 3256 OID 17993)
-- Name: saved_passengers Users can manage own passengers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own passengers" ON public.saved_passengers TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4619 (class 3256 OID 17988)
-- Name: bookings Users can update own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4611 (class 3256 OID 17980)
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4670 (class 3256 OID 18076)
-- Name: b2b_access_requests Users can view own b2b requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own b2b requests" ON public.b2b_access_requests FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4617 (class 3256 OID 17986)
-- Name: bookings Users can view own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4610 (class 3256 OID 17979)
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4625 (class 3256 OID 17994)
-- Name: ticket_requests Users can view own requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own requests" ON public.ticket_requests FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4616 (class 3256 OID 17985)
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4621 (class 3256 OID 17990)
-- Name: wallet_transactions Users can view own wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own wallet" ON public.wallet_transactions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4601 (class 0 OID 17898)
-- Dependencies: 338
-- Name: airline_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.airline_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4591 (class 0 OID 17730)
-- Dependencies: 328
-- Name: airports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4586 (class 0 OID 17653)
-- Dependencies: 323
-- Name: api_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4605 (class 0 OID 18055)
-- Dependencies: 342
-- Name: b2b_access_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.b2b_access_requests ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4592 (class 0 OID 17743)
-- Dependencies: 329
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4595 (class 0 OID 17783)
-- Dependencies: 332
-- Name: blog_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4596 (class 0 OID 17794)
-- Dependencies: 333
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4590 (class 0 OID 17712)
-- Dependencies: 327
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4604 (class 0 OID 17958)
-- Dependencies: 341
-- Name: destinations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4602 (class 0 OID 17916)
-- Dependencies: 339
-- Name: flight_price_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flight_price_cache ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4587 (class 0 OID 17666)
-- Dependencies: 324
-- Name: flights; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4606 (class 0 OID 18085)
-- Dependencies: 343
-- Name: hotel_interactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hotel_interactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4588 (class 0 OID 17684)
-- Dependencies: 325
-- Name: hotels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4603 (class 0 OID 17930)
-- Dependencies: 340
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4593 (class 0 OID 17757)
-- Dependencies: 330
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4597 (class 0 OID 17814)
-- Dependencies: 334
-- Name: popular_routes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.popular_routes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4579 (class 0 OID 17531)
-- Dependencies: 316
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4582 (class 0 OID 17579)
-- Dependencies: 319
-- Name: provider_groups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.provider_groups ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4600 (class 0 OID 17877)
-- Dependencies: 337
-- Name: saved_passengers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.saved_passengers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4583 (class 0 OID 17597)
-- Dependencies: 320
-- Name: tenant_api_keys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4584 (class 0 OID 17616)
-- Dependencies: 321
-- Name: tenant_api_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenant_api_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4585 (class 0 OID 17634)
-- Dependencies: 322
-- Name: tenant_payment_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4581 (class 0 OID 17566)
-- Dependencies: 318
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4594 (class 0 OID 17770)
-- Dependencies: 331
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4599 (class 0 OID 17851)
-- Dependencies: 336
-- Name: ticket_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ticket_requests ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4607 (class 0 OID 18111)
-- Dependencies: 344
-- Name: tour_inquiries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tour_inquiries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4589 (class 0 OID 17698)
-- Dependencies: 326
-- Name: tours; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4608 (class 0 OID 18136)
-- Dependencies: 345
-- Name: tripjack_cities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tripjack_cities ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4609 (class 0 OID 18150)
-- Dependencies: 346
-- Name: tripjack_hotels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tripjack_hotels ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4580 (class 0 OID 17553)
-- Dependencies: 317
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4598 (class 0 OID 17833)
-- Dependencies: 335
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4578 (class 0 OID 17471)
-- Dependencies: 314
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4668 (class 3256 OID 18040)
-- Name: objects Admins can manage blog images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Admins can manage blog images" ON storage.objects TO authenticated USING (((bucket_id = 'blog-images'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((bucket_id = 'blog-images'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- TOC entry 4666 (class 3256 OID 18038)
-- Name: objects Admins can manage ticket files; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Admins can manage ticket files" ON storage.objects TO authenticated USING (((bucket_id = 'ticket-files'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((bucket_id = 'ticket-files'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- TOC entry 4669 (class 3256 OID 18041)
-- Name: objects Public can read blog images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Public can read blog images" ON storage.objects FOR SELECT TO authenticated, anon USING ((bucket_id = 'blog-images'::text));


--
-- TOC entry 4667 (class 3256 OID 18039)
-- Name: objects Public can read ticket files; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Public can read ticket files" ON storage.objects FOR SELECT TO authenticated, anon USING ((bucket_id = 'ticket-files'::text));


--
-- TOC entry 4571 (class 0 OID 17229)
-- Dependencies: 307
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4575 (class 0 OID 17348)
-- Dependencies: 311
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4576 (class 0 OID 17361)
-- Dependencies: 312
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4570 (class 0 OID 17221)
-- Dependencies: 306
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4572 (class 0 OID 17239)
-- Dependencies: 308
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4573 (class 0 OID 17288)
-- Dependencies: 309
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4574 (class 0 OID 17302)
-- Dependencies: 310
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4577 (class 0 OID 17371)
-- Dependencies: 313
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4683 (class 6104 OID 16430)
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- TOC entry 4754 (class 0 OID 0)
-- Dependencies: 35
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- TOC entry 4755 (class 0 OID 0)
-- Dependencies: 21
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- TOC entry 4756 (class 0 OID 0)
-- Dependencies: 38
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4757 (class 0 OID 0)
-- Dependencies: 10
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- TOC entry 4758 (class 0 OID 0)
-- Dependencies: 36
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- TOC entry 4759 (class 0 OID 0)
-- Dependencies: 30
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- TOC entry 4766 (class 0 OID 0)
-- Dependencies: 411
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- TOC entry 4767 (class 0 OID 0)
-- Dependencies: 430
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- TOC entry 4769 (class 0 OID 0)
-- Dependencies: 410
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- TOC entry 4771 (class 0 OID 0)
-- Dependencies: 409
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- TOC entry 4772 (class 0 OID 0)
-- Dependencies: 405
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- TOC entry 4773 (class 0 OID 0)
-- Dependencies: 406
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- TOC entry 4774 (class 0 OID 0)
-- Dependencies: 377
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- TOC entry 4775 (class 0 OID 0)
-- Dependencies: 407
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- TOC entry 4776 (class 0 OID 0)
-- Dependencies: 381
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4777 (class 0 OID 0)
-- Dependencies: 383
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4778 (class 0 OID 0)
-- Dependencies: 374
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- TOC entry 4779 (class 0 OID 0)
-- Dependencies: 373
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- TOC entry 4780 (class 0 OID 0)
-- Dependencies: 380
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4781 (class 0 OID 0)
-- Dependencies: 382
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4782 (class 0 OID 0)
-- Dependencies: 384
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- TOC entry 4783 (class 0 OID 0)
-- Dependencies: 385
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- TOC entry 4784 (class 0 OID 0)
-- Dependencies: 378
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- TOC entry 4785 (class 0 OID 0)
-- Dependencies: 379
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- TOC entry 4787 (class 0 OID 0)
-- Dependencies: 412
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- TOC entry 4789 (class 0 OID 0)
-- Dependencies: 416
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- TOC entry 4791 (class 0 OID 0)
-- Dependencies: 413
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- TOC entry 4792 (class 0 OID 0)
-- Dependencies: 376
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4793 (class 0 OID 0)
-- Dependencies: 375
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- TOC entry 4794 (class 0 OID 0)
-- Dependencies: 361
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- TOC entry 4795 (class 0 OID 0)
-- Dependencies: 360
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- TOC entry 4796 (class 0 OID 0)
-- Dependencies: 362
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- TOC entry 4797 (class 0 OID 0)
-- Dependencies: 408
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- TOC entry 4798 (class 0 OID 0)
-- Dependencies: 404
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- TOC entry 4799 (class 0 OID 0)
-- Dependencies: 398
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- TOC entry 4800 (class 0 OID 0)
-- Dependencies: 400
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4801 (class 0 OID 0)
-- Dependencies: 402
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- TOC entry 4802 (class 0 OID 0)
-- Dependencies: 399
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- TOC entry 4803 (class 0 OID 0)
-- Dependencies: 401
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4804 (class 0 OID 0)
-- Dependencies: 403
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- TOC entry 4805 (class 0 OID 0)
-- Dependencies: 394
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- TOC entry 4806 (class 0 OID 0)
-- Dependencies: 396
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- TOC entry 4807 (class 0 OID 0)
-- Dependencies: 395
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- TOC entry 4808 (class 0 OID 0)
-- Dependencies: 397
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- TOC entry 4809 (class 0 OID 0)
-- Dependencies: 390
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- TOC entry 4810 (class 0 OID 0)
-- Dependencies: 392
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- TOC entry 4811 (class 0 OID 0)
-- Dependencies: 391
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- TOC entry 4812 (class 0 OID 0)
-- Dependencies: 393
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- TOC entry 4813 (class 0 OID 0)
-- Dependencies: 386
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- TOC entry 4814 (class 0 OID 0)
-- Dependencies: 388
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- TOC entry 4815 (class 0 OID 0)
-- Dependencies: 387
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- TOC entry 4816 (class 0 OID 0)
-- Dependencies: 389
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- TOC entry 4817 (class 0 OID 0)
-- Dependencies: 414
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- TOC entry 4818 (class 0 OID 0)
-- Dependencies: 415
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- TOC entry 4820 (class 0 OID 0)
-- Dependencies: 417
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- TOC entry 4821 (class 0 OID 0)
-- Dependencies: 368
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- TOC entry 4822 (class 0 OID 0)
-- Dependencies: 369
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- TOC entry 4823 (class 0 OID 0)
-- Dependencies: 370
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- TOC entry 4824 (class 0 OID 0)
-- Dependencies: 371
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- TOC entry 4825 (class 0 OID 0)
-- Dependencies: 372
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- TOC entry 4826 (class 0 OID 0)
-- Dependencies: 363
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- TOC entry 4827 (class 0 OID 0)
-- Dependencies: 364
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- TOC entry 4828 (class 0 OID 0)
-- Dependencies: 366
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- TOC entry 4829 (class 0 OID 0)
-- Dependencies: 365
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- TOC entry 4830 (class 0 OID 0)
-- Dependencies: 367
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- TOC entry 4831 (class 0 OID 0)
-- Dependencies: 429
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- TOC entry 4832 (class 0 OID 0)
-- Dependencies: 347
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- TOC entry 4833 (class 0 OID 0)
-- Dependencies: 359
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- TOC entry 4834 (class 0 OID 0)
-- Dependencies: 462
-- Name: FUNCTION generate_tenant_api_key(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_tenant_api_key() TO anon;
GRANT ALL ON FUNCTION public.generate_tenant_api_key() TO authenticated;
GRANT ALL ON FUNCTION public.generate_tenant_api_key() TO service_role;


--
-- TOC entry 4835 (class 0 OID 0)
-- Dependencies: 460
-- Name: FUNCTION get_admin_tenant_id(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_admin_tenant_id(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_admin_tenant_id(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_tenant_id(_user_id uuid) TO service_role;


--
-- TOC entry 4836 (class 0 OID 0)
-- Dependencies: 461
-- Name: FUNCTION get_tenant_wallet_balance(_tenant_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) TO service_role;


--
-- TOC entry 4837 (class 0 OID 0)
-- Dependencies: 463
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- TOC entry 4838 (class 0 OID 0)
-- Dependencies: 459
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- TOC entry 4839 (class 0 OID 0)
-- Dependencies: 431
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- TOC entry 4840 (class 0 OID 0)
-- Dependencies: 437
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- TOC entry 4841 (class 0 OID 0)
-- Dependencies: 458
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- TOC entry 4842 (class 0 OID 0)
-- Dependencies: 439
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- TOC entry 4843 (class 0 OID 0)
-- Dependencies: 435
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- TOC entry 4844 (class 0 OID 0)
-- Dependencies: 434
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- TOC entry 4845 (class 0 OID 0)
-- Dependencies: 438
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- TOC entry 4846 (class 0 OID 0)
-- Dependencies: 455
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- TOC entry 4847 (class 0 OID 0)
-- Dependencies: 433
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- TOC entry 4848 (class 0 OID 0)
-- Dependencies: 457
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- TOC entry 4849 (class 0 OID 0)
-- Dependencies: 432
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- TOC entry 4850 (class 0 OID 0)
-- Dependencies: 436
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- TOC entry 4851 (class 0 OID 0)
-- Dependencies: 456
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- TOC entry 4852 (class 0 OID 0)
-- Dependencies: 419
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- TOC entry 4853 (class 0 OID 0)
-- Dependencies: 421
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- TOC entry 4854 (class 0 OID 0)
-- Dependencies: 422
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- TOC entry 4856 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- TOC entry 4857 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- TOC entry 4859 (class 0 OID 0)
-- Dependencies: 293
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- TOC entry 4862 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- TOC entry 4864 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- TOC entry 4866 (class 0 OID 0)
-- Dependencies: 288
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- TOC entry 4868 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- TOC entry 4871 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- TOC entry 4872 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- TOC entry 4874 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- TOC entry 4875 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- TOC entry 4876 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- TOC entry 4877 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- TOC entry 4879 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- TOC entry 4881 (class 0 OID 0)
-- Dependencies: 276
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- TOC entry 4883 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- TOC entry 4885 (class 0 OID 0)
-- Dependencies: 292
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- TOC entry 4887 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- TOC entry 4892 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- TOC entry 4894 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- TOC entry 4897 (class 0 OID 0)
-- Dependencies: 289
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- TOC entry 4900 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- TOC entry 4901 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- TOC entry 4902 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- TOC entry 4903 (class 0 OID 0)
-- Dependencies: 338
-- Name: TABLE airline_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.airline_settings TO anon;
GRANT ALL ON TABLE public.airline_settings TO authenticated;
GRANT ALL ON TABLE public.airline_settings TO service_role;


--
-- TOC entry 4904 (class 0 OID 0)
-- Dependencies: 328
-- Name: TABLE airports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.airports TO anon;
GRANT ALL ON TABLE public.airports TO authenticated;
GRANT ALL ON TABLE public.airports TO service_role;


--
-- TOC entry 4905 (class 0 OID 0)
-- Dependencies: 323
-- Name: TABLE api_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_settings TO anon;
GRANT ALL ON TABLE public.api_settings TO authenticated;
GRANT ALL ON TABLE public.api_settings TO service_role;


--
-- TOC entry 4906 (class 0 OID 0)
-- Dependencies: 342
-- Name: TABLE b2b_access_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.b2b_access_requests TO anon;
GRANT ALL ON TABLE public.b2b_access_requests TO authenticated;
GRANT ALL ON TABLE public.b2b_access_requests TO service_role;


--
-- TOC entry 4907 (class 0 OID 0)
-- Dependencies: 329
-- Name: TABLE banners; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.banners TO anon;
GRANT ALL ON TABLE public.banners TO authenticated;
GRANT ALL ON TABLE public.banners TO service_role;


--
-- TOC entry 4908 (class 0 OID 0)
-- Dependencies: 332
-- Name: TABLE blog_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blog_categories TO anon;
GRANT ALL ON TABLE public.blog_categories TO authenticated;
GRANT ALL ON TABLE public.blog_categories TO service_role;


--
-- TOC entry 4909 (class 0 OID 0)
-- Dependencies: 333
-- Name: TABLE blog_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blog_posts TO anon;
GRANT ALL ON TABLE public.blog_posts TO authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;


--
-- TOC entry 4910 (class 0 OID 0)
-- Dependencies: 327
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- TOC entry 4911 (class 0 OID 0)
-- Dependencies: 341
-- Name: TABLE destinations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.destinations TO anon;
GRANT ALL ON TABLE public.destinations TO authenticated;
GRANT ALL ON TABLE public.destinations TO service_role;


--
-- TOC entry 4912 (class 0 OID 0)
-- Dependencies: 339
-- Name: TABLE flight_price_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.flight_price_cache TO anon;
GRANT ALL ON TABLE public.flight_price_cache TO authenticated;
GRANT ALL ON TABLE public.flight_price_cache TO service_role;


--
-- TOC entry 4913 (class 0 OID 0)
-- Dependencies: 324
-- Name: TABLE flights; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.flights TO anon;
GRANT ALL ON TABLE public.flights TO authenticated;
GRANT ALL ON TABLE public.flights TO service_role;


--
-- TOC entry 4914 (class 0 OID 0)
-- Dependencies: 343
-- Name: TABLE hotel_interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hotel_interactions TO anon;
GRANT ALL ON TABLE public.hotel_interactions TO authenticated;
GRANT ALL ON TABLE public.hotel_interactions TO service_role;


--
-- TOC entry 4915 (class 0 OID 0)
-- Dependencies: 325
-- Name: TABLE hotels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hotels TO anon;
GRANT ALL ON TABLE public.hotels TO authenticated;
GRANT ALL ON TABLE public.hotels TO service_role;


--
-- TOC entry 4916 (class 0 OID 0)
-- Dependencies: 340
-- Name: TABLE newsletter_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.newsletter_subscribers TO anon;
GRANT ALL ON TABLE public.newsletter_subscribers TO authenticated;
GRANT ALL ON TABLE public.newsletter_subscribers TO service_role;


--
-- TOC entry 4917 (class 0 OID 0)
-- Dependencies: 330
-- Name: TABLE offers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.offers TO anon;
GRANT ALL ON TABLE public.offers TO authenticated;
GRANT ALL ON TABLE public.offers TO service_role;


--
-- TOC entry 4918 (class 0 OID 0)
-- Dependencies: 334
-- Name: TABLE popular_routes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.popular_routes TO anon;
GRANT ALL ON TABLE public.popular_routes TO authenticated;
GRANT ALL ON TABLE public.popular_routes TO service_role;


--
-- TOC entry 4919 (class 0 OID 0)
-- Dependencies: 316
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- TOC entry 4920 (class 0 OID 0)
-- Dependencies: 319
-- Name: TABLE provider_groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.provider_groups TO anon;
GRANT ALL ON TABLE public.provider_groups TO authenticated;
GRANT ALL ON TABLE public.provider_groups TO service_role;


--
-- TOC entry 4921 (class 0 OID 0)
-- Dependencies: 337
-- Name: TABLE saved_passengers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.saved_passengers TO anon;
GRANT ALL ON TABLE public.saved_passengers TO authenticated;
GRANT ALL ON TABLE public.saved_passengers TO service_role;


--
-- TOC entry 4922 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE tenant_api_keys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenant_api_keys TO anon;
GRANT ALL ON TABLE public.tenant_api_keys TO authenticated;
GRANT ALL ON TABLE public.tenant_api_keys TO service_role;


--
-- TOC entry 4923 (class 0 OID 0)
-- Dependencies: 321
-- Name: TABLE tenant_api_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenant_api_settings TO anon;
GRANT ALL ON TABLE public.tenant_api_settings TO authenticated;
GRANT ALL ON TABLE public.tenant_api_settings TO service_role;


--
-- TOC entry 4924 (class 0 OID 0)
-- Dependencies: 322
-- Name: TABLE tenant_payment_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenant_payment_settings TO anon;
GRANT ALL ON TABLE public.tenant_payment_settings TO authenticated;
GRANT ALL ON TABLE public.tenant_payment_settings TO service_role;


--
-- TOC entry 4925 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenants TO anon;
GRANT ALL ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;


--
-- TOC entry 4926 (class 0 OID 0)
-- Dependencies: 331
-- Name: TABLE testimonials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.testimonials TO anon;
GRANT ALL ON TABLE public.testimonials TO authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;


--
-- TOC entry 4927 (class 0 OID 0)
-- Dependencies: 336
-- Name: TABLE ticket_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ticket_requests TO anon;
GRANT ALL ON TABLE public.ticket_requests TO authenticated;
GRANT ALL ON TABLE public.ticket_requests TO service_role;


--
-- TOC entry 4928 (class 0 OID 0)
-- Dependencies: 344
-- Name: TABLE tour_inquiries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tour_inquiries TO anon;
GRANT ALL ON TABLE public.tour_inquiries TO authenticated;
GRANT ALL ON TABLE public.tour_inquiries TO service_role;


--
-- TOC entry 4929 (class 0 OID 0)
-- Dependencies: 326
-- Name: TABLE tours; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tours TO anon;
GRANT ALL ON TABLE public.tours TO authenticated;
GRANT ALL ON TABLE public.tours TO service_role;


--
-- TOC entry 4930 (class 0 OID 0)
-- Dependencies: 345
-- Name: TABLE tripjack_cities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tripjack_cities TO anon;
GRANT ALL ON TABLE public.tripjack_cities TO authenticated;
GRANT ALL ON TABLE public.tripjack_cities TO service_role;


--
-- TOC entry 4931 (class 0 OID 0)
-- Dependencies: 346
-- Name: TABLE tripjack_hotels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tripjack_hotels TO anon;
GRANT ALL ON TABLE public.tripjack_hotels TO authenticated;
GRANT ALL ON TABLE public.tripjack_hotels TO service_role;


--
-- TOC entry 4932 (class 0 OID 0)
-- Dependencies: 317
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- TOC entry 4933 (class 0 OID 0)
-- Dependencies: 335
-- Name: TABLE wallet_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wallet_transactions TO anon;
GRANT ALL ON TABLE public.wallet_transactions TO authenticated;
GRANT ALL ON TABLE public.wallet_transactions TO service_role;


--
-- TOC entry 4934 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- TOC entry 4935 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- TOC entry 4936 (class 0 OID 0)
-- Dependencies: 303
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- TOC entry 4937 (class 0 OID 0)
-- Dependencies: 302
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- TOC entry 4939 (class 0 OID 0)
-- Dependencies: 307
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- TOC entry 4940 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- TOC entry 4941 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- TOC entry 4943 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- TOC entry 4944 (class 0 OID 0)
-- Dependencies: 309
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- TOC entry 4945 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- TOC entry 4946 (class 0 OID 0)
-- Dependencies: 313
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- TOC entry 4947 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- TOC entry 4948 (class 0 OID 0)
-- Dependencies: 282
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- TOC entry 2533 (class 826 OID 16557)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- TOC entry 2534 (class 826 OID 16558)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- TOC entry 2532 (class 826 OID 16556)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- TOC entry 2543 (class 826 OID 16636)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- TOC entry 2542 (class 826 OID 16635)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- TOC entry 2541 (class 826 OID 16634)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- TOC entry 2546 (class 826 OID 16591)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2545 (class 826 OID 16590)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2544 (class 826 OID 16589)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2538 (class 826 OID 16571)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2540 (class 826 OID 16570)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2539 (class 826 OID 16569)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2525 (class 826 OID 16494)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2526 (class 826 OID 16495)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2524 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2528 (class 826 OID 16497)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2523 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2527 (class 826 OID 16496)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2536 (class 826 OID 16561)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- TOC entry 2537 (class 826 OID 16562)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- TOC entry 2535 (class 826 OID 16560)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- TOC entry 2531 (class 826 OID 16550)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2530 (class 826 OID 16549)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2529 (class 826 OID 16548)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 3767 (class 3466 OID 17121)
-- Name: ensure_rls; Type: EVENT TRIGGER; Schema: -; Owner: postgres
--

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION public.rls_auto_enable();


ALTER EVENT TRIGGER ensure_rls OWNER TO postgres;

--
-- TOC entry 3760 (class 3466 OID 16575)
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- TOC entry 3765 (class 3466 OID 16654)
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- TOC entry 3759 (class 3466 OID 16573)
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- TOC entry 3766 (class 3466 OID 16657)
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- TOC entry 3761 (class 3466 OID 16576)
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- TOC entry 3762 (class 3466 OID 16577)
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

-- Completed on 2026-03-10 00:42:18

--
-- PostgreSQL database dump complete
--

\unrestrict kWdb1IwmAeXKQck2US4iGabBSiZ4pcLPW6RFdV93f5eXKnrDaO7uQntdK01RgJo

-- Completed on 2026-03-10 00:42:18

--
-- PostgreSQL database cluster dump complete
--

