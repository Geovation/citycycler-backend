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
    get: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The buddyRequest ID (if empty, all " +
                    "sent buddyRequests of the user will be returned)",
                in: "query",
                name: "id",
                required: false,
                type: "integer",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "BuddyRequest was retrieved",
                schema: {
                    $ref: "#/definitions/GetBuddyRequestResponse",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "BuddyRequest doesn't exist, or none do for this user",
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
        summary: "Retrieve a sent BuddyRequest by it's ID, or get all of a user's sent BuddyRequests",
        tags: [
            "BuddyRequests",
        ],
    },
};

const definitions = {
    BuddyRequestData: {
        properties: {
            averageSpeed: {
                description: "The average speed of the experienced cyclist on this route in m/s. " +
                    "This is used to calculate time to/from the meeting and divorce points",
                example: 3.3,
                type: "number",
            },
            created: {
                description: "The date and time that the BuddyRequest was created in ISO 8601 extended format",
                example: new Date().toISOString(),
                type: "string",
            },
            divorcePoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the users will split up after their ride",
                example: [-52, 3],
            },
            divorcePointName: {
                description: "The name of the place where the users will split up after their ride",
                example: "32 Derek Drive",
                type: "string",
            },
            divorceTime: {
                description: "The time in ISO 8601 extended at which the users will split up at " +
                    "the end of the ride",
                example: new Date().toISOString(),
                type: "string",
            },
            experiencedRoute: {
                description: "The ID of the experienced user's route",
                type: "integer",
            },
            experiencedRouteName: {
                description: "The name of the experienced user's route. Used for display purposes",
                example:  "Bob's ride to work",
                type: "string",
            },
            experiencedUser: {
                description: "The ID of the experienced user",
                type: "integer",
            },
            id: {
                description: "The internal id for this BuddyRequest",
                type: "integer",
            },
            inexperiencedRoute: {
                description: "The ID of the inexperienced user's route",
                type: "integer",
            },
            inexperiencedRouteName: {
                description: "The name of the inexperienced user's route",
                example: "My ride to the cinema",
                type: "string",
            },
            length: {
                description: "How long the shared section of route is in meters",
                example: 1000,
                type: "number",
            },
            meetingPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the users will meet up before their ride",
                example: [-51, 3],
            },
            meetingPointName: {
                description: "The name of the place where the users will meet up before their ride",
                example: "33 Shelly Street",
                type: "string",
            },
            meetingTime: {
                description: "The time in ISO 8601 extended at which the users will meet up to " +
                    "start riding together",
                example: new Date().toISOString(),
                type: "string",
            },
            myRoute: {
                $ref: "#/definitions/CoordList",
                description: "The requesting user's route. If it is an ExperiencedRoute, it will have the" +
                    "whole route, while if it is an inexperiencedRoute, it will only have the start/end points",
                example: [[0, 0], [1, 1]],
                type: "array",
            },
            otherUser: {
                $ref: "#/definitions/User",
                description: "The other user's profile",
            },
            owner: {
                description: "The ID of the current user",
                type: "integer",
            },
            reason: {
                description: "A reason to describe why the status is what it is",
                example: "Because I'm feeling lazy today",
                type: "string",
            },
            review: {
                description: "The review left by the inexperiencedUser",
                enum: [1, 0, -1],
                example: 1,
                type: "number",
            },
            route: {
                $ref: "#/definitions/CoordList",
                example: [[0, 0], [0.5, 0.5], [1, 1]],
            },
            status: {
                description: "The status of this BuddyRequest",
                enum: ["pending", "accepted", "rejected", "canceled", "completed"],
                example: "rejected",
                type: "string",
            },
            updated: {
                description: "The date and time that the BuddyRequest was last updated in ISO 8601 extended format",
                example: new Date().toISOString(),
                type: "string",
            },
        },
        required: [
            "averageSpeed",
            "created",
            "divorcePoint",
            "divorcePointName",
            "divorceTime",
            "experiencedRoute",
            "experiencedRouteName",
            "experiencedUser",
            "id",
            "inexperiencedRoute",
            "inexperiencedRouteName",
            "length",
            "meetingPoint",
            "meetingPointName",
            "meetingTime",
            "myRoute",
            "otherUser",
            "owner",
            "reason",
            "review",
            "route",
            "status",
            "updated",
        ],
    },
    BuddyRequestGetResult: {
        description: "An array of BuddyRequests belonging to this user",
        items: {
            $ref: "#/definitions/BuddyRequestData",
        },
        type: "array",
    },
    GetBuddyRequestResponse: {
        properties: {
            result: {
                $ref: "#/definitions/BuddyRequestGetResult",
            },
        },
        required: ["result"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    let id = parseInt(params.id, 10);
    if (!id) {
        id = null;
    }
    let results;
    let transactionClient;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization);
    }).then((userId) => {
        return Database.getSentBuddyRequests({userId, id}, transactionClient);
    }).then(buddyRequests => {
        results = buddyRequests;
        return Database.commitAndReleaseTransaction(transactionClient);
    }).then(() => {
        return results;
    }).catch(err => {
        const originalError = typeof err === "string" ? err : err.message;
        if (typeof transactionClient !== "undefined") {
            return Database.rollbackAndReleaseTransaction(transactionClient)
            .then(() => {
                throw new Error(originalError);
            });
        } else {
            throw new Error(originalError);
        }
    });
};

// end point definition
export const getSentBuddyRequests = new MicroserviceEndpoint("getSentBuddyRequests")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
