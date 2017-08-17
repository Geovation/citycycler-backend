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
                description: "The new status and reason for it",
                in: "body",
                name: "status",
                required: true,
                schema: {
                    $ref: "#/definitions/BuddyRequestStatusChanges",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Status was updated",
                schema: {
                    $ref: "#/definitions/UpdateBuddyRequestStatusResponse",
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
        summary: "Update the status of a BuddyRequest",
        tags: [
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    BuddyRequestStatusChanges: {
        properties: {
            id: {
                description: "The id of the BuddyRequest to be updated",
                type: "integer",
            },
            reason: {
                description: "The reason for the status",
                example: "Because Mr. Annoying deleted his account",
                type: "string",
            },
            status: {
                description: "The new status of this BuddyRequest",
                enum: ["accepted", "rejected", "pending", "canceled"],
                example: "canceled",
                type: "string",
            },
        },
        required: ["status", "reason"],
    },
    UpdateBuddyRequestStatusResponse: {
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
            return Database.getBuddyRequests({userId, id: payload.id});
        } else {
            throw new Error("403:Invalid authorization");
        }
    }).then(buddyRequests => {
        // Ok! We should have the buddy request now, no matter which user is updating the status!
        if (buddyRequests.length === 1) {
            targetBuddyRequest = buddyRequests[0];
            const userIsExperienced = buddyRequests[0].experiencedUser === userId;
            const existingStatus = buddyRequests[0].status;
            let newStatus = payload.status;
            let newReason = "";
            // In this switch we look for which cases shouldn't be allowed and throw an error on them
            // If the whole thing passes, it means that the new status is a valid update
            switch (newStatus) {
                case "accepted":
                    // Only the experienced user should be allowed to do this
                    // In this case the reason is non-mandatory, but might be used as a note (depending on frontend).
                    if (!userIsExperienced) {
                        throw new Error("403:Only the experienced cyclist can accept a BuddyRequest");
                    }
                    // You can't accept a canceled BuddyRequest
                    if (existingStatus === "canceled") {
                        throw new Error("400:Can't accept a canceled BuddyRequest");
                    }
                    // You can't accept a rejected BuddyRequest
                    if (existingStatus === "rejected") {
                        throw new Error("400:Can't accept a rejected BuddyRequest");
                    }
                    newReason = payload.reason;
                    break;
                case "rejected":
                    // Only the experienced user should be allowed to do this
                    // A reason is not required, but should probably be given
                    // (frontend doesn't allow setting one currently).
                    if (!userIsExperienced) {
                        throw new Error("403:Only the experienced cyclist can reject a BuddyRequest");
                    }
                    // You can't reject a canceled BuddyRequest
                    if (existingStatus === "canceled") {
                        throw new Error("400:Can't reject a canceled BuddyRequest");
                    }
                    // You can't reject an accepted BuddyRequest
                    if (existingStatus === "accepted") {
                        throw new Error("400:Can't reject an accepted BuddyRequest. You should cancel it instead.");
                    }
                    newReason = payload.reason;
                    break;
                case "canceled":
                    // Both users can do this, but a reason needs to be given
                    if (payload.reason === undefined || payload.reason === null || !payload.reason.length) {
                        throw new Error("400:A reason needs to be given to cancel a BuddyRequest");
                    }
                    // The experienced user shouldn't cancel this if it's pending, they should reject it instead
                    if (userIsExperienced && existingStatus === "pending") {
                        throw new Error("400:Can't cancel a pending BuddyRequest. You should reject it instead.");
                    }
                    // The inexperienced user shouldn't be able to cancel this if it's been rejected
                    if (!userIsExperienced && existingStatus === "rejected") {
                        throw new Error("400:Can't cancel a rejected BuddyRequest");
                    }
                    newReason = payload.reason;
                    break;
                case "cancelled":
                    // Be friendly to non-US developers :)
                    throw new Error("400:Invalid status 'cancelled', did you mean 'canceled'?");
                case "pending":
                    throw new Error("400:Can't reset a BuddyRequest's status to 'pending'");
                case "completed":
                    throw new Error("400:Can't set a BuddyRequest's status to 'completed'. This only " +
                        "happens when a user submits a review.");
                default:
                    throw new Error("400:Invalid status " + newStatus);
            }
            const updates = {
                reason: newReason,
                status: newStatus,
            };
            return Database.updateBuddyRequest(buddyRequests[0], updates);
        } else if (buddyRequests.length === 0) {
            throw new Error("404:BuddyRequest not found");
        } else {
            throw new Error("Multiple BuddyRequests exist with the id " + payload.id + "!");
        }
    }).then(() => {
        return Database.commitAndReleaseTransaction(transactionClient);
    }).then(
        () => {
            let notificationTargetUser;
            let notificationType;
            let message;
            if (targetBuddyRequest.owner === userId) {
                notificationType = "buddyrequest_recipient_statuschange";
                notificationTargetUser = targetBuddyRequest.experiencedUser;
                message = "The request of for your route '" +
                    targetBuddyRequest.experiencedRouteName + "' was cancelled";
            } else {
                notificationType = "buddyrequest_sender_statuschange";
                notificationTargetUser = targetBuddyRequest.owner;
                message = "The request for your route '" + targetBuddyRequest.inexperiencedRouteName +
                    "', meeting at " + targetBuddyRequest.meetingTime + "was " + payload.status;
            }
            // notify correct person
            FcmNotifications.notify(
                notificationTargetUser,
                {
                    data: {
                        buddyRequestId: payload.id.toString(),
                        experiencedRoute: targetBuddyRequest.experiencedRoute.toString(),
                        experiencedRouteName: targetBuddyRequest.experiencedRouteName,
                        inexperiencedRoute: targetBuddyRequest.inexperiencedRoute.toString(),
                        inexperiencedRouteName: targetBuddyRequest.inexperiencedRouteName,
                        meetingPointName: targetBuddyRequest.meetingPointName,
                        meetingTime: targetBuddyRequest.meetingTime.toString(),
                        reason: payload.reason,
                        status: payload.status,
                        type: notificationType,
                    },
                    notification: {
                        body: message,
                        title: "MatchMyRoute: Buddy request " + payload.status,
                    },
                }
            );
        }
    ).then(() => {
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
export const updateBuddyRequestStatus = new MicroserviceEndpoint("updateBuddyRequestStatus")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
