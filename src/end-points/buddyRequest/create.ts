import { getIdFromJWT } from "../../common/auth";
import { createBuddyRequest as createQuery } from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

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
        "query object. To search for routes created by this endpoint, make a request to buddyRequest/query?{ID}",
        parameters: [
            {
                description: "The start and end points of the route that this query will match",
                in: "body",
                name: "queryObj",
                required: true,
                schema: {
                    $ref: "#/definitions/BuddyRequest",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "Created a new route query",
                schema: {
                    $ref: "#/definitions/CreateBuddyRequestResponse",
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
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CreateBuddyRequestResponse: {
        properties: {
            result: {
                properties: {
                    id: {
                        description: "The buddy request's id",
                        type: "integer",
                    },
                },
            },
        },
        required: ["result"],
    },
    BuddyRequest: {
        description: "Information needed to search for a matching route",
        properties: {
            arrivalTime: {
                description: "The time in ISO 8601 extended format that the route owner wants to arrive at <endPoint>",
                example: "2017-06-01 00:00:00",
                type: "string",

            },
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of a route to be " +
                "considered a match",
                example:  [ 0, 0] ,
            },
            notifyOwner: {
                description: "Does the user want to be notified of any new experienced cyclists who can help them",
                example: true,
                type: "boolean",
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
                example:  [ 0, 0] ,
            },
        },
        required: ["startPoint", "endPoint", "notifyOwner"],
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
export const createBuddyRequest = new MicroserviceEndpoint("createBuddyRequest")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
