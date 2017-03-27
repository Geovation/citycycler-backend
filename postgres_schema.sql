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

CREATE TABLE routes (
id serial PRIMARY KEY,
route geometry NOT NULL,		-- The route itself
departureTime integer NOT NULL,	-- Seconds past midnight that the owner cycles this route
arrivalTime integer NOT NULL,	-- The time that a user arrives in seconds past midnight
days smallint NOT NULL,			-- A bitmask of the days of the week a user cycles this route
owner integer REFERENCES users ON DELETE CASCADE	-- User who created this route
);

CREATE INDEX IF NOT EXISTS route_index ON routes USING GIST ( "route" );
CREATE INDEX IF NOT EXISTS owner_index ON routes USING btree ( "owner" );
