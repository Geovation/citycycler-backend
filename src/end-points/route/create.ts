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

// end point definition
export const create = new MicroserviceEndpoint("create")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
