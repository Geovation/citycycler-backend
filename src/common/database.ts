// import * as _ from "lodash";
import { RouteDataModel } from "./RouteDataModel";
import RouteQuery from "./RouteQueryDataModel";
import User from "./UserDataModels";
import * as fs from "fs";
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
    max: 10, // max number of clients in the pool
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
        return client.release();
    });
}

// Execute an arbritary SQL command.
export function sql(query: string, params: Array<string> = []): Promise<any> {
    return new Promise((resolve, reject) => {
        // to run a query we can acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                console.error("error fetching client from pool", err);
                reject(err);
                return;
            }
            client.query(query, params, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }
                resolve(result);
            });
        });
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
            // console.log("releasing new client");
            // TODO: This should not automatically COMMIT, but instead the endpoint
            // should decide what to do and in case of failure roll back the transaction
            client.query("COMMIT").then(e => {
              client.release();
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
    return sql("DROP SCHEMA IF EXISTS public CASCADE;", [])
        .then(result => {
            return sql("CREATE SCHEMA public AUTHORIZATION " + process.env.PGUSER + ";", []);
        })
        .then(result => {
            return new Promise((resolve, reject) => {
                fs.readFile("postgres_schema.sql", "utf8", (err, data) => {
                    if (err) {
                        reject(new Error("Could not read schema file"));
                    }
                    const schemaRecreateCommands = data;
                    resolve(sql(schemaRecreateCommands));
                });
            });
        })
        .then(result => {
            console.info("Database recreated successfully");
        });
}

// Put a route in the database, returning the new database ID for the route
export function putRoute(routeData: RouteDataModel, providedClient = null) {
    const wkt = coordsToLineString(routeData.route);
    const query = "INSERT INTO routes (route, departureTime, arrivalTime, days, owner) " +
        "VALUES (ST_GeogFromText($1),$2,$3,$4::integer::bit(7),$5) " +
        "RETURNING id";
    const sqlParams = [wkt, routeData.departureTime, routeData.arrivalTime,
        routeData.getDaysBitmask(), routeData.owner];
    return sqlTransaction(query, sqlParams, providedClient).then(result => {
        if (result.rowCount > 0) {
            return result.rows[0].id;
        } else {
            throw new Error("500:Route could not be created");
        }
    });
}

export function getRouteById(id: number, providedClient = null) {
    const query = "SELECT id, owner, departuretime, arrivalTime, days::integer, ST_AsText(route) AS route " +
        "FROM routes where id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rows[0]) {
            return RouteDataModel.fromSQLRow(result.rows[0]);
        } else {
            throw new Error("404:Route doesn't exist");
        }
    });
}

/**
 * getRoutes - description
 *
 * @param  {object} params The query parameters, including the id of the route to query and the user id
 * @param  {client} providedClient Database client to use for this interaction
 * @return {Object[]} Array of routes
 */
export function getRoutes(params: {userId: number, id?: number}, providedClient = null) {
    let query = "SELECT id, owner, departuretime, arrivalTime, days::integer, ST_AsText(route) AS route " +
    "FROM routes where owner=$1";
    let queryParams = [params.userId];
    if (params.id !== null && typeof params.id !== "undefined") {
        query +=  " AND id=$2";
        queryParams.push(params.id);
    }
    return sqlTransaction(query, queryParams, providedClient).then(result => {
        if (result.rowCount > 0) {
            return result.rows.map((route) => {
                return RouteDataModel.fromSQLRow(route);
            });
        } else {
            throw new Error("404:Route doesn't exist");
        }
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
            parseInt(strPair.split(" ")[0], 10),
            parseInt(strPair.split(" ")[1], 10),
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

export function getRoutesNearby(radius: number, lat: number, lon: number, providedClient = null): Promise<any> {
    if (radius > 2000 || radius < 1) {
        return new Promise((resolve, reject) => {
            reject("400:Radius out of bounds");
        });
    }
    const query = "select id, owner, departuretime, arrivalTime, ST_AsText(route) AS route from routes " +
        "where ST_DISTANCE(route, ST_GeogFromText($2) ) < $1";
    const geoJson = "POINT(" + lat + " " + lon + ")";
    return sqlTransaction(query, [radius, geoJson], providedClient).then(result => {
        return result.rows.map(RouteDataModel.fromSQLRow);
    });
}

/**
 * The function this service is built around - route matching!
 * @param matchParams - The parameters that we use for matching - see the type definiton here or in the swagger docs
 *
 * @returns routes - A list of RouteDataModels
 */
export function matchRoutes(
    matchParams: {
        start: {
            latitude: number,
            longitude: number,
            radius: number,
        },
        end: {
            latitude: number,
            longitude: number,
            radius: number,
        },
        days?: string[],
        time?: number,
    },
    providedClient = null
): Promise<{
    id: number,
    meetingTime: number,
    divorceTime: number,
    days: string[],
    owner: number,
    meetingPoint: [number, number],
    divorcePoint: [number, number],
    timeToMeetingPoint: number,
    timeFromDivorcePoint: number,
    distanceToMeetingPoint: number,
    distanceFromDivorcePoint: number
}[]> {
    if (matchParams.start.radius > 2000 || matchParams.start.radius < 1) {
        return Promise.reject("400:Radius out of bounds. Must be between 1m and 2km");
    } else if (matchParams.end.radius > 2000 || matchParams.end.radius < 1) {
        return Promise.reject("400:End radius out of bounds. Must be between 1m and 2km");
    }
    let query = "" +
    "SELECT id,  " +
    "    match1.days, " +
    "    match2.meetingTime, " +
    "    match2.divorceTime, " +
    "    ST_AsText(match2.meetingPoint) AS meetingPoint, " +
    "    ST_AsText(match2.divorcePoint) AS divorcePoint, " +
    "    match3.*, " +
    "    match4.*, " +
    "    owner  " +
    "FROM routes,  " +
    "    LATERAL (  " +
    "        SELECT   " +
    "            (ST_LineLocatePoint(route::geometry, ST_GeogFromText($1)::geometry))  " +
    "                AS distFromStart,  " +
    "            (ST_LineLocatePoint(route::geometry, ST_GeogFromText($2)::geometry))  " +
    "                AS distFromEnd,  " +
    "            (days & $5::integer::bit(7))::integer AS days, " +
    "	    ST_Length(route) / (arrivalTime - departureTime) AS averageSpeed " +
    "    ) AS match1, " +
    "    LATERAL ( " +
    "        SELECT " +
    "            departureTime + distFromStart*(arrivalTime - departureTime) AS meetingTime,  " +
    "            departureTime + distFromEnd*(arrivalTime - departureTime) AS divorceTime, " +
    "            ST_LineInterpolatePoint(route::geometry, distFromStart) AS meetingPoint,  " +
    "            ST_LineInterpolatePoint(route::geometry, distFromEnd) AS divorcePoint " +
    "    ) AS match2,  " +
    "    LATERAL ( " +
    "	SELECT " +
    "	    ST_Distance(ST_GeogFromText($1), meetingPoint) AS distanceToMeetingPoint, " +
    "	    ST_Distance(ST_GeogFromText($2), divorcePoint) AS distanceToDivorcePoint " +
    "    ) AS match3,  " +
    "    LATERAL ( " +
    "	SELECT " +
    "	    distanceToMeetingPoint / averageSpeed AS timeToMeetingPoint, " +
    "	    distanceToDivorcePoint / averageSpeed AS timeFromDivorcePoint " +
    "    ) AS match4 " +
    "WHERE  " +
    "    distFromStart <  distFromEnd  " +
    "AND " +
    "    ST_DWithin(ST_GeogFromText($1), route, $3)  " +
    "AND " +
    "    ST_DWithin(ST_GeogFromText($2), route, $4) " +
    "AND " +
    "    match1.days > 0 ";
    const startPoint = "POINT(" + matchParams.start.latitude + " " + matchParams.start.longitude + ")";
    const endPoint = "POINT(" + matchParams.end.latitude + " " + matchParams.end.longitude + ")";
    let queryParams = [startPoint, endPoint, matchParams.start.radius, matchParams.end.radius];

    // Add a filter for days of the week
    if (matchParams.days !== undefined) {
        /* tslint:disable no-bitwise */
        const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const daysBitmask = matchParams.days.map((day) => {
            return 1 << daysOfWeek.indexOf(day);
        }).reduce((days, day) => {
            return days | day;
        }, 0);
        /* tslint:enable no-bitwise */
        queryParams.push(daysBitmask);
    } else {
        queryParams.push(127);  // 127 = 1111111
    }
    // Add sorting by time
    if (matchParams.time !== undefined) {
        query += "ORDER BY ABS(" +
            "divorceTime + timeFromDivorcePoint - $6)";
        queryParams.push(matchParams.time);
    } else {
        query += "ORDER BY divorceTime + timeFromDivorcePoint";
    }
    return sqlTransaction(query + ";", queryParams, providedClient).then(result => {
        return result.rows.map((row) => {
            const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
            /* tslint:disable no-bitwise */
            const days = daysOfWeek.filter((day, i) => {
                return row.days & 1 << i;
            });
            /* tslint:enable no-bitwise */
            return {
                days,
                distanceFromDivorcePoint: row.distanceFromDivorcePoint,
                distanceToMeetingPoint: row.distanceToMeetingPoint,
                divorcePoint: pointStringToCoords(row.divorcepoint),
                divorceTime: row.divorcetime,
                id: row.id,
                meetingPoint: pointStringToCoords(row.meetingpoint),
                meetingTime: row.meetingtime,
                owner: row.owner,
                timeFromDivorcePoint: row.timeFromdivorcePoint,
                timeToMeetingPoint: row.timeToMeetingPoint,
            };
        });
    });

}

// Updates a route from the given update object
export function updateRoute(
    existingRoute: RouteDataModel,
    updates: {
        arrivalTime?: number,
        departureTime?: number,
        days?: string[],
        route?: number[][],
    },
    providedClient = null): Promise<boolean> {

        // Move the updated properties into the existing model, and validate the new route
        existingRoute.arrivalTime = updates.arrivalTime !== undefined ?
            updates.arrivalTime : existingRoute.arrivalTime;
        existingRoute.departureTime = updates.departureTime !== undefined ?
            updates.departureTime : existingRoute.departureTime;
        existingRoute.days = updates.days !== undefined ? updates.days : existingRoute.days;
        existingRoute.route = updates.route !== undefined ? updates.route : existingRoute.route;

        let error;
        if (existingRoute.arrivalTime < existingRoute.departureTime) {
            error = "400:Arrival time is before Departure time";
        } else if (existingRoute.route.length < 2) {
            error = "400:Route requires at least 2 points";
        } else if (Math.max(...existingRoute.route.map(pair => { return pair.length; })) > 2) {
            error = "400:Coordinates in a Route should only have 2 items in them, [latitude, longitude]";
        } else if (Math.min(...existingRoute.route.map(pair => { return pair.length; })) < 2) {
            error = "400:Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]";
        }
        if (typeof error !== "undefined") {
            return new Promise((resolve, reject) => { reject(error); } );
        }

        const query = "UPDATE routes " +
        "SET route = $1, arrivalTime = $2, departureTime = $3, days = $4::integer::bit(7) " +
        "WHERE id = $5";
        const sqlParams = [coordsToLineString(existingRoute.route),
            existingRoute.arrivalTime, existingRoute.departureTime,
            existingRoute.getDaysBitmask(), existingRoute.id];

        return sqlTransaction(query, sqlParams, providedClient).then(result => {
            return true;
        });
}

export function deleteRoute(id: number, providedClient = null): Promise<Boolean> {
    const query = "DELETE FROM routes WHERE id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rowCount) {
            return true;
        } else {
            throw new Error("404:Route doesn't exist");
        }
    });
}

export function createRouteQuery(owner: number, routeQ: RouteQuery): Promise<Boolean> {
    routeQ = new RouteQuery(routeQ);
    return new Promise((resolve, reject) => {
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject(err);
                return console.error("error fetching client from pool", err);
            }
            const query = "INSERT INTO route_queries (startPoint, endPoint, radius, days, arrivalTime, owner)" +
                "VALUES (ST_GeogFromText($1), ST_GeogFromText($2), $3, $4::integer::bit(7), $5, $6)" +
                "RETURNING id";
            const queryParams = [
                coordsToPointString(routeQ.startPoint),
                coordsToPointString(routeQ.endPoint),
                routeQ.radius,
                routeQ.getDaysBitmask(),
                routeQ.arrivalTime,
                owner,
            ];
            client.query(query, queryParams, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                } else {
                    resolve(result.rows[0].id);
                }
            });
        });
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
    const query = "INSERT INTO users (name, email, pwh, salt, rounds, jwt_secret) " +
        "VALUES ($1,$2,$3,$4,$5,$6) RETURNING *";
    const sqlParams = [
        params.name,
        params.email,
        params.pwh,
        params.salt,
        params.rounds,
        params.jwtSecret,
    ];
    return sqlTransaction(query, sqlParams, providedClient)
        .then((result) => {
            if (result.rowCount > 0) {
                return User.fromSQLRow(result.rows[0]);
            } else {
                throw new Error("409:Could not create user (duplicate?)");
            }
        })
        .catch((error) => {
            if (error.message === "duplicate key value violates unique constraint \"users_email_key\"") {
                throw new Error("409:An account already exists using this email");
            } else {
                throw new Error("409:An account already exists using this email");
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
        queryParts.push(key + " = $" + (i + 2) + " ");
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
export function getUserById(id: number, providedClient = null): Promise<User> {
    const query = "SELECT * FROM users WHERE id=$1";
    return sqlTransaction(query, [id], providedClient).then(result => {
        if (result.rowCount > 0) {
            return User.fromSQLRow(result.rows[0]);
        } else {
            throw new Error("404:User doesn't exist");
        }
    });
}

export function deleteUser(id: number, providedClient = null): Promise<Boolean> {
    const query = "DELETE FROM users WHERE id=$1";
    return sqlTransaction(query, [id], providedClient)
        .then((result) => {
            if (result.rowCount) {
                return true;
            } else {
                throw new Error("404:User doesn't exist");
            }
        });
}
