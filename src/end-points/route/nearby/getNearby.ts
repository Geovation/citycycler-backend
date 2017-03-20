import * as Database from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";
import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    get: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The radius in which to search for routes, in meters.",
                format: "int32",
                in: "query",
                maximum: 1000,
                minimum: 1,
                name: "radius",
                required: true,
                type: "integer",
            },
            {
                description: "The latitude of the center of the circle in which to search for routes.",
                in: "query",
                name: "lat",
                required: true,
                type: "number",
            },
            {
                description: "The longitude of the center of the circle in which to search for routes.",
                in: "query",
                name: "lon",
                required: true,
                type: "number",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Search was successful",
                schema: {
                    $ref: "#/definitions/GetNearbyResponse",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Find routes near a given point",
        tags: [
            "Route Retrieval",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CoordList: {
        description: "A list of [lat,long] coordinates that make up the route.",
        example: [[0, 0], [1, 1]],
        items: {
            minItems: 2,
            schema: {
                $ref: "#/definitions/Coordinate",
            },
        },
        type: "array",
    },
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "number",
        },
        type: "array",
    },
    GetNearbyResponse: {
        properties: {
            result: {
                required: true,
                schema: {
                    $ref: "#/definitions/RoutesResult",
                },
                type: "object",
            },
        },
    },
    RouteData: {
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the owner will arrive at their destination.",
                type: "number",
            },
            departureTime: {
                description: "The time in seconds past midnight that the owner will start their route.",
                type: "integer",
            },
            owner: {
                description: "The userId of the user who owns this route.",
                type: "integer",
            },
            route: {
                schema: {
                    $ref: "#/definitions/CoordList",
                },
            },
        },
    },
    RoutesResult: {
        description: "A list of Routes that were found near the given point",
        items: {
            schema: {
                $ref: "#/definitions/RouteData",
            },
        },
        type: "array",
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const { radius, lat, lon } = params;

    logger.debug("Searching for routes within " + radius + "m of (" + lat + "," + lon + ")");

    return Database.getRoutesNearby(parseInt(radius, 10), parseInt(lat, 10), parseInt(lon, 10));
};

// end point definition
export const getNearbyRoute = new MicroserviceEndpoint("getNearby")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
