import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/RouteChanges",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Route was updated",
                schema: {
                    $ref: "#/definitions/UpdateRouteResponse",
                },
            },
            400: {
                description: "Invalid update parameters, see error message",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            403: {
                description: "An invalid authorization token was supplied",
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
        security: [
            {
                userAuth: [],
            },
        ],
        summary: "Update an existing route",
        tags: [
            "ExperiencedRoutes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    RouteChanges: {
        properties: {
            arrivalTime: {
                description: "The time in ISO 8601 extended format that the owner arrives at their destination",
                example: "12:22:00Z",
                type: "string",
            },
            days: {
                description: "Which days of the week the owner cycles this route",
                example: ["monday", "wednesday", "friday"],
                items: {
                    description: "A day of the week",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
            departureTime: {
                description: "The time in ISO 8601 extended format that the owner will start their route",
                example: "12:22:00Z",
                type: "string",
            },
            id: {
                description: "The internal id of this route",
                format: "int32",
                type: "integer",
            },
            name: {
                description: "The name of this route",
                example: "Ride to work",
                type: "string",
            },
        },
        required: ["id"],
    },
    UpdateRouteResponse: {
        description: "Whether the update succeeded",
        properties: {
            result: {
                type: "boolean",
            },
        },
        required: ["result"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorization).then(userId => {
        if (userId !== undefined) {
            return Database.getExperiencedRouteById(payload.id).then(route => {
                if (route.owner === userId) {
                    return Database.updateExperiencedRoute(route, payload);
                } else {
                    throw "403:Invalid authorization";
                }
            }, err => {
                throw err;
            });
        } else {
            throw "403:Invalid authorization";
        }
    }, err => {
        throw err;
    });
};

// end point definition
export const updateExperiencedRoute = new MicroserviceEndpoint("updateExperiencedRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
