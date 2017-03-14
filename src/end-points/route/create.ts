import * as Datastore from "../../common/datastore";
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
        items: {
            minItems: 2,
            schema: {
                $ref: "#/definitions/Coordinate",
            },
        },
        type: "array",
    },
    RouteData: {
        properties: {
            cyclingSpeed: {
                type: "number",
            },
            departureTime: {
                type: "number",
            },
            route: {
                schema: {
                    $ref: "#/definitions/Route",
                },
            },
            user: {
                type: "number",
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

    return Datastore.putRoute(payload);

};

// end point definition
export const create = new MicroserviceEndpoint("create")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
