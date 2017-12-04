import { getIdFromJWT } from "../../../common/auth";
import * as Database from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        description: "This endpoint sets the review score for a ride, and also marks it as completed. " +
        "It will update the experiencedUser's rating, and if this is a new review, both user's distances.",
        parameters: [
            {
                description: "The details needed to review a BuddyRequest",
                in: "body",
                name: "detailss",
                required: true,
                schema: {
                    $ref: "#/definitions/SetStatusDetails",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Updated review",
                schema: {
                    $ref: "#/definitions/SetReviewResponse",
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
        summary: "Review a BuddyRequest",
        tags: [
            "BuddyRequests",
        ],
    },
};

// DEFINITIONS

const definitions = {
    SetReviewResponse: {
        properties: {
            result: {
                description: "Did the review succeede",
                example: true,
                type: "boolean",
            },
        },
        required: ["result"],
    },
    SetStatusDetails: {
        properties: {
            id: {
                description: "The id of the buddyRequest to review",
                type: "integer",
            },
            score: {
                description: "The review score of star ratings",
                enum: [1, 2, 3, 4, 5],
                example: 1,
                type: "integer",
            },
        },
        required: ["id", "score"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const buddyRequestId = parseInt(params.body.id, 10);
    const score = parseInt(params.body.score, 10);
    if (buddyRequestId === undefined) {
        throw new Error("400:Please specify the BuddyRequest you want to review by passing an ID");
    }
    let transactionClient;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization, transactionClient);
    }).then(userId => {
        return Database.updateBuddyRequestReview(userId, buddyRequestId, score, transactionClient);
    }).then(() => {
        return Database.commitAndReleaseTransaction(transactionClient);
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
export const setReview = new MicroserviceEndpoint("setReview")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
