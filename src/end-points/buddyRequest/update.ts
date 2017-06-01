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
                description: "The buddy request and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/BuddyRequestChanges",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Buddy request was updated",
                schema: {
                    $ref: "#/definitions/UpdateBuddyRequestResponse",
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
        summary: "Update an existing buddy request",
        tags: [
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    BuddyRequestChanges: {
        properties: {
            arrivalTime: {
                description: "The time in ISO 8601 extended format that the owner wants to arrive at " +
                "their destination",
                type: "string",
            },
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of a route to be " +
                "considered a match",
            },
            id: {
                description: "The internal id of this buddy request",
                format: "int32",
                type: "integer",
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
            },
        },
        required: ["id"],
    },
    UpdateBuddyRequestResponse: {
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
    return getIdFromJWT(params.authorization).then(userId => {
        if (userId !== undefined) {
            return Database.getBuddyRequests({userId, id: payload.id});
        } else {
            throw new Error("403:Invalid authorization");
        }
    }).then(buddyRequests => {
        if (buddyRequests.length === 1) {
            return Database.updateBuddyRequest(buddyRequests[0], payload);
        } else if (buddyRequests.length === 0) {
            throw new Error("404:Buddy request not found");
        } else {
            throw new Error("Multiple buddy requests exist with the id " + payload.id +
                "! This needs to be resolved");
        }
    });
};

// end point definition
export const updateBuddyRequest = new MicroserviceEndpoint("updateBuddyRequest")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
