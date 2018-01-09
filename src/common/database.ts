import BuddyRequest from "./BuddyRequestDataModel";
import ExperiencedRoute from "./ExperiencedRouteDataModel";
import InexperiencedRoute from "./InexperiencedRouteDataModel";
import User from "./UserDataModels";
import * as fs from "fs";
import * as _ from "lodash";
import * as pg from "pg";

// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
const config = {
    database: "matchMyRoute", // env var: PGDATABASE
    // host: "35.190.143.196", // Server hosting the postgres database
    host: process.env.DB_CONNECTION_PATH, // Server hosting the postgres database
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    max: 20, // max number of clients in the pool
    // user: "postgres", // env var: PGUSER
};

const testDatabase = "matchMyRouteTest";

// this initializes a connection pool
// it will keep idle connections open for a 30 seconds
// and set a limit of maximum 10 idle clients
let pool;
startUpPool(false);
// if an error is encountered by a client while it sits idle in the pool
// the pool itself will emit an error event with both the error and
// the client which emitted the original error
// this is a rare occurrence but can happen if there is a network partition
// between your application and the database, the database restarts, etc.
// and so you might want to handle it and at least log it out
pool.on("error", (err, client) => {
    console.error("idle client error", err.message, err.stack);
});

export function createTransactionClient() {
    return pool.connect()
    .then(client => {
        return client.query("BEGIN")
        .then((res) => {
          return client;
        });
    });
}

function checkClient(client) {
    if (client === null) {
        // console.log("recreating client");
        return pool.connect();
    } else {
        // console.log("using existing client");
        return Promise.resolve(client);
    }
}

export function rollbackAndReleaseTransaction(client, source = "") {
    // console.log("rolling back from source " + source);
    return client.query("ROLLBACK").
    then(() => {
        // console.log("rolled back successfully");
        return client.release(true);
    });
}

export function commitAndReleaseTransaction(client) {
    return client.query("COMMIT").then(e => {
        client.release(true);
    });
}

export function sqlTransaction(query: string, params: Array<any> = [], providedClient = null): Promise<any> {
    let client;
    // console.log("in sqlTransaction");
    return checkClient(providedClient).then(returnedClient => {
        client = returnedClient;
        return client.query(query, params);
    }).then(response => {
        if (providedClient === null) {
            // TODO: This should not automatically COMMIT, but instead the endpoint
            // should decide what to do and in case of failure roll back the transaction
            client.query("COMMIT").then(e => {
                client.release(true);
          });
        }
        return response;
    });
}

// This shuts down the pool right away
// Normally this shouldn't matter, but during tests the pool will
// wait 30s before closing, which makes the tests take ages
export function shutDownPool(): Promise<boolean> {
    return pool.end().then(() => {
        return true;
    }, err => {
        console.error(err);
        return false;
    });
    // return pool.end().then(() => {
    //     return true;
    // }).catch(err => {
    //     console.error(err);
    //     return false;
    // });
}

// This starts up a pool. It should usually only be called once on app startup.
// We need to call it multiple times to run our tests though
export function startUpPool(testing: boolean): void {
    // console.log("starting up pool in env " + process.env.NODE_ENV);
    if (testing) {
        config.database = testDatabase;
    }
    pool = new pg.Pool(config);
}

/**
 * resetDatabase - resets the database schema in the given database to original state
 */
export function resetDatabase() {
    return sqlTransaction("DROP SCHEMA IF EXISTS public CASCADE;", [])
        .then(result => {
            return sqlTransaction("CREATE SCHEMA public AUTHORIZATION " + process.env.PGUSER + ";", []);
        })
        .then(result => {
            return new Promise((resolve, reject) => {
                fs.readFile("postgres_schema.sql", "utf8", (err, data) => {
                    if (err) {
                        reject(new Error("Could not read schema file"));
                    }
                    const schemaRecreateCommands = data;
                    resolve(sqlTransaction(schemaRecreateCommands));
                });
            });
        })
        .then(result => {
            console.info("Database recreated successfully");
        });
}

// Put an experienced route in the database, returning the new database ID for the route
export function putExperiencedRoute(routeData: ExperiencedRoute, providedClient = null) {
    const wkt = coordsToLineString(routeData.route);
    const query = "INSERT INTO experienced_routes (route, departureTime, arrivalTime, days, owner, " +
        "startPointName, endPointName, name, length) " +
        "VALUES (ST_GeogFromText($1),$2,$3,$4::day_of_week[],$5,$6,$7,$8,$9) " +
        "RETURNING id";
    const sqlParams = [
        wkt,
        routeData.departureTime,
        routeData.arrivalTime,
        routeData.days,
        routeData.owner,
        routeData.startPointName,
        routeData.endPointName,
        routeData.name,
        routeData.length,
    ];
    return sqlTransaction(query, sqlParams, providedClient).then(result => {
        if (result.rowCount > 0) {
            return result.rows[0].id;
        } else {
            throw new Error("500:Route could not be created");
        }
    });
}

export function getExperiencedRouteById(id: number, providedClient = null): Promise<ExperiencedRoute> {
    const query = "SELECT id, owner, departuretime, arrivalTime, days::text[], ST_AsText(route) AS route, " +
        "startPointName, endPointName, length, name FROM experienced_routes where id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rows[0]) {
            return ExperiencedRoute.fromSQLRow(result.rows[0]);
        } else {
            throw new Error("404:ExperiencedRoute doesn't exist");
        }
    });
}

/**
 * getExperiencedRoutes - description
 *
 * @param  {object} params The query parameters, including the id of the route to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of experienced_routes
 */
export function getExperiencedRoutes(
    params: {
        userId: string,
        id?: number,
        includedeleted?: boolean
    },
    providedClient = null): Promise<ExperiencedRoute[]> {
    let query = "SELECT id, owner, departuretime, arrivalTime, days::text[], ST_AsText(route) AS route, " +
    "startPointName, endPointName, length, name, deleted FROM experienced_routes where owner=$1";
    let queryParams = new Array<any>();
    queryParams.push(params.userId);
    if (params.id !== null && typeof params.id !== "undefined") {
        query +=  " AND id=$2";
        queryParams.push(params.id);
    }
    if (!params.includedeleted) {
        query += " AND deleted=false";
    }
    query += " ORDER BY id DESC";
    return sqlTransaction(query, queryParams, providedClient).then(result => {
        if (params.id !== undefined && params.id !== null && result.rows.length === 0) {
            throw new Error("404:ExperiencedRoute does not exist or is a deleted route");
        }
        return result.rows.map((route) => {
            return ExperiencedRoute.fromSQLRow(route);
        });
    });
}

export function lineStringToCoords(lineStr: string): number[][] {
    if (lineStr.slice(0, 11) !== "LINESTRING(") {
        throw "Input is not a Linestring";
    }
    let coords = [];
    const coordStr = lineStr.slice(11, lineStr.length - 1);
    coordStr.split(",").forEach((strPair) => {
        coords.push([
            parseFloat(strPair.split(" ")[0]),
            parseFloat(strPair.split(" ")[1]),
        ]);
    });
    return coords;
}

export function pointStringToCoords(pointStr: string): number[] {
    if (pointStr.slice(0, 6) !== "POINT(") {
        throw "Input is not a Point.";
    }
    const coordStr = pointStr.slice(6, pointStr.length - 1);
    return coordStr.split(" ").map(parseFloat);
}

export function coordsToLineString(coords: number[][]): string {
    return "LINESTRING(" + coords.map((pair) => {
        return pair.join(" ");
    }).join(",") + ")";
}

export function coordsToPointString(coord: [number, number]): string {
    return "POINT(" + coord.join(" ") + ")";
}

export function getExperiencedRoutesNearby(radius: number, lat: number, lon: number, providedClient = null)
: Promise<any> {
    if (radius > 2000 || radius < 1) {
        return new Promise((resolve, reject) => {
            reject("400:Radius out of bounds");
        });
    }
    const query = "select id, owner, departuretime, arrivalTime, ST_AsText(route) AS route, " +
        "startPointName, endPointName, name, length from experienced_routes " +
        "where ST_DISTANCE(route, ST_GeogFromText($2) ) < $1";
    const geoJson = "POINT(" + lat + " " + lon + ")";
    return sqlTransaction(query, [radius, geoJson], providedClient).then(result => {
        return result.rows.map(ExperiencedRoute.fromSQLRow);
    });
}

/**
 * The function this service is built around - route matching!
 * @param matchParams - The parameters that we use for matching - see the type definiton here or in the swagger docs
 *
 * @returns routes - A list of ExperiencedRoutes
 */
export function matchRoutes(
    matchParams: {
        arrivalDateTime: string,
        endPoint: [number, number],
        radius: number,
        startPoint: [number, number],
    },
    userId?: string,
    newArrivalDateTime = null,
    providedClient = null
): Promise<{
    id: number,
    averageSpeed: number,
    meetingTime: string,
    divorceTime: string,
    name: string,
    owner: User,
    length: number,
    meetingPoint: [number, number],
    divorcePoint: [number, number],
    timeToMeetingPoint: string,
    timeFromDivorcePoint: string,
    distanceToMeetingPoint: number,
    distanceFromDivorcePoint: number
    route: [number, number][],
}[]> {
    if (matchParams.radius > 2000 || matchParams.radius < 1) {
        return Promise.reject("400:Radius out of bounds. Must be between 1m and 2km");
    }
    let query = "" +
    "SELECT id, " +
    "    CAST(round(match1.averageSpeed::numeric, 1) AS DOUBLE PRECISION) AS averageSpeed, " +
    "    match2.meetingTime, " +
    "    match2.divorceTime, " +
    "    match2.matchedRoute AS route, " +
    "    round(ST_Length(match2.matchedRoute::geography)) AS length, " +
    "    ST_AsText(match2.meetingPoint) AS meetingPoint, " +
    "    ST_AsText(match2.divorcePoint) AS divorcePoint, " +
    "    match3.*, " +
    "    match4.*, " +
    "    owner, " +
    "    name " +
    "FROM experienced_routes, " +
    "    LATERAL ( " +
    "        SELECT " +
    "            (ST_LineLocatePoint(route::geometry, ST_GeogFromText($1)::geometry)) " +
    "                AS distFromStart, " +
    "            (ST_LineLocatePoint(route::geometry, ST_GeogFromText($2)::geometry)) " +
    "                AS distFromEnd, " +
    //           Get the day of the week as a day_of_week
    "            (SELECT pg_enum.enumlabel::day_of_week " +
    "                FROM pg_enum JOIN pg_type ON (pg_enum.enumtypid=pg_type.oid) " +
    "                WHERE pg_enum.enumsortorder = extract(isodow from $4::timestamp) " +
    "                AND pg_type.typname='day_of_week') AS requiredDay, " +
    "            $4::timestamptz::date AS requiredDate, " +
    //          Get the average speed in m/s
    "	        ST_Length(route::geography) / EXTRACT(EPOCH FROM (arrivalTime::time - departureTime::time)) " +
    "                AS averageSpeed " +
    "    ) AS match1, " +
    "    LATERAL ( " +
    "        SELECT " +
    "            requiredDate + departureTime::timetz + distFromStart*(arrivalTime::time - departureTime::time) " +
    "               AS meetingTime, " +
    "            requiredDate + departureTime::timetz + distFromEnd*(arrivalTime::time - departureTime::time) " +
    "               AS divorceTime, " +
    "            ST_AsText(ST_Line_Substring(route::geometry, distFromStart, distFromEnd)) AS matchedRoute, " +
    "            ST_LineInterpolatePoint(route::geometry, distFromStart) AS meetingPoint, " +
    "            ST_LineInterpolatePoint(route::geometry, distFromEnd) AS divorcePoint " +
    "    ) AS match2, " +
    "    LATERAL ( " +
    "	SELECT " +
    "	    ST_Distance(ST_GeogFromText($1), meetingPoint) AS distanceToMeetingPoint, " +
    "	    ST_Distance(ST_GeogFromText($2), divorcePoint) AS distanceToDivorcePoint " +
    "    ) AS match3, " +
    "    LATERAL ( " +
    "	SELECT " +
    "	    interval '1 second' * (distanceToMeetingPoint / averageSpeed) AS timeToMeetingPoint, " +
    "	    interval '1 second' * (distanceToDivorcePoint / averageSpeed) AS timeFromDivorcePoint " +
    "    ) AS match4 " +
    "WHERE " +
    "    distFromStart <  distFromEnd " +
    "AND " +
    "    ST_DWithin(ST_GeogFromText($1), route, $3) " +
    "AND " +
    "    ST_DWithin(ST_GeogFromText($2), route, $3) " +
    "AND " +
    "    requiredDay = ANY(days) " +
    "AND " +
    "    deleted = false ";
    // If userId is given, the experienced route of this user will not be matched
    if (userId) {
        query += `AND owner != '${userId}'`;
    }
    query += " ORDER BY divorceTime::time + timeFromDivorcePoint - $4::timestamptz::time";
    const startPoint = "POINT(" + matchParams.startPoint[0] + " " + matchParams.startPoint[1] + ")";
    const endPoint = "POINT(" + matchParams.endPoint[0] + " " + matchParams.endPoint[1] + ")";
    let queryParams = [
        startPoint,
        endPoint,
        matchParams.radius,
        newArrivalDateTime ? newArrivalDateTime : matchParams.arrivalDateTime,
    ];
    return sqlTransaction(query + ";", queryParams, providedClient).then(result => {
        return Promise.all(result.rows.map((row) => {
            return getUserById(row.owner, providedClient).then(user => {
                const userObj = Object.assign({}, user);
                delete userObj.pwh;
                delete userObj.salt;
                delete userObj.rounds;
                delete userObj.jwtSecret;
                return {
                    averageSpeed: row.averagespeed,
                    distanceFromDivorcePoint: row.distanceFromDivorcePoint,
                    distanceToMeetingPoint: row.distanceToMeetingPoint,
                    divorcePoint: pointStringToCoords(row.divorcepoint),
                    divorceTime: row.divorcetime,
                    id: row.id,
                    length: row.length,
                    meetingPoint: pointStringToCoords(row.meetingpoint),
                    meetingTime: row.meetingtime,
                    name: row.name,
                    owner: userObj,
                    route: lineStringToCoords(row.route),
                    timeFromDivorcePoint: row.timeFromdivorcePoint,
                    timeToMeetingPoint: row.timeToMeetingPoint,
                };
            });
        }));
    });

}

// Updates an experienced route from the given update object
export function updateExperiencedRoute(
    existingRoute: ExperiencedRoute,
    updates: {
        arrivalTime?: string,
        departureTime?: string,
        days?: string[],
        name?: string,
    },
    providedClient = null): Promise<boolean> {

        // Move the updated properties into the existing model, and validate the new route
        existingRoute.arrivalTime = updates.arrivalTime !== undefined ?
            updates.arrivalTime : existingRoute.arrivalTime;
        existingRoute.departureTime = updates.departureTime !== undefined ?
            updates.departureTime : existingRoute.departureTime;
        existingRoute.days = updates.days !== undefined ? updates.days : existingRoute.days;
        existingRoute.name = updates.name !== undefined ?
        updates.name : existingRoute.name;

        if (existingRoute.arrivalTime < existingRoute.departureTime) {
            return Promise.reject("400:Arrival time is before Departure time");
        }

        const query = "UPDATE experienced_routes " +
        "SET arrivalTime = $1, departureTime = $2, days = $3::day_of_week[], name=$4 " +
        "WHERE id = $5";
        const sqlParams = [
            existingRoute.arrivalTime,
            existingRoute.departureTime,
            existingRoute.days,
            existingRoute.name,
            existingRoute.id,
        ];

        return sqlTransaction(query, sqlParams, providedClient).then(result => {
            return true;
        });
}

export function deleteExperiencedRoute(id: number, providedClient = null): Promise<Boolean> {
    const query1 = "UPDATE buddy_requests SET status='canceled'::buddy_request_status, reason=" +
        "(SELECT users.firstname || ' ' || users.surname FROM users, experienced_routes " +
        "WHERE experienced_routes.id=$1 AND experienced_routes.owner=users.id)::text" +
        " || ' has deleted the route \"' || (SELECT name " +
        "FROM experienced_routes WHERE id=$1)::text || '\"' WHERE experiencedroute=$1;";
    const query2 = "UPDATE experienced_routes SET deleted=true WHERE id=$1";
    return sqlTransaction(query1, [id], providedClient).then(() => {
        return sqlTransaction(query2, [id], providedClient).then(result => {
            if (result.rowCount) {
                return true;
            } else {
                throw new Error("404:ExperiencedRoute doesn't exist");
            }
        });
    });
}

export function createInexperiencedRoute(owner: string, inexperiencedRoute: InexperiencedRoute, providedClient = null)
: Promise<Number> {
    inexperiencedRoute = new InexperiencedRoute(inexperiencedRoute);
    const query = "INSERT INTO inexperienced_routes (startPoint, startPointName, endPoint, endPointName, radius, " +
        "length, name, notifyOwner, arrivalDateTime, owner, reusable)" +
        "VALUES (ST_GeogFromText($1), $2, ST_GeogFromText($3), $4, $5, $6, $7, $8, $9, $10, $11)" +
        "RETURNING id";
    const queryParams = [
        coordsToPointString(inexperiencedRoute.startPoint),
        inexperiencedRoute.startPointName,
        coordsToPointString(inexperiencedRoute.endPoint),
        inexperiencedRoute.endPointName,
        inexperiencedRoute.radius,
        inexperiencedRoute.length,
        inexperiencedRoute.name,
        inexperiencedRoute.notifyOwner,
        inexperiencedRoute.arrivalDateTime,
        owner,
        inexperiencedRoute.reusable,
    ];
    return sqlTransaction(query, queryParams, providedClient).then(result => {
        return result.rows[0].id;
    });
}

/**
 * getInexperiencedRoutes - description
 *
 * @param  {object} params The query parameters, including the id of the inexperienced route to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of inexperienced routes
 */
export function getInexperiencedRoutes(
    params: {userId: string, id?: number, includedeleted?: boolean, onlyreusable?: boolean},
    providedClient = null
)
: Promise<InexperiencedRoute[]> {
    let query = "SELECT id, owner, radius, notifyOwner, arrivalDateTime, ST_AsText(startPoint) AS startPoint, " +
        "startPointName, ST_AsText(endPoint) AS endPoint, endPointName, length, name, deleted, reusable " +
        "FROM inexperienced_routes WHERE owner=$1";
    let queryParams = new Array<any>();
    queryParams.push(params.userId);
    if (params.id !== null && typeof params.id !== "undefined") {
        query += " AND id=$2";
        queryParams.push(params.id);
    }
    if (!params.includedeleted) {
        query += " AND deleted=false";
    }
    if (params.onlyreusable) {
        query += " AND reusable=true";
    }
    query += " ORDER BY id DESC";
    return sqlTransaction(query + ";", queryParams, providedClient).then(result => {
        if (params.id !== undefined && params.id !== null && result.rows.length === 0) {
            throw new Error("404:InexperiencedRoute does not exist or is a deleted route");
        }
        return result.rows.map((inexperiencedRoute) => {
            return InexperiencedRoute.fromSQLRow(inexperiencedRoute);
        });
    });
}

/**
 * updateInexperiencedRoute - description
 *
 * @param  {number} id The id of the inexperiencedRoute to delete
 * @param  {client} providedClient Database client to use for this interaction
 * @return {boolean} Whether the deletion succeeded
 */
export function deleteInexperiencedRoute(id: number, providedClient = null): Promise<Boolean> {
    const query1 = "UPDATE buddy_requests SET status='canceled'::buddy_request_status, reason=" +
        "(SELECT users.firstname || ' ' || users.surname FROM users, inexperienced_routes " +
        "WHERE inexperienced_routes.id=$1 AND inexperienced_routes.owner=users.id)::text" +
        " || ' no longer needs to buddy up with you' WHERE inexperiencedroute=$1";
    const query2 = "UPDATE inexperienced_routes SET deleted=true WHERE id=$1";
    return sqlTransaction(query1, [id], providedClient).then(() => {
        return sqlTransaction(query2, [id], providedClient).then(result => {
            if (result.rowCount) {
                return true;
            } else {
                throw new Error("404:InexperiencedRoute doesn't exist");
            }
        });
    });
}

/**
 * updateInexperiencedRoute - description
 *
 * @param  {InexperiencedRoute} existingRequest The old inexperiencedRoute to be updated
 * @param  {client} providedClient Database client to use for this interaction
 * @return {boolean} Whether the update succeeded
 */
export function updateInexperiencedRoute(
    existingRoute: InexperiencedRoute,
    updates: {
        arrivalDateTime?: string,
        name?: string,
        notifyOwner?: boolean,
        radius?: number,
    },
    providedClient = null): Promise<boolean> {
        // Move the updated properties into the existing model
        let newInexperiencedRouteObject = _.clone(updates);
        _.defaultsDeep(newInexperiencedRouteObject, existingRoute);

        // By instantating a new object, we run the tests in the constructor to make
        // sure that this is still a valid InexperiencedRoute
        const newInexperiencedRoute = new InexperiencedRoute(newInexperiencedRouteObject);

        const query = "UPDATE inexperienced_routes " +
        "SET arrivalDateTime = $1, notifyOwner = $2, radius = $3, " +
        "name=$4 WHERE id = $5";
        const sqlParams = [newInexperiencedRoute.arrivalDateTime,
            newInexperiencedRoute.notifyOwner,
            newInexperiencedRoute.radius,
            newInexperiencedRoute.name,
            existingRoute.id];

        return sqlTransaction(query, sqlParams, providedClient).then(result => {
            return true;
        });
}

/**
 * Put a new user in the database, returning the new user
 * @param name - The new user's name.
 * @param email - Email address. Must be unique.
 * @param pwh - The password hash, as generated in src/end-points/users/create.ts
 * @param salt - The password salt
 * @param rounds - How many rounds of hashing PBKDF2 should do.
 * @param jwtSecret - A random secret used to sign JSON Web Tokens given to this user
 *
 * @returns A User object
 */
export function putUser(params, providedClient = null): Promise<User> {
    let queryParts = [];
    let sqlParams = [];
    const keys = Object.keys(params);
    keys.forEach((key, i) => {
        queryParts.push("$" + (i + 1));
        sqlParams.push(params[key]);
    });
    const query = "INSERT INTO users (" + keys.join(", ") + ") VALUES (" + queryParts.join(",") + ") RETURNING *;";
    return sqlTransaction(query, sqlParams, providedClient)
        .then((result) => {
            if (result.rowCount > 0) {
                return User.fromSQLRow(result.rows[0]);
            } else {
                console.error("no row returned");
                throw new Error("409:An account already exists using this email");
            }
        })
        .catch((error) => {
            if (error.message === "duplicate key value violates unique constraint \"users_email_key\"") {
                throw new Error("409:An account already exists using this email");
            } else {
                throw new Error(error.message);
            }
        });
}

/**
 * Update a user in the database
 * @param id - The user id to be updated
 * @param updates - An object with the new values to be applied to the user
 * @param providedClient - existing client for running the query in a transaction
 *
 * @returns A promise that resolves when the user is updated
 */
export function updateUser(id, updates, providedClient = null): Promise<Boolean> {
    let queryParts = [];
    let sqlParams = [id];
    const keys = Object.keys(updates);
    keys.forEach((key, i) => {
        switch (key) {
            case "preferences_difficulty":
                queryParts.push(key + " = $" + (i + 2) + "::ride_difficulty ");
                break;
            case "preferences_units":
                queryParts.push(key + " = $" + (i + 2) + "::distance_units ");
                break;
            default:
                queryParts.push(key + " = $" + (i + 2) + " ");
        }
        sqlParams.push(updates[key]);
    });
    if (queryParts.length === 0) {
        throw new Error("400:No valid values to update");
    }
    const query = "UPDATE users SET " + queryParts.join(", ") + " WHERE id = $1;";
    return sqlTransaction(query, sqlParams, providedClient)
        .then((result) => {
            return true;
        })
        .catch((error) => {
            if (error.message === "duplicate key value violates unique constraint \"users_email_key\"") {
                throw new Error("409:An account already exists using this email");
            } else {
                throw new Error("error running query: " + error);
            }
        });
}

/**
 * Get a user from the database by email
 * @param email - Email address to search for
 * * @param providedClient - preexisting sql transaction client to run this operation on
 *
 * @returns A User object of the specified type
 */
export function getUserByEmail(email: string, providedClient = null): Promise<User> {
    const query = "SELECT * FROM users WHERE email=$1";
    return sqlTransaction(query, [email], providedClient).then(result => {
        if (result.rowCount > 0) {
            return User.fromSQLRow(result.rows[0]);
        } else {
            throw new Error("404:User doesn't exist");
        }
    });
}

/**
 * Get a user from the database by ID
 * @param providedClient - The postgresql client instance to run the query against
 * @param id - User id to get by
 * @param providedClient - preexisting sql transaction client to run this operation on
 *
 * @returns A User object of the specified type
 */
export function getUserById(id: string, providedClient = null): Promise<User> {
    const query = "SELECT * FROM users WHERE id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rowCount > 0) {
            return User.fromSQLRow(result.rows[0]);
        } else {
            throw new Error("404:User doesn't exist");
        }
    });
}

export function deleteUser(id: string, providedClient = null): Promise<Boolean> {
    // First update any buddy requests, then actually delete the user
    const query1 = "UPDATE buddy_requests SET status='canceled'::buddy_request_status, reason=" +
        "(SELECT firstname || ' ' || surname from users where id=$1)::text" +
        " || ' has deleted their account' WHERE experienceduser=$1 OR owner=$1";
    const query2 = "DELETE FROM users WHERE id=$1";
    return sqlTransaction(query1, [id], providedClient)
        .then(() => {
            return sqlTransaction(query2, [id], providedClient).then(result => {
                if (result.rowCount) {
                    return true;
                } else {
                    throw new Error("404:User doesn't exist");
                }
            });
        });
}

/**
 * createBuddyRequest - description
 *
 * @param  {buddyRequest} buddyRequest The BuddyRequest object to put in the database
 * @param  {client} providedClient Database client to use for this interaction
 * @return {number} The id of the created BuddyRequest
 */
export function createBuddyRequest(buddyRequest: BuddyRequest, providedClient = null)
: Promise<Number> {
    buddyRequest = new BuddyRequest(buddyRequest);
    const query = "INSERT INTO buddy_requests (experiencedRouteName, experiencedRoute, experiencedUser, owner, " +
        "inexperiencedRoute, meetingTime, divorceTime, meetingPoint, divorcePoint, averageSpeed, created, " +
        "updated, status, reason, route, meetingPointName, divorcePointName, length, inexperiencedRouteName)" +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeogFromText($8), ST_GeogFromText($9), $10, $11, $12, $13, " +
        "$14, ST_GeogFromText($15), $16, $17, $18, $19)" +
        "RETURNING id";
    const queryParams = [
        buddyRequest.experiencedRouteName,
        buddyRequest.experiencedRoute,
        buddyRequest.experiencedUser,
        buddyRequest.owner,
        buddyRequest.inexperiencedRoute,
        buddyRequest.meetingTime,
        buddyRequest.divorceTime,
        coordsToPointString(buddyRequest.meetingPoint),
        coordsToPointString(buddyRequest.divorcePoint),
        buddyRequest.averageSpeed,
        buddyRequest.created,
        buddyRequest.updated,
        buddyRequest.status,
        buddyRequest.reason,
        coordsToLineString(buddyRequest.route),
        buddyRequest.meetingPointName,
        buddyRequest.divorcePointName,
        buddyRequest.length,
        buddyRequest.inexperiencedRouteName,
    ];
    return sqlTransaction(query, queryParams, providedClient).then(result => {
        return result.rows[0].id;
    });
}

/**
 * getSentBuddyRequests - Get the buddy requests the params.userId has sent
 *
 * @param  {object} params The query parameters, including the id of the buddy request to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of buddy requests
 */
export function getSentBuddyRequests(params: {userId: string, id?: number}, providedClient = null)
: Promise<(BuddyRequest & {otherUser?: User, myRoute?: [number, number][]})[]> {
    return getBuddyRequests(params, providedClient).then(buddyRequests => {
        let matchingBuddyRequests = buddyRequests.filter(buddyRequest => {
            return buddyRequest.owner === params.userId;
        });
        if (params.id !== undefined && params.id !== null && matchingBuddyRequests.length === 0) {
            throw new Error("404:BuddyRequest does not exist");
        }
        // Add the otherUser and myRoute
        return Promise.all(matchingBuddyRequests.map(buddyRequest => {
            const otherUserId = buddyRequest.experiencedUser;
            const thisUserId = buddyRequest.owner;
            const routeId = buddyRequest.inexperiencedRoute;
            let otherUser;
            return getUserById(otherUserId, providedClient).then(user => {
                otherUser = user.asUserProfile();
                return getInexperiencedRoutes({id: routeId, includedeleted: true, userId: thisUserId}, providedClient);
            }, err => {
                if (err.message.slice(0, 3) === "404") {
                    // User not found, so leave otherUser undefined
                    return getInexperiencedRoutes({
                        id: routeId,
                        includedeleted: true,
                        userId: thisUserId}, providedClient);
                } else {
                    throw err;
                }
            }).then(routes => {
                if (routes.length) {
                    return Object.assign(buddyRequest,
                        {otherUser, myRoute: [routes[0].startPoint, routes[0].endPoint]});
                } else  {
                    // Route not found, so leave myRoute undefined
                    return Object.assign(buddyRequest, {otherUser});
                }
            });
        }));
    }).then(buddyRequests => {
        return buddyRequests;
    });
}

/**
 * getReceivedBuddyRequests - Get the buddy requests the params.userId has received
 *
 * @param  {object} params The query parameters, including the id of the buddy request to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of buddy requests
 */
export function getReceivedBuddyRequests(params: {userId: string, id?: number}, providedClient = null)
: Promise<(BuddyRequest & {otherUser?: User, myRoute?: [number, number][]})[]> {
    return getBuddyRequests(params, providedClient).then(buddyRequests => {
        let matchingBuddyRequests = buddyRequests.filter(buddyRequest => {
            return buddyRequest.experiencedUser === params.userId;
        });
        if (params.id !== undefined && params.id !== null && matchingBuddyRequests.length === 0) {
            throw new Error("404:BuddyRequest does not exist");
        }
        // Add the otherUser and myRoute
        return Promise.all(matchingBuddyRequests.map(buddyRequest => {
            const otherUserId = buddyRequest.owner;
            const thisUserId = buddyRequest.experiencedUser;
            const routeId = buddyRequest.experiencedRoute;
            let otherUser;
            return getUserById(otherUserId, providedClient).then(user => {
                otherUser = user.asUserProfile();
                return getExperiencedRoutes({id: routeId, includedeleted: true, userId: thisUserId}, providedClient);
            }, err => {
                if (err.message.slice(0, 3) === "404") {
                    // User not found, so leave otherUser undefined
                    return getExperiencedRoutes({
                        id: routeId,
                        includedeleted: true,
                        userId: thisUserId}, providedClient);
                } else {
                    throw err;
                }
            }).then(routes => {
                if (routes.length) {
                    return Object.assign(buddyRequest, {otherUser, myRoute: routes[0].route});
                } else  {
                    // Route not found, so leave myRoute undefined
                    return Object.assign(buddyRequest, {otherUser});
                }
            });
        }));
    }).then(buddyRequests => {
        return buddyRequests;
    });
}

/**
 * getBuddyRequests - Get any buddy requests the params.userId has sent or received
 *
 * @param  {object} params The query parameters, including the id of the buddy request to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of buddy requests
 */
export function getBuddyRequests(params: {userId: string, id?: number}, providedClient = null)
: Promise<BuddyRequest[]> {
    let query = "SELECT id, experiencedRouteName, experiencedRoute, experiencedUser, owner, inexperiencedRoute, " +
    "meetingTime, divorceTime, ST_AsText(meetingPoint) as meetingPoint, ST_AsText(divorcePoint) AS divorcePoint, " +
    "averageSpeed, created, updated, reason, ST_AsText(route) as route, meetingPointName, divorcePointName, " +
    "length, status, review, inexperiencedroutename " +
    "FROM buddy_requests WHERE (owner=$1 OR experiencedUser=$1)";
    let queryParams = new Array<any>();
    queryParams.push(params.userId);
    if (params.id !== null && typeof params.id !== "undefined") {
        query +=  " AND id=$2";
        queryParams.push(params.id);
    }
    return sqlTransaction(query + ";", queryParams, providedClient).then(result => {
        return result.rows.map((buddyRequest) => {
            return BuddyRequest.fromSQLRow(buddyRequest);
        });
    });
}

/**
 * deleteBuddyRequest - description
 *
 * @param  {number} id The id of the BuddyRequest to delete
 * @param  {client} providedClient Database client to use for this interaction
 * @return {boolean} Whether the deletion succeeded
 */
export function deleteBuddyRequest(id: number, providedClient = null): Promise<Boolean> {
    const query = "DELETE FROM buddy_requests WHERE id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rowCount) {
            return true;
        } else {
            throw new Error("404:BuddyRequest doesn't exist");
        }
    });
}

/**
 * updateBuddyRequest - description
 *
 * @param  {BuddyRequest} existingRequest The old buddyRequest to be updated
 * @param  {object} updates An object of key:values to update the BuddyRequest with
 * @param  {client} providedClient Database client to use for this interaction
 * @return {boolean} Whether the update succeeded
 */
export function updateBuddyRequest(
    existingRequest: BuddyRequest, updates, providedClient = null): Promise<boolean> {
        // Move the updated properties into the existing model
        let newBuddyRequestObject = _.clone(updates);
        _.defaultsDeep(newBuddyRequestObject, existingRequest);

        // Special cases:
        // Make sure that the id doesn't change
        newBuddyRequestObject.id = existingRequest.id;
        // Update the updated property
        if (existingRequest !== newBuddyRequestObject) {
            newBuddyRequestObject.updated = new Date().toISOString();
        }

        // By instantating a new object, we run the tests in the constructor to make
        // sure that this is still a valid BuddyRequest
        const newBuddyRequest = new BuddyRequest(newBuddyRequestObject);

        const query = "UPDATE buddy_requests " +
        "SET divorcePoint=ST_GeogFromText($1), divorceTime=$2, meetingTime=$3, " +
        "meetingPoint=ST_GeogFromText($4), status=$5, reason=$6, updated=$7, meetingPointName=$8, " +
        "divorcePointName=$9, review=$10, length=$11 WHERE id = $12";
        const sqlParams = [
            coordsToPointString(newBuddyRequest.divorcePoint),
            newBuddyRequest.divorceTime,
            newBuddyRequest.meetingTime,
            coordsToPointString(newBuddyRequest.meetingPoint),
            newBuddyRequest.status,
            newBuddyRequest.reason,
            newBuddyRequest.updated,
            newBuddyRequest.meetingPointName,
            newBuddyRequest.divorcePointName,
            newBuddyRequest.review,
            newBuddyRequest.length,
            newBuddyRequest.id,
        ];

        return sqlTransaction(query, sqlParams, providedClient).then(result => {
            return true;
        });
}

/**
 * updateBuddyRequestReview - Sets or updates the review on a BuddyRequest
 *
 * @param  {BuddyRequest} existingRequest The old buddyRequest to be updated
 * @param  {object} updates An object of key:values to update the BuddyRequest with
 * @param  {client} providedClient Database client to use for this interaction
 * @return {boolean} Whether the update succeeded
 */
export function updateBuddyRequestReview(
    owner: string, buddyRequestId: number, score: number, providedClient = null): Promise<boolean> {
        if (score < 1 || score > 5) {
            throw new Error("400:BuddyRequest review must be between 1 and 5");
        }
        let buddyRequest;
        // First up, get the buddyRequest
        return getSentBuddyRequests({id: buddyRequestId, userId: owner}, providedClient).then(requests => {
            buddyRequest = requests[0];
            if (buddyRequest.status !== "accepted" && buddyRequest.status !== "completed") {
                throw new Error("400:Can't review a " + buddyRequest.status + " BuddyRequest");
            }
            // Update the inexperiencedUser
            if (buddyRequest.status !== "completed") {
                return getUserById(buddyRequest.owner, providedClient).then(user => {
                    let updates = {
                        profile_distance: user.distance + buddyRequest.length,
                        profile_helped_count: user.helpedCount + 1,
                    };
                    return updateUser(buddyRequest.owner, updates, providedClient);
                });
            } else {
                return true;
            }
        }).then(() => {
            // Update the experiencedUser
            return getUserById(buddyRequest.experiencedUser, providedClient).then(user => {
                let updates: any = {
                    // Subtract old review and add new one
                    profile_rating_sum: (user.rating * user.usersHelped) + score
                        - buddyRequest.review,
                };
                if (buddyRequest.status !== "completed") {
                    updates.profile_distance = user.distance + buddyRequest.length;
                    updates.profile_help_count = user.usersHelped + 1;
                }
                return updateUser(buddyRequest.experiencedUser, updates, providedClient);
            });
        }).then(() => {
            // Update the buddyRequest
            let updates = {
                review: score,
                status: "completed",
            };
            return updateBuddyRequest(buddyRequest, updates, providedClient);
        });
}
