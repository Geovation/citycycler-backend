import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import * as FcmNotifications from "../../common/fcmNotifications";
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
        description: "This endpoint stores a buddy request.",
        parameters: [
            {
                description: "The parameters describing the buddy request",
                in: "body",
                name: "buddyrequest",
                required: true,
                schema: {
                    $ref: "#/definitions/BuddyRequest",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "Created a new buddyRequest",
                schema: {
                    $ref: "#/definitions/CreateBuddyRequestResponse",
                },
            },
            400: {
                description: "Invalid parameters, see error message",
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
        summary: "Save a new BuddyRequest",
        tags: [
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    BuddyRequest: {
        description: "A request from an inexperienced user to an experienced user",
        properties: {
            averageSpeed: {
                description: "The average speed of the experienced cyclist on this route in m/s. " +
                    "This is used to calculate time to/from the meeting and divorce points.",
                example: 3.3,
                type: "number",
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
            inexperiencedRoute: {
                description: "The ID of the inexperienced user's route",
                type: "integer",
            },
            inexperiencedRouteName: {
                description: "The name of the experienced user's route. Used for display purposes",
                example: "My ride to the cinema",
                type: "string",
            },
            length: {
                description: "How long the shared part of the route is in meters",
                example: 1000,
                type: "integer",
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
            route: {
                $ref: "#/definitions/CoordList",
                example: [[0, 0], [0.5, 0.5], [1, 1]],
            },
        },
        required: [
            "averageSpeed",
            "divorcePoint",
            "divorcePointName",
            "divorceTime",
            "experiencedRoute",
            "experiencedRouteName",
            "experiencedUser",
            "inexperiencedRoute",
            "inexperiencedRouteName",
            "length",
            "meetingPoint",
            "meetingPointName",
            "meetingTime",
            "route",
        ],
    },
    CreateBuddyRequestResponse: {
        properties: {
            result: {
                properties: {
                    id: {
                        description: "The BuddyRequest's id",
                        type: "integer",
                    },
                },
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
    let transactionClient;
    let newId;
    let ownerUserId;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization);
    }).then(userId => {
        ownerUserId = userId;
        const newBuddyRequest = {
            averageSpeed: payload.averageSpeed,
            created: new Date().toISOString(),
            divorcePoint: payload.divorcePoint,
            divorcePointName: payload.divorcePointName,
            divorceTime: payload.divorceTime,
            experiencedRoute: payload.experiencedRoute,
            experiencedRouteName: payload.experiencedRouteName, // We could get this from the database if we need to...
            experiencedUser: payload.experiencedUser,
            inexperiencedRoute: payload.inexperiencedRoute,
            inexperiencedRouteName: payload.inexperiencedRouteName,
            length: payload.length,
            meetingPoint: payload.meetingPoint,
            meetingPointName: payload.meetingPointName,
            meetingTime: payload.meetingTime,
            owner: userId,
            reason: "",
            review: 0,
            route: payload.route,
            status: "pending",
            updated: new Date().toISOString(),
        };
        return Database.createBuddyRequest(newBuddyRequest, transactionClient);
    }).then(id => {
        newId = id;
        return Database.commitAndReleaseTransaction(transactionClient);
    }).then(
        () => {
            FcmNotifications.notify(payload.experiencedUser, {
                data: {
                    buddyRequestId: newId.toString(),
                    experiencedRouteName: payload.experiencedRouteName,
                    meetingTime: payload.meetingTime,
                    sender: ownerUserId.toString(),
                    type: "buddyrequest_received",
                },
                notification: {
                    body: "For route '" +
                        payload.experiencedRouteName + "' to meet " + payload.meetingTime,
                    title: "MatchMyRoute: New buddy request",
                },
            });
        }
    )
    .then(() => {
        return { id: newId, status: 201 };
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
export const createBuddyRequest = new MicroserviceEndpoint("createBuddyRequest")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
