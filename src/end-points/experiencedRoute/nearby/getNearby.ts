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
                description: "The radius in which to search for routes, in meters",
                format: "int32",
                in: "query",
                maximum: 1000,
                minimum: 1,
                name: "radius",
                required: true,
                type: "integer",
            },
            {
                description: "The latitude of the center of the circle in which to search for routes",
                in: "query",
                name: "lat",
                required: true,
                type: "number",
            },
            {
                description: "The longitude of the center of the circle in which to search for routes",
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
            400: {
                description: "Invalid parameters. See error message.",
                schema: {
                    $ref: "#/definitions/Error",
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
            "ExperiencedRoutes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    GetNearbyResponse: {
        properties: {
            result: {
                $ref: "#/definitions/RoutesResult",
            },
        },
        required: ["result"],
    },
    RoutesResult: {
        description: "A list of Routes that were found near the given point",
        items: {
            $ref: "#/definitions/RouteData",
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

    return Database.getExperiencedRoutesNearby(parseInt(radius, 10), parseInt(lat, 10), parseInt(lon, 10));
};

// end point definition
export const getNearbyRoute = new MicroserviceEndpoint("getNearby")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
