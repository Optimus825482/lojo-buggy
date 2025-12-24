--
-- PostgreSQL database dump
--

\restrict l8gNNlrw1oHQdaI4JwH4DKnzTsoc115fBALdSGXh9xpX1JktLhEtfyR8VVsqhBU

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

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
-- Name: call_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.call_status AS ENUM (
    'pending',
    'assigned',
    'completed',
    'cancelled'
);


ALTER TYPE public.call_status OWNER TO postgres;

--
-- Name: geofence_event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.geofence_event_type AS ENUM (
    'enter',
    'exit'
);


ALTER TYPE public.geofence_event_type OWNER TO postgres;

--
-- Name: task_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_status AS ENUM (
    'assigned',
    'pickup',
    'dropoff',
    'completed',
    'cancelled'
);


ALTER TYPE public.task_status OWNER TO postgres;

--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.vehicle_status AS ENUM (
    'available',
    'busy',
    'offline',
    'maintenance'
);


ALTER TYPE public.vehicle_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calls (
    id integer NOT NULL,
    status public.call_status DEFAULT 'pending'::public.call_status NOT NULL,
    stop_id integer NOT NULL,
    assigned_vehicle_id integer,
    assigned_at timestamp without time zone,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancel_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.calls OWNER TO postgres;

--
-- Name: calls_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calls_id_seq OWNER TO postgres;

--
-- Name: calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calls_id_seq OWNED BY public.calls.id;


--
-- Name: daily_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_stats (
    id integer NOT NULL,
    date timestamp without time zone NOT NULL,
    total_calls integer DEFAULT 0 NOT NULL,
    completed_calls integer DEFAULT 0 NOT NULL,
    cancelled_calls integer DEFAULT 0 NOT NULL,
    average_wait_time integer DEFAULT 0 NOT NULL,
    average_trip_time integer DEFAULT 0 NOT NULL,
    total_trips integer DEFAULT 0 NOT NULL,
    peak_hour integer,
    busiest_stop integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.daily_stats OWNER TO postgres;

--
-- Name: daily_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_stats_id_seq OWNER TO postgres;

--
-- Name: daily_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_stats_id_seq OWNED BY public.daily_stats.id;


--
-- Name: geofence_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.geofence_events (
    id integer NOT NULL,
    type public.geofence_event_type NOT NULL,
    distance real NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    vehicle_id integer NOT NULL,
    stop_id integer NOT NULL
);


ALTER TABLE public.geofence_events OWNER TO postgres;

--
-- Name: geofence_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.geofence_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.geofence_events_id_seq OWNER TO postgres;

--
-- Name: geofence_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.geofence_events_id_seq OWNED BY public.geofence_events.id;


--
-- Name: stops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stops (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(10) DEFAULT '📍'::character varying NOT NULL,
    lat real NOT NULL,
    lng real NOT NULL,
    geofence_radius integer DEFAULT 15 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stops OWNER TO postgres;

--
-- Name: stops_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stops_id_seq OWNER TO postgres;

--
-- Name: stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stops_id_seq OWNED BY public.stops.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    status public.task_status DEFAULT 'assigned'::public.task_status NOT NULL,
    vehicle_id integer NOT NULL,
    call_id integer NOT NULL,
    pickup_stop_id integer NOT NULL,
    dropoff_stop_id integer,
    pickup_at timestamp without time zone,
    dropoff_at timestamp without time zone,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    auto_completed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: vehicle_positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_positions (
    id integer NOT NULL,
    lat real NOT NULL,
    lng real NOT NULL,
    speed real NOT NULL,
    heading real NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    vehicle_id integer NOT NULL
);


ALTER TABLE public.vehicle_positions OWNER TO postgres;

--
-- Name: vehicle_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_positions_id_seq OWNER TO postgres;

--
-- Name: vehicle_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_positions_id_seq OWNED BY public.vehicle_positions.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    lat real DEFAULT 37.1385641 NOT NULL,
    lng real DEFAULT 27.5607023 NOT NULL,
    speed real DEFAULT 0 NOT NULL,
    heading real DEFAULT 0 NOT NULL,
    status public.vehicle_status DEFAULT 'offline'::public.vehicle_status NOT NULL,
    plate_number character varying(20) NOT NULL,
    battery_level integer DEFAULT 100,
    gps_signal boolean DEFAULT false NOT NULL,
    traccar_id integer,
    current_task_id integer,
    last_update timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicles_id_seq OWNER TO postgres;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: calls id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls ALTER COLUMN id SET DEFAULT nextval('public.calls_id_seq'::regclass);


--
-- Name: daily_stats id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_stats ALTER COLUMN id SET DEFAULT nextval('public.daily_stats_id_seq'::regclass);


--
-- Name: geofence_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_events ALTER COLUMN id SET DEFAULT nextval('public.geofence_events_id_seq'::regclass);


--
-- Name: stops id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops ALTER COLUMN id SET DEFAULT nextval('public.stops_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: vehicle_positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_positions ALTER COLUMN id SET DEFAULT nextval('public.vehicle_positions_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Data for Name: calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calls (id, status, stop_id, assigned_vehicle_id, assigned_at, completed_at, cancelled_at, cancel_reason, created_at, updated_at) FROM stdin;
2	cancelled	16	\N	\N	\N	2025-12-24 05:30:14.201	Manuel iptal	2025-12-24 05:45:48.484806	2025-12-24 05:30:14.201
4	cancelled	10	\N	\N	\N	2025-12-24 05:30:15.774	Manuel iptal	2025-12-24 06:03:07.951653	2025-12-24 05:30:15.774
16	cancelled	13	\N	\N	\N	2025-12-24 06:52:41.473	Manuel iptal	2025-12-24 09:03:01.44533	2025-12-24 06:52:41.473
17	completed	12	8	2025-12-24 07:05:58.023	2025-12-24 07:09:12.294	\N	\N	2025-12-24 10:04:34.92099	2025-12-24 07:09:12.294
18	assigned	17	9	2025-12-24 07:24:08.684	\N	\N	\N	2025-12-24 10:23:30.101034	2025-12-24 07:24:08.684
15	cancelled	13	\N	\N	2025-12-24 04:53:49.699	2025-12-24 04:57:18.499	Manuel iptal	2025-12-24 07:52:13.586661	2025-12-24 04:57:18.499
14	cancelled	6	\N	\N	2025-12-24 04:46:17.918	2025-12-24 04:57:20.51	Manuel iptal	2025-12-24 07:30:39.219479	2025-12-24 04:57:20.51
13	cancelled	10	\N	\N	2025-12-24 04:47:04.873	2025-12-24 04:57:22.063	Manuel iptal	2025-12-24 07:30:36.496852	2025-12-24 04:57:22.063
12	cancelled	5	\N	\N	2025-12-24 04:47:12.983	2025-12-24 04:57:23.564	Manuel iptal	2025-12-24 07:16:45.034089	2025-12-24 04:57:23.564
11	cancelled	20	\N	\N	2025-12-24 04:49:36.368	2025-12-24 04:57:24.685	Manuel iptal	2025-12-24 07:15:26.650418	2025-12-24 04:57:24.685
10	cancelled	1	\N	\N	\N	2025-12-24 04:57:26.018	Manuel iptal	2025-12-24 07:05:18.906415	2025-12-24 04:57:26.018
9	cancelled	2	\N	\N	\N	2025-12-24 04:57:27.218	Manuel iptal	2025-12-24 07:04:06.145421	2025-12-24 04:57:27.218
8	cancelled	19	\N	\N	\N	2025-12-24 04:57:28.422	Manuel iptal	2025-12-24 06:53:23.928334	2025-12-24 04:57:28.422
7	cancelled	20	\N	\N	\N	2025-12-24 04:57:29.763	Manuel iptal	2025-12-24 06:52:36.349045	2025-12-24 04:57:29.763
6	cancelled	9	\N	\N	2025-12-24 04:49:15.29	2025-12-24 04:57:31.201	Manuel iptal	2025-12-24 06:41:42.036567	2025-12-24 04:57:31.201
5	completed	5	9	2025-12-24 04:57:56.042	2025-12-24 04:58:25.532	2025-12-24 04:50:07.8	Manuel iptal	2025-12-24 06:08:00.138385	2025-12-24 04:58:25.532
1	completed	11	7	2025-12-24 04:59:12.184	2025-12-24 05:00:59.3	2025-12-24 04:47:45.268	Manuel iptal	2025-12-24 05:37:11.314372	2025-12-24 05:00:59.3
3	completed	3	9	2025-12-24 05:02:03.355	2025-12-24 05:02:22.896	2025-12-24 04:47:25.456	Manuel iptal	2025-12-24 06:02:47.696182	2025-12-24 05:02:22.896
\.


--
-- Data for Name: daily_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_stats (id, date, total_calls, completed_calls, cancelled_calls, average_wait_time, average_trip_time, total_trips, peak_hour, busiest_stop, created_at, updated_at) FROM stdin;
2	2025-12-23 21:00:00	18	10	51	0	89	1	\N	\N	2025-12-24 04:15:14.739583	2025-12-24 07:23:30.12
\.


--
-- Data for Name: geofence_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.geofence_events (id, type, distance, "timestamp", vehicle_id, stop_id) FROM stdin;
1	enter	0	2025-12-24 07:46:01.30936	7	6
2	enter	0	2025-12-24 07:46:17.914511	7	1
3	enter	0	2025-12-24 07:46:25.849427	8	10
4	enter	0	2025-12-24 07:46:35.244589	7	5
5	enter	0	2025-12-24 07:47:04.870275	8	7
6	enter	0	2025-12-24 07:47:12.980043	7	3
7	enter	0	2025-12-24 07:47:17.512044	9	20
8	enter	0	2025-12-24 07:47:25.37079	8	9
9	enter	0	2025-12-24 07:49:15.285432	8	16
10	enter	0	2025-12-24 07:49:36.364116	9	11
11	enter	0	2025-12-24 07:53:36.273996	7	13
12	enter	0	2025-12-24 07:53:49.698489	7	12
13	enter	0	2025-12-24 07:58:12.910027	9	5
14	enter	0	2025-12-24 07:58:25.529097	9	1
15	enter	0	2025-12-24 07:59:24.482969	7	11
16	enter	0	2025-12-24 08:00:59.289818	7	2
17	enter	0	2025-12-24 08:02:14.814215	9	3
18	enter	0	2025-12-24 08:02:22.894489	9	2
19	enter	0	2025-12-24 08:16:23.120829	7	10
20	enter	0	2025-12-24 08:18:51.264623	9	16
21	enter	0	2025-12-24 09:10:33.567874	9	13
22	enter	0	2025-12-24 10:07:43.109854	8	12
23	enter	0	2025-12-24 10:09:12.279915	8	1
24	enter	0	2025-12-24 10:24:53.884627	9	17
\.


--
-- Data for Name: stops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stops (id, name, icon, lat, lng, geofence_radius, is_active, created_at, updated_at) FROM stdin;
1	Ana Lobi	🏨	37.138565	27.560701	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
2	Spa	🧖	37.138298	27.561077	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
3	Havuz 1	🏊	37.13825	27.560606	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
4	Havuz 2	🏊	37.138298	27.560469	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
5	Restoran	🍽️	37.138622	27.559975	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
6	Blok A	🏨	37.138435	27.559345	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
7	Villa 1	🏡	37.138348	27.557083	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
8	Villa 2	🏡	37.137943	27.55726	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
9	Villa 3	🏡	37.138493	27.55769	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
10	Villa 4	🏡	37.138073	27.55786	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
11	Blok B	🏨	37.13813	27.559404	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
12	Blok C	🏨	37.137947	27.56031	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
13	Beach Üst	🏖️	37.137543	27.560497	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
14	Beach Orta	🏖️	37.13693	27.560394	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
15	Beach Alt	🏖️	37.136288	27.560455	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
16	Beach Club	🏖️	37.136112	27.56008	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
17	Sahil Yolu	🛤️	37.13684	27.559666	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
18	Plaj Giriş	🏖️	37.13728	27.558065	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
19	İskele	⚓	37.13599	27.560616	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
20	Tenis Kortları	🎾	37.137783	27.561644	15	t	2025-12-24 04:15:14.727303	2025-12-24 04:15:14.727303
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, key, value, created_at, updated_at) FROM stdin;
6	geofenceRadius	15	2025-12-24 04:15:14.736646	2025-12-24 04:15:14.736646
7	autoAssign	true	2025-12-24 04:15:14.736646	2025-12-24 04:15:14.736646
8	autoComplete	true	2025-12-24 04:15:14.736646	2025-12-24 04:15:14.736646
9	gpsUpdateInterval	10000	2025-12-24 04:15:14.736646	2025-12-24 04:15:14.736646
10	maxActiveCallsPerStop	1	2025-12-24 04:15:14.736646	2025-12-24 04:15:14.736646
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, status, vehicle_id, call_id, pickup_stop_id, dropoff_stop_id, pickup_at, dropoff_at, completed_at, cancelled_at, auto_completed, created_at, updated_at) FROM stdin;
38	cancelled	7	16	13	\N	\N	\N	\N	2025-12-24 06:07:20.556	f	2025-12-24 09:03:17.243498	2025-12-24 06:07:20.556
41	cancelled	9	16	13	3	2025-12-24 06:10:33.569	\N	\N	2025-12-24 06:28:40.303	f	2025-12-24 09:10:23.086701	2025-12-24 06:28:40.303
42	cancelled	9	16	13	\N	\N	\N	\N	2025-12-24 06:52:37.973	f	2025-12-24 09:28:47.514834	2025-12-24 06:52:37.973
43	completed	8	17	12	1	2025-12-24 07:07:43.111	\N	2025-12-24 07:09:12.287	\N	t	2025-12-24 10:05:58.011748	2025-12-24 07:09:12.287
44	pickup	9	18	17	1	2025-12-24 07:24:53.886	\N	\N	\N	f	2025-12-24 10:24:08.673474	2025-12-24 07:25:11.076
\.


--
-- Data for Name: vehicle_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_positions (id, lat, lng, speed, heading, "timestamp", vehicle_id) FROM stdin;
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicles (id, name, lat, lng, speed, heading, status, plate_number, battery_level, gps_signal, traccar_id, current_task_id, last_update, created_at, updated_at) FROM stdin;
9	Buggy 3	37.138565	27.560701	0	0	busy	48 LJ 003	100	f	\N	\N	2025-12-24 07:27:52.259	2025-12-24 04:15:14.733505	2025-12-24 07:27:52.259
8	Buggy 2	37.138565	27.560701	0	0	available	48 LJ 002	100	f	\N	\N	2025-12-24 07:09:12.265	2025-12-24 04:15:14.733505	2025-12-24 07:09:12.303
7	Buggy 1	37.138073	27.55786	0	0	available	48 LJ 001	100	f	\N	\N	2025-12-24 07:07:20.996	2025-12-24 04:15:14.733505	2025-12-24 07:15:36.142
\.


--
-- Name: calls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.calls_id_seq', 18, true);


--
-- Name: daily_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_stats_id_seq', 81, true);


--
-- Name: geofence_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.geofence_events_id_seq', 24, true);


--
-- Name: stops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stops_id_seq', 20, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 10, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 44, true);


--
-- Name: vehicle_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_positions_id_seq', 1, false);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 9, true);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: daily_stats daily_stats_date_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_date_unique UNIQUE (date);


--
-- Name: daily_stats daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_stats
    ADD CONSTRAINT daily_stats_pkey PRIMARY KEY (id);


--
-- Name: geofence_events geofence_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_pkey PRIMARY KEY (id);


--
-- Name: stops stops_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_name_unique UNIQUE (name);


--
-- Name: stops stops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: vehicle_positions vehicle_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_positions
    ADD CONSTRAINT vehicle_positions_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_name_unique UNIQUE (name);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_plate_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_number_unique UNIQUE (plate_number);


--
-- Name: vehicles vehicles_traccar_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_traccar_id_unique UNIQUE (traccar_id);


--
-- Name: calls calls_assigned_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_assigned_vehicle_id_vehicles_id_fk FOREIGN KEY (assigned_vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: calls calls_stop_id_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_stop_id_stops_id_fk FOREIGN KEY (stop_id) REFERENCES public.stops(id);


--
-- Name: geofence_events geofence_events_stop_id_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_stop_id_stops_id_fk FOREIGN KEY (stop_id) REFERENCES public.stops(id);


--
-- Name: geofence_events geofence_events_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.geofence_events
    ADD CONSTRAINT geofence_events_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tasks tasks_call_id_calls_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_call_id_calls_id_fk FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: tasks tasks_dropoff_stop_id_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_dropoff_stop_id_stops_id_fk FOREIGN KEY (dropoff_stop_id) REFERENCES public.stops(id);


--
-- Name: tasks tasks_pickup_stop_id_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pickup_stop_id_stops_id_fk FOREIGN KEY (pickup_stop_id) REFERENCES public.stops(id);


--
-- Name: tasks tasks_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: vehicle_positions vehicle_positions_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_positions
    ADD CONSTRAINT vehicle_positions_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict l8gNNlrw1oHQdaI4JwH4DKnzTsoc115fBALdSGXh9xpX1JktLhEtfyR8VVsqhBU

