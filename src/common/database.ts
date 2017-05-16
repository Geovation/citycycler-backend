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

// export function runTransaction(method: Function, parameters: Object, isTest: Boolean) {
//     let client;
//     let result;
//     return pool.connect()
//         .then(newClient => {
//             client = newClient;
//             return client.query("BEGIN");
//         })
//         .then(() => {
//             return method(parameters, client);
//         })
//         .then(res => {
//             result = res;
//             if (isTest) {
//                 return { client, result };
//             } else {
//                 return client.query("COMMIT").then(() => client.release());
//             }
//         })
//         .catch(err => {
//             client.query("ROLLBACK");
//             throw new Error("transaction call has failed");
//         });
// }

export function createTransactionClient() {
    let client;
    return pool.connect().then(newClient => {
        client = newClient;
        return newClient.query("BEGIN");
    }).then(() => {
        return client;
    });
}

function checkClient(client) {
    if (client === null) {
        // console.log("recreating client");
        return pool.connect();
    } else {
        // console.log("using existing client");
        return new Promise((resolve, reject) => {
            resolve(client);
        });
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
    }).catch(e => {
        // console.log("error in sql transaction");
        // // console.log(e);
        return e;
    }).then(response => {
        if (providedClient === null) {
            // console.log("releasing new client");
            providedClient.release();
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
export function resetDatabase(): Promise<boolean> {
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
export function putRouteOld(routeData: RouteDataModel): Promise<number> {

    const wkt = coordsToLineString(routeData.route);

    return new Promise((resolve, reject) => {
        // to run a query we can acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                console.error("error fetching client from pool", err);
                reject(err);
                return;
            }
            const query = "INSERT INTO routes (route, departureTime, arrivalTime, days, owner) " +
                "VALUES (ST_GeogFromText($1),$2,$3,$4::integer::bit(7),$5) " +
                "RETURNING id";
            const sqlParams = [wkt, routeData.departureTime, routeData.arrivalTime,
                routeData.getDaysBitmask(), routeData.owner];
            client.query(query, sqlParams, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                // return the id of the new route
                resolve(result.rows[0].id);
            });
        });
    });
}

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

export function getRouteById(id: number): Promise<RouteDataModel> {
    return new Promise((resolve, reject) => {
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject(err);
                return console.error("error fetching client from pool", err);
            }
            const query = "SELECT id, owner, departuretime, arrivalTime, days::integer, ST_AsText(route) AS route " +
                "FROM routes where id=$1";
            client.query(query, [id], (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                if (result.rows[0]) {
                    // return the route
                    resolve(RouteDataModel.fromSQLRow(result.rows[0]));
                } else {
                    reject("404:Route doesn't exist");
                }
            });
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

export function getRoutesNearby(radius: number, lat: number, lon: number): Promise<RouteDataModel[]> {
    return new Promise((resolve, reject) => {
        if (radius > 2000 || radius < 1) {
            reject("400:Radius out of bounds");
            return;
        }
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject(err);
                return console.error("error fetching client from pool", err);
            }
            const query = "select id, owner, departuretime, arrivalTime, ST_AsText(route) AS route from routes " +
                "where ST_DISTANCE(route, ST_GeogFromText($2) ) < $1";
            const geoJson = "POINT(" + lat + " " + lon + ")";
            client.query(query, [radius, geoJson], (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                resolve(result.rows.map(RouteDataModel.fromSQLRow));
            });
        });

    });
}

/**
 * The function this service is built around - route matching!
 * @param matchParams - The parameters that we use for matching - see the type definiton here or in the swagger docs
 *
 * @returns routes - A list of RouteDataModels
 */
export function matchRoutes(matchParams: RouteQuery): Promise<{
    id: number,
    meetingTime: number,
    days: string[],
    owner: number,
    meetingPoint: number[],
    divorcePoint: number[]
}[]> {
    return new Promise((resolve, reject) => {
        if (matchParams.radius > 2000 || matchParams.radius < 1) {
            reject("400:Radius out of bounds. Must be between 1m and 2km");
            return;
        }
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject(err);
                return console.error("error fetching client from pool", err);
            }
            let query = "" +
                "SELECT id, " +
                "       departureTime + distFromStart*(arrivalTime - departureTime) AS meetingTime, " +
                "       (days & $4::integer::bit(7))::integer AS days, " +
                "       ST_AsText(ST_LineInterpolatePoint(route::geometry, distFromStart)) AS meetingPoint, " +
                "       ST_AsText(ST_LineInterpolatePoint(route::geometry, distFromEnd)) AS divorcePoint, " +
                "       owner " +
                "FROM ( " +
                "   SELECT  id, " +
                "           (ST_LineLocatePoint(route::geometry, ST_GeogFromText($1)::geometry)) " +
                "               AS distFromStart, " +
                "           (ST_LineLocatePoint(route::geometry, ST_GeogFromText($2)::geometry)) " +
                "               AS distFromEnd, " +
                "           arrivalTime, " +
                "           departureTime, " +
                "           days, " +
                "           owner, " +
                "           route " +
                "   FROM routes WHERE " +
                "       ST_DWithin(ST_GeogFromText($1), route, $3) " +
                "   AND" +
                "       ST_DWithin(ST_GeogFromText($2), route, $3) " +
                ") AS matchingRoutes " +
                "WHERE " +
                "   distFromStart < distFromEnd ";
            const startPoint = "POINT(" + matchParams.startPoint[0] + " " + matchParams.startPoint[1] + ")";
            const endPoint = "POINT(" + matchParams.endPoint[0] + " " + matchParams.endPoint[1] + ")";
            let queryParams = [startPoint, endPoint, matchParams.radius];

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
                query += "AND (days & $4::integer::bit(7) != b'0000000') ";
                queryParams.push(daysBitmask);
            } else {
                queryParams.push(127);  // 127 = 1111111
            }
            // Add sorting by time
            if (matchParams.arrivalTime !== undefined) {
                query += "ORDER BY ABS(" +
                    "departureTime + distFromStart*(departureTime - arrivalTime) - $5)";
                queryParams.push(matchParams.arrivalTime);
            } else {
                query += "ORDER BY meetingTime";
            }
            client.query(query + ";", queryParams, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                resolve(result.rows.map((row) => {
                    const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                    /* tslint:disable no-bitwise */
                    const days = daysOfWeek.filter((day, i) => {
                        return row.days & 1 << i;
                    });
                    /* tslint:enable no-bitwise */
                    return {
                        days,
                        divorcePoint: pointStringToCoords(row.divorcepoint),
                        id: row.id,
                        meetingPoint: pointStringToCoords(row.meetingpoint),
                        meetingTime: row.meetingtime,
                        owner: row.owner,
                    };
                }));
            });
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
    }): Promise<boolean> {
    return new Promise((resolve, reject) => {
        // Move the updated properties into the existing model, and validate the new route
        existingRoute.arrivalTime = updates.arrivalTime !== undefined ?
            updates.arrivalTime : existingRoute.arrivalTime;
        existingRoute.departureTime = updates.departureTime !== undefined ?
            updates.departureTime : existingRoute.departureTime;
        existingRoute.days = updates.days !== undefined ? updates.days : existingRoute.days;
        existingRoute.route = updates.route !== undefined ? updates.route : existingRoute.route;

        if (existingRoute.arrivalTime < existingRoute.departureTime) {
            reject("400:Arrival time is before Departure time");
            return;
        } else if (existingRoute.route.length < 2) {
            reject("400:Route requires at least 2 points");
            return;
        } else if (Math.max(...existingRoute.route.map(pair => { return pair.length; })) > 2) {
            reject("400:Coordinates in a Route should only have 2 items in them, [latitude, longitude]");
            return;
        } else if (Math.min(...existingRoute.route.map(pair => { return pair.length; })) < 2) {
            reject("400:Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]");
            return;
        }

        // to run a query we can acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                console.error("error fetching client from pool", err);
                reject(err);
                return;
            }
            const query = "UPDATE routes " +
                "SET route = $1, arrivalTime = $2, departureTime = $3, days = $4::integer::bit(7) " +
                "WHERE id = $5";
            const sqlParams = [coordsToLineString(existingRoute.route),
            existingRoute.arrivalTime, existingRoute.departureTime,
            existingRoute.getDaysBitmask(), existingRoute.id];
            client.query(query, sqlParams, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                // return true
                resolve(true);
            });
        });
    });
}

export function deleteRoute(id: number): Promise<Boolean> {
    return new Promise((resolve, reject) => {
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject(err);
                return console.error("error fetching client from pool", err);
            }
            const query = "DELETE FROM routes WHERE id=$1";
            client.query(query, [id], (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    // logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                if (result.rowCount) {
                    resolve(true);
                } else {
                    reject("404:Route doesn't exist");
                    return;
                }
            });
        });
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
            return User.fromSQLRow(result.rows[0]);
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
