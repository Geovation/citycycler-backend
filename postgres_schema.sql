CREATE EXTENSION IF NOT EXISTS postgis;
SET time zone 'UTC';    -- Keep the backend working in UTC
SET intervalstyle = 'iso_8601';   -- Output time intervals in the iso 8601 format
SET datestyle = 'ISO';      -- Output dates in the iso 8601 format

-- Create enum types
DO $$
BEGIN
    -- A day_of_week type, which must be a day of the week
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN
        CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
    END IF;
    -- A ride difficulty type, which must be quiet, balanced of fast
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_difficulty') THEN
        CREATE TYPE ride_difficulty AS ENUM ('quiet', 'balanced', 'fast');
    END IF;
    -- A type for storing the user's distance preference in, miles or km
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distance_units') THEN
        CREATE TYPE distance_units AS ENUM ('miles', 'kilometers');
    END IF;
    -- A type for buddy request statuses
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'buddy_request_status') THEN
        CREATE TYPE buddy_request_status AS ENUM ('pending', 'accepted', 'rejected', 'canceled', 'completed');
    END IF;
END$$;

CREATE TABLE users (
-- Core User attributes. Can't be null
id varchar(40) PRIMARY KEY,
firstname varchar(200) NOT NULL,
surname varchar(200) NOT NULL,
email varchar(200) UNIQUE,
pwh bytea,
salt bytea,
rounds integer,
jwt_secret varchar(32),
-- User profile info. Should be optional
profile_bio text,
profile_photo varchar(200),             -- The url to the user's profile photo
profile_joined timestamptz DEFAULT 'now'::timestamptz,
profile_help_count integer DEFAULT 0,   -- How many times this user has helped an inexperienced cyclist
profile_rating_sum integer DEFAULT 0,   -- Average rating = rating_sum/help_count
profile_helped_count integer DEFAULT 0, -- How many times this user has been buddied up with an experienced cyclist
profile_distance double precision DEFAULT 0,      -- Total distance this user has cycled
preferences_difficulty ride_difficulty DEFAULT 'balanced'::ride_difficulty,    -- This user's preference for ride difficulty
preferences_units distance_units DEFAULT 'miles'::distance_units    -- This user's prefered unit for distance
);

-- An experienced cyclist's route
CREATE TABLE experienced_routes (
id serial PRIMARY KEY,
name text NOT NULL,             -- The name of this route
route geography NOT NULL,		-- The route itself
startPointName text NOT NULL,   -- The english name of this route's start point
endPointName text NOT NULL,     -- The english name of this route's end point
departureTime time with time zone NOT NULL,	-- When the owner cycles this route
arrivalTime time with time zone NOT NULL,	-- When the  user arrives at the destination
days day_of_week[] DEFAULT ARRAY[]::day_of_week[],	-- An array of the days of the week a user cycles this route
owner varchar(40) REFERENCES users ON DELETE CASCADE,	-- User who created this route
difficulty ride_difficulty DEFAULT 'balanced'::ride_difficulty,  -- How hard this route is
length integer NOT NULL,        -- How long the route is in meters
deleted boolean DEFAULT FALSE   -- Whether this route is deleted or not
);

-- A inexperienced route
CREATE TABLE inexperienced_routes (
id serial PRIMARY KEY,
name text NOT NULL,                 -- The name of this route
startPoint geography NOT NULL,      -- Where the user wants to leave from
startPointName text NOT NULL,       -- The english name of where the user wants to leave from
endPoint geography NOT NULL,        -- Where the user wants to get to
endPointName text NOT NULL,         -- The english name of where the user wants to get to
radius integer DEFAULT 1000,        -- How far from the start and end points to look for matching routes
owner varchar(40) REFERENCES users ON DELETE CASCADE,    -- Who created this query
arrivalDateTime timestamp with time zone DEFAULT 'now',      -- When the user wants to arrive at their destination
notifyOwner boolean DEFAULT FALSE,  -- If the owner wants to be notified of any new matches
difficulty ride_difficulty DEFAULT 'balanced'::ride_difficulty, -- How hard the user wants the route to be
                                                                -- Will match any rides with dificulty <= this
length integer NOT NULL,             -- How long the route is in meters
reusable boolean DEFAULT TRUE,        -- Whether the route can be reused for another buddy search
deleted boolean DEFAULT FALSE        -- Whether this route is deleted or not
);

-- A buddy request
CREATE TABLE buddy_requests (
id serial PRIMARY KEY,
experiencedRouteName text NOT NULL,         -- The name of the experienced route
experiencedRoute integer REFERENCES experienced_routes ON DELETE SET NULL,   -- The id of the experienced route
experiencedUser varchar(40) REFERENCES users ON DELETE SET NULL,                 -- The id of the experienced user
owner varchar(40) REFERENCES users ON DELETE SET NULL,                           -- The id of the inexperienced user
inexperiencedRouteName text NOT NULL,       -- The name of the inexperienced route
inexperiencedRoute integer REFERENCES inexperienced_routes ON DELETE SET NULL, -- The id of the inexperienced route
meetingTime timestamptz NOT NULL,           -- When the users will meet
divorceTime timestamptz NOT NULL,           -- When the users will part
meetingPoint geography NOT NULL,            -- Where the users will meet
divorcePoint geography NOT NULL,            -- Where the users will part
meetingPointName text NOT NULL,             -- Where the users will meet as an english string
divorcePointName text NOT NULL,             -- Where the users will part as an english string
route geography NOT NULL,                   -- The section of the experienced_route that these users will share
length integer NOT NULL,                    -- How long the shared section of route is in meters
averageSpeed double precision NOT NULL,     -- The average riding speed of this route
-- Having the average speed lets us easily calculate the time to/from the meeting/divorce points for both users
-- By calculating these when requested, updating the meeting/divorce point becomes much easier
created timestamptz DEFAULT 'now'::timestamptz, -- When this buddy request was created
updated timestamptz DEFAULT 'now'::timestamptz, -- When this buddy request was last updated
status buddy_request_status DEFAULT 'pending'::buddy_request_status,
reason text DEFAULT '',  -- A reason for the status
review integer DEFAULT 0 -- The score (+1,-1) given to this ride by the inexperiencedUser
);

CREATE INDEX IF NOT EXISTS user_email_index ON users USING btree ( "email" );
CREATE INDEX IF NOT EXISTS experienced_route_index ON experienced_routes USING GIST ( "route" );
CREATE INDEX IF NOT EXISTS experienced_route_owner_index ON experienced_routes USING btree ( "owner" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_start_index ON inexperienced_routes USING GIST ( "startpoint" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_end_index ON inexperienced_routes USING GIST ( "endpoint" );
CREATE INDEX IF NOT EXISTS inexperienced_routes_owner_index ON inexperienced_routes USING btree ( "owner" );
