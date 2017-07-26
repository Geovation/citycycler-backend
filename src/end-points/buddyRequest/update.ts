import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import * as FcmNotifications from "../../common/fcmNotifications";
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
                description: "The BuddyRequest properties to be updated",
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
                description: "BuddyRequest was updated",
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
        summary: "Update an existing BuddyRequest",
        tags: [
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    BuddyRequestChanges: {
        properties: {
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
            id: {
                description: "The id for the BuddyRequest to update",
                type: "integer",
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
        },
        required: ["id"],
    },
    UpdateBuddyRequestResponse: {
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
    let userId;
    let transactionClient;
    let targetBuddyRequest;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization);
    }).then(authUserId => {
        userId = authUserId;
        if (userId !== undefined) {
            return Database.getReceivedBuddyRequests({userId, id: payload.id});
        } else {
            throw new Error("403:Invalid authorization");
        }
    }).then(buddyRequests => {
        if (buddyRequests.length === 1) {
            targetBuddyRequest = buddyRequests[0];
            const updates = {
                divorcePoint: payload.divorcePoint,
                divorcePointName: payload.divorcePointName,
                divorceTime: payload.divorceTime,
                length: payload.length,
                meetingPoint: payload.meetingPoint,
                meetingPointName: payload.meetingPointName,
                meetingTime: payload.meetingTime,
            };
            return Database.updateBuddyRequest(buddyRequests[0], updates);
        } else if (buddyRequests.length === 0) {
            throw new Error("404:BuddyRequest not found");
        } else {
            throw new Error("Multiple BuddyRequests exist with the id " + payload.id + "!");
        }
    }).then(() => {
        return Database.commitAndReleaseTransaction(transactionClient);
    }).then(() => {
        // send notification to affected user (recipient or sender of buddy request)
        let notificationTargetUser;
        let notificationType;
        let message;
        if (targetBuddyRequest.owner === userId) {
            notificationType = "buddyrequest_recipient_detailschange";
            notificationTargetUser = targetBuddyRequest.experiencedUser;
            message = "The details of the buddy request for your route " +
                targetBuddyRequest.experiencedRouteName + " have been changed.";
        } else {
            notificationType = "buddyrequest_sender_detailschange";
            notificationTargetUser = targetBuddyRequest.owner;
            message = "The details of your buddy request for your route '" +
                targetBuddyRequest.inexperiencedRouteName + "', meeting at " +
                (payload.meetingTime ? payload.meetingTime : targetBuddyRequest.meetingTime) +
                 "have been updated";
        }
        // notify correct person
        FcmNotifications.notify(
            notificationTargetUser,
            {
                data: {
                    buddyRequestId: payload.id.toString(),
                    experiencedRouteName: targetBuddyRequest.experiencedRouteName,
                    inexperiencedRouteName: targetBuddyRequest.inexperiencedRouteName,
                    meetingPointName: targetBuddyRequest.meetingPointName,
                    meetingTime: targetBuddyRequest.meetingTime.toString(),
                    type: notificationType,
                    updates: JSON.stringify(payload),
                },
                notification: {
                    body: message,
                    title: "MatchMyRoute: Buddy request details changed",
                },
            }
        );
    }).then(() => {
        return true;
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
export const updateBuddyRequest = new MicroserviceEndpoint("updateBuddyRequest")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
