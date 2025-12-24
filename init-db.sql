-- ============================================
-- Buggy Shuttle - Database Initialization
-- Auto-generated for Coolify deployment
-- ============================================

-- Create enums
DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('available', 'busy', 'offline', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_status AS ENUM ('pending', 'assigned', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('assigned', 'pickup', 'dropoff', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE geofence_event_type AS ENUM ('enter', 'exit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    lat REAL NOT NULL DEFAULT 37.1385641,
    lng REAL NOT NULL DEFAULT 27.5607023,
    speed REAL NOT NULL DEFAULT 0,
    heading REAL NOT NULL DEFAULT 0,
    status vehicle_status NOT NULL DEFAULT 'offline',
    battery_level INTEGER DEFAULT 100,
    gps_signal BOOLEAN NOT NULL DEFAULT false,
    traccar_id INTEGER UNIQUE,
    current_task_id INTEGER,
    last_geofence_stop_id INTEGER,
    last_traccar_update TIMESTAMP,
    last_update TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Stops Table
CREATE TABLE IF NOT EXISTS stops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(10) NOT NULL DEFAULT '📍',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    geofence_radius INTEGER NOT NULL DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Calls Table
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES stops(id),
    status call_status NOT NULL DEFAULT 'pending',
    assigned_vehicle_id INTEGER REFERENCES vehicles(id),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    call_id INTEGER NOT NULL REFERENCES calls(id),
    pickup_stop_id INTEGER NOT NULL REFERENCES stops(id),
    dropoff_stop_id INTEGER REFERENCES stops(id),
    status task_status NOT NULL DEFAULT 'assigned',
    pickup_at TIMESTAMP,
    dropoff_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    auto_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Geofence Events Table
CREATE TABLE IF NOT EXISTS geofence_events (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    stop_id INTEGER NOT NULL REFERENCES stops(id),
    type geofence_event_type NOT NULL,
    distance REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vehicle Positions Table (GPS History)
CREATE TABLE IF NOT EXISTS vehicle_positions (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed REAL NOT NULL,
    heading REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Daily Stats Table
CREATE TABLE IF NOT EXISTS daily_stats (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL UNIQUE,
    total_calls INTEGER NOT NULL DEFAULT 0,
    completed_calls INTEGER NOT NULL DEFAULT 0,
    cancelled_calls INTEGER NOT NULL DEFAULT 0,
    average_wait_time INTEGER NOT NULL DEFAULT 0,
    average_trip_time INTEGER NOT NULL DEFAULT 0,
    total_trips INTEGER NOT NULL DEFAULT 0,
    peak_hour INTEGER,
    busiest_stop INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_traccar_id ON vehicles(traccar_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_stop_id ON calls(stop_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_vehicle_id ON tasks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_id ON geofence_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON geofence_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_vehicle_id ON vehicle_positions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_timestamp ON vehicle_positions(timestamp);

-- Insert default data
INSERT INTO stops (name, icon, lat, lng, geofence_radius) VALUES
    ('Lobi', '🏨', 37.138564, 27.560702, 15),
    ('Havuz', '🏊', 37.139200, 27.561500, 15),
    ('Plaj', '🏖️', 37.137800, 27.562300, 15),
    ('Restoran', '🍽️', 37.138900, 27.559800, 15),
    ('Spa', '💆', 37.137500, 27.560100, 15)
ON CONFLICT (name) DO NOTHING;

INSERT INTO vehicles (name, plate_number, status) VALUES
    ('Buggy 1', '48 ABC 001', 'available'),
    ('Buggy 2', '48 ABC 002', 'available'),
    ('Buggy 3', '48 ABC 003', 'offline')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
