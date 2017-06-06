CREATE EXTENSION IF NOT EXISTS postgis;
SET time zone 'UTC';    -- Keep the backend working in UTC
SET intervalstyle = 'iso_8601';   -- Output time intervals in the iso 8601 format
SET datestyle = 'ISO';      -- Output dates in the iso 8601 format

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN
        CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
    END IF;
END$$;

CREATE TABLE users (
-- Core User attributes. Can't be null
id serial PRIMARY KEY,
name varchar(200) NOT NULL,
email varchar(200) UNIQUE,
pwh bytea NOT NULL,
salt bytea NOT NULL,
rounds integer NOT NULL,
jwt_secret varchar(32) NOT NULL,
-- User profile info. Should be optional
profile_bio text,
profile_photo varchar(200),
profile_joined timestamp DEFAULT 'now'::timestamp,
profile_help_count integer DEFAULT 0,
profile_rating_sum integer DEFAULT 0    -- Average rating = rating_sum/help_count
);

-- An experienced cyclist's route
CREATE TABLE experienced_routes (
id serial PRIMARY KEY,
route geography NOT NULL,		-- The route itself
departureTime time with time zone NOT NULL,	-- When the owner cycles this route
arrivalTime time with time zone NOT NULL,	-- When the  user arrives at the destination
days day_of_week[] DEFAULT ARRAY[]::day_of_week[],	-- An array of the days of the week a user cycles this route
owner integer REFERENCES users ON DELETE CASCADE	-- User who created this route
);

-- A inexperienced route
CREATE TABLE inexperienced_routes (
id serial PRIMARY KEY,
startPoint geography NOT NULL,      -- Where the user wants to leave from
endPoint geography NOT NULL,        -- Where the user wants to get to
radius integer DEFAULT 1000,        -- How far from the start and end points to look for matching routes
owner integer REFERENCES users ON DELETE CASCADE,    -- Who created this query
arrivalDateTime timestamp with time zone DEFAULT 'now',      -- When the user wants to arrive at their destination
notifyOwner boolean DEFAULT FALSE   -- If the owner wants to be notified of any new matches
);

CREATE INDEX IF NOT EXISTS user_email_index ON users USING btree ( "email" );
CREATE INDEX IF NOT EXISTS experienced_route_index ON experienced_routes USING GIST ( "route" );
CREATE INDEX IF NOT EXISTS experienced_route_owner_index ON experienced_routes USING btree ( "owner" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_start_index ON inexperienced_routes USING GIST ( "startpoint" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_end_index ON inexperienced_routes USING GIST ( "endpoint" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_owner_index ON inexperienced_routes USING btree ( "owner" );
