import { getIdFromJWT } from "../../../common/auth";
import { createRouteQuery as createQuery } from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    put: {
        consumes: ["application/json"],
        description: "This endpoint stores an object that can be used to find matching routes - in effect a " +
        "query object.",
        parameters: [
            {
                description: "The start and end points of the route that this query will match",
                in: "body",
                name: "queryObj",
                required: true,
                schema: {
                    $ref: "#/definitions/RouteQuery",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "Created a new route query",
                schema: {
                    $ref: "#/definitions/CreateRouteQueryResponse",
                },
            },
            400: {
                description: "Invalid search parameters, see error message",
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
        summary: "Save an inexperienced route",
        tags: [
            "Routes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CreateRouteQueryResponse: {
        properties: {
            result: {
                properties: {
                    id: {
                        description: "The route query's id",
                        type: "integer",
                    },
                },
            },
        },
        required: ["result"],
    },
    RouteQuery: {
        description: "Information needed to search for a matching route",
        properties: {
            arrivalTime: {
                description: "The time in seconds past midnight that the route owner wants to arrive at <endPoint>",
                type: "integer",
            },
            days: {
                description: "Which days of the week the user can cycle (a matching route) on",
                example: ["monday", "wednesday", "friday"],
                items: {
                    description: "A day of the week",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of a route to be " +
                "considered a match",
            },
            radius: {
                description: "How far away (in meters) the user is willing to cycle from the start and end point",
                example: 1000,
                type: "integer",
            },
            startPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will start cycling from. Must be within <radius> of a route to be " +
                "considered a match",
            },
        },
        required: ["startPoint", "endPoint", "days"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorization).then(userId => {
        return createQuery(userId, payload).then(id => {
            return { id, status: 201 };
        });
    }, err => {
        throw err;
    });
};

// end point definition
export const createRouteQuery = new MicroserviceEndpoint("createRouteQuery")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
