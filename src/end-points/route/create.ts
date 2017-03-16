import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        description: "Create a new route",
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/RouteData",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "New route was created",
                type: "number",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "routecreation",
        ],
    },
};

// DEFINITIONS

const definitions = {
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "number",
        },
        required: true,
        type: "array",
    },
    Route: {
        description: "A list of [lat,long] coordinates that make up the route.",
        items: {
            minItems: 2,
            schema: {
                $ref: "#/definitions/Coordinate",
            },
        },
        required: true,
        type: "array",
    },
    RouteData: {
        properties: {
            averageSpeed: {
                description: "The average speed of the owner, in km/h.",
                required: true,
                type: "number",
            },
            departureTime: {
                description: "The time in seconds past midnight that the owner will start their route.",
                required: true,
                type: "number",
            },
            owner: {
                description: "The userId of the user who owns this route.",
                required: true,
                type: "number",
            },
            route: {
                required: true,
                schema: {
                    $ref: "#/definitions/Route",
                },
            },

        },
        required: true,
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;

    logger.debug("Processing new route for user " + payload.user);

    if (typeof payload.route !== "undefined") {
        logger.debug("Route transmitted: \n" + JSON.stringify(payload.route));
    }

    return Database.putRoute(payload);

};

const storeRoute = (route: string) => {
    // create a config to configure both pooling behavior
    // and client options
    // note: all config is optional and the environment variables
    // will be read if the config is not present
    const config = {
        database: "matchMyRoute", // env var: PGDATABASE
        host: "localhost", // Server hosting the postgres database
        idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
        max: 10, // max number of clients in the pool
        password: "8Bvbcp1x!%xE", // env var: PGPASSWORD
        port: 5432, // env var: PGPORT
        user: "postgres", // env var: PGUSER
    };

    // this initializes a connection pool
    // it will keep idle connections open for a 30 seconds
    // and set a limit of maximum 10 idle clients
    const pool = new pg.Pool(config);

    // to run a query we can acquire a client from the pool,
    // run a query on the client, and then return the client to the pool
    pool.connect((err, client, done) => {
        if (err) {
            return console.error("error fetching client from pool", err);
        }
        const query = "INSERT INTO routes (geom) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 27700))";
        const query2 = "SELECT * FROM routes";

        client.query(query, [route], (error, result) => {
            // call `done(err)` to release the client back to the pool (or destroy it if there is an error)
            done(error);

            if (error) {
                return console.error("error running query", error);
            }
            console.log("Received the following number of rows: " + result.rows.length);
            result.rows.forEach(row => {
                logger.debug("routeid received" + row.routeid);
            });

            // output: 1
        });
    });

    pool.on("error", (err, client) => {
        // if an error is encountered by a client while it sits idle in the pool
        // the pool itself will emit an error event with both the error and
        // the client which emitted the original error
        // this is a rare occurrence but can happen if there is a network partition
        // between your application and the database, the database restarts, etc.
        // and so you might want to handle it and at least log it out
        console.error("idle client error", err.message, err.stack);
    });
}

// end point definition
export const create = new MicroserviceEndpoint("create")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
