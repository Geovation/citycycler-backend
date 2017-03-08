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
        description: "creates a new route",
        produces: ["application/json; charset=utf-8"],
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/RouteData",
                }
            }
        ],
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
        type: "array",
        required: true,
        items: {
            type: "number",
            minLength: 2,
            maxLength: 2
        }
    },
    Route: {
        properties: {
            type: {
                type: "string",
                pattern: "LineString"
            },
            coordinates: {
                type: "array",
                items: {
                    minItems: 2,
                    schema: {
                        $ref: "#/definitions/Coordinate"
                    }
                }
            }
        }
    },
    RouteData: {
        required: true,
        properties: {
            route: {
                schema: {
                    $ref: "#/definitions/Route"
                }
            },
            departureTime: {
                type: "string",
            },
            arrivalTime: {
                type: "string",
            },
            user: {
                type: "number",
            }
        }
    }
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;

    logger.debug("Processing new route for user " + payload.user);

    if(typeof payload.route != "undefined"){
        logger.debug("Route transmitted: \n" + payload.route);
    }

    // TODO: cache it
    return new Promise((resolve, reject) => {
      setTimeout(
          () => {resolve("blabla");
      }, 1000);
    });
};

// end point definition
export const create = new MicroserviceEndpoint("create")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
