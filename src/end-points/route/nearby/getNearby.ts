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
        description: "Find routes near a given point",
        parameters: [
            {
                description: "The radius in which to search for routes, in meters.",
                in: "query",
                name: "radius",
                required: true,
                type: "number",
            },
            {
                description: "The lattitude of the center of the circle in which to search for routes.",
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
                type: "string",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "routeretreival",
        ],
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
    .addService(service);
