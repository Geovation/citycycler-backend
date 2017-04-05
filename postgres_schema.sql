CREATE EXTENSION IF NOT EXISTS postgis;

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
profile_joined integer DEFAULT extract(epoch from now())::Integer,
profile_help_count integer DEFAULT 0,
profile_rating_sum integer DEFAULT 0    -- Average rating = rating_sum/help_count
);

-- An experienced cyclist's route
CREATE TABLE routes (
id serial PRIMARY KEY,
route geography NOT NULL,		-- The route itself
departureTime integer NOT NULL,	-- Seconds past midnight that the owner cycles this route
arrivalTime integer NOT NULL,	-- The time that a user arrives in seconds past midnight
days bit(7) DEFAULT b'1111111',	-- A bitstring of the days of the week a user cycles this route
owner integer REFERENCES users ON DELETE CASCADE	-- User who created this route
);

-- An inexperienced cyclist's route - has a start/end point instead of a full route
CREATE TABLE route_queries (
id serial PRIMARY KEY,
startPoint geography NOT NULL,      -- Where the user wants to leave from
endPoint geography NOT NULL,        -- Where the user wants to get to
radius integer DEFAULT 1000,        -- How far from the start and end points to look for matching routes
owner integer REFERENCES users ON DELETE CASCADE,    -- Who created this query
arrivalTime integer DEFAULT 0,      -- When the user wants to arrive at their destination
days bit(7) DEFAULT b'1111111'      -- A bitstring of the days of the week that this user wants to cycle the route
);

CREATE INDEX IF NOT EXISTS user_email_index ON users USING btree ( "email" );
CREATE INDEX IF NOT EXISTS route_index ON routes USING GIST ( "route" );
CREATE INDEX IF NOT EXISTS route_owner_index ON routes USING btree ( "owner" );
CREATE INDEX IF NOT EXISTS route_query_start_index ON route_queries USING GIST ( "startpoint" );
CREATE INDEX IF NOT EXISTS route_query_end_index ON route_queries USING GIST ( "endpoint" );
CREATE INDEX IF NOT EXISTS route_query_owner_index ON route_queries USING btree ( "owner" );
