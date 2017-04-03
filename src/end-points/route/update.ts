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
            "Routes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    RouteChanges: {
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the owner arrives at their destination",
                type: "integer",
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
                description: "The time in seconds past midnight that the owner will start their route",
                type: "integer",
            },
            id: {
                description: "The internal id of this route",
                format: "int32",
                type: "integer",
            },
            route: {
                $ref: "#/definitions/CoordList",
            },
        },
        required: ["id"],
    },
    UpdateRouteResponse: {
        description: "Whether the update succeded",
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
    return getIdFromJWT(params.authorisation).then(userId => {
        if (userId !== undefined) {
            return Database.getRouteById(payload.id).then(route => {
                if (route.owner === userId) {
                    return Database.updateRoute(route, payload);
                } else {
                    throw "403:Invalid authorisation";
                }
            }, err => {
                throw err;
            });
        } else {
            throw "403:Invalid authorisation";
        }
    }, err => {
        throw err;
    });
};

// end point definition
export const updateRoute = new MicroserviceEndpoint("updateRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
