// import * as _ from "lodash";
import { RouteDataModel } from "./RouteDataModel";
import * as pg from "pg";
import * as logger from "winston";

// Datastore
// type DatastoreKind = "Image" | "User";
// const datastore = Datastore();
// const queryImages = (query, queryName): Promise<ImageResultModel[]> => {
//
//     return datastore.runQuery(query)
//         .then( result => {
//             const images = result[0];
//             const info = result[1];
//             logger.debug("entities", JSON.stringify(images));
//             logger.debug("info", JSON.stringify(info));
//
//             return images.map( (entity: ImageMetadataModel) => {
//                 entity.id = entity[datastore.KEY].id;
//                 return ImageResultModel.makeFromImageMetadata(entity);
//             });
//         });
// };

// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
const config = {
    database: "matchMyRoute", // env var: PGDATABASE
    host: "35.190.143.196", // Server hosting the postgres database
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
    max: 10, // max number of clients in the pool
    password: "aUZw[:Gw38H&>Jf2hUwd", // env var: PGPASSWORD
    port: 5432, // env var: PGPORT
    user: "postgres", // env var: PGUSER
};
// this initializes a connection pool
// it will keep idle connections open for a 30 seconds
// and set a limit of maximum 10 idle clients
const pool = new pg.Pool(config);
// if an error is encountered by a client while it sits idle in the pool
// the pool itself will emit an error event with both the error and
// the client which emitted the original error
// this is a rare occurrence but can happen if there is a network partition
// between your application and the database, the database restarts, etc.
// and so you might want to handle it and at least log it out
pool.on("error", (err, client) => {
    console.error("idle client error", err.message, err.stack);
});

////////////////////////
// Exported Functions

// Put a route in the database, returning the new database ID for the route
export function putRoute(routeData: RouteDataModel): Promise<number> {

    const wkt = coordsToLineString(routeData.route);

    return new Promise((resolve, reject) => {
        // to run a query we can acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                return console.error("error fetching client from pool", err);
            }
            const query = "INSERT INTO routes (route,departureTime,averageSpeed,owner) " +
                "VALUES (ST_SetSRID(ST_GeomFromText($1), 27700),$2,$3,$4) " +
                "RETURNING id";
            const sqlParams = [wkt, routeData.departureTime, routeData.averageSpeed, routeData.owner];
            client.query(query, sqlParams, (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                // return the id of the new route
                resolve(result.rows[0].id);
            });
        });
    });
}

export function getRouteById(id: number): Promise<RouteDataModel> {
    return new Promise((resolve, reject) => {
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                reject("error fetching client from pool" + err);
                return console.error("error fetching client from pool", err);
            }
            const query = "SELECT id, owner, departuretime, averagespeed, ST_AsText(route) AS route " +
                "FROM routes where id=$1";
            client.query(query, [id], (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    logger.error("error running query", error);
                    reject("error running query: " + error);
                    return;
                }

                if (result.rows[0]) {
                    // return the route
                    resolve({
                        averageSpeed: result.rows[0].averagespeed,
                        departureTime: result.rows[0].departuretime,
                        id: result.rows[0].id,
                        owner: result.rows[0].owner,
                        route: lineStringToCoords(result.rows[0].route),
                    });
                } else {
                    reject("No route found.");
                }
            });
        });
    });
}

function lineStringToCoords(lineStr: string): number[][] {
    if (lineStr.slice(0, 11) !== "LINESTRING(") {
        throw "Input is not a Linestring.";
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

function coordsToLineString(coords: number[][]): string {
    return "LINESTRING(" + coords.map((pair) => {
        return pair.join(" ");
    }).join(",") + ")";
}

export function getRoutesNearby(radius: number, lat: number, lon: number): Promise<RouteDataModel[]> {
    return new Promise((resolve, reject) => {
        if (radius > 1000 || radius < 1) {
            reject("Radius out of bounds");
        }
        // Acquire a client from the pool,
        // run a query on the client, and then return the client to the pool
        pool.connect((err, client, done) => {
            if (err) {
                return console.error("error fetching client from pool", err);
            }
            const query = "select id, owner, departuretime, averagespeed, ST_AsText(route) AS route from routes " +
                "where ST_DISTANCE(route, ST_GeomFromText($2, 27700) ) < $1";
            const geoJson = "POINT(" + lat + " " + lon + ")";
            client.query(query, [radius, geoJson], (error, result) => {
                // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
                done(error);

                if (error) {
                    logger.error("error running query", error);
                    reject("error running query: " + error);
                }

                resolve(result.rows.map((row) => {
                    return {
                        averageSpeed: row.averagespeed,
                        departureTime: row.departuretime,
                        id: row.id,
                        owner: row.owner,
                        route: lineStringToCoords(row.route),
                    };
                }));
            });
        });

    });
}

// export function saveImageMetadata(ownerId: string, imageMetadata: ImageMetadataModel): Promise<ImageResultModel> {
//     const kindImage: DatastoreKind = "Image";
//
//     // As we are changing the DB, there is not point to fix this.
//     // const kindUser: DatastoreKind = "User";
//
//     // const imageDSEntity = {
//     //     data: imageMetadata,
//     //     key: datastore.key(kindUser, ownerId, kindImage),
//     // };
//
//     const imageDSEntity = {
//         data: imageMetadata,
//         key: datastore.key(kindImage),
//     };
//
//     return datastore.save(imageDSEntity)
//         .then( data => {
//             const id = data[0].mutationResults[0].key.path[0].id;
//             imageMetadata.id = id;
//
//             return ImageResultModel.makeFromImageMetadata(imageMetadata);
//         });
// }
//
// export function getUserById(id) {
//     const kind: DatastoreKind = "User";
//     const query = datastore.createQuery(kind)
//         .filter("__key__", "=", datastore.key([kind, id]));
//
//     return datastore.runQuery(query)
//         .then(result => {
//             const users = result[0];
//             const info = result[1];
//             logger.debug("entities", JSON.stringify(users));
//             logger.debug("info", JSON.stringify(info));
//             return(_.extend({id}, users[0]));
//         });
// }
//
// export function getImages() {
//     const kind: DatastoreKind = "Image";
//     const query = datastore.createQuery(kind);
//     return queryImages(query, "getImage");
// }
//
// export function getImageById(id): Promise<any> {
//     const kind: DatastoreKind = "Image";
//     const query = datastore.createQuery(kind)
//         .filter("__key__", "=", datastore.key([kind, id]));
//     return queryImages(query, "getImageById")
//         .then(images => images[0]);
// }
//
// export function deleteImageMetadata(id) {
//     const kind: DatastoreKind = "Image";
//     const key = datastore.key([kind, id]);
//     return datastore.delete(key);
// }
