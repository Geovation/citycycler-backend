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
                    "received buddyRequests of the user will be returned)",
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
        summary: "Retrieve a received BuddyRequest by it's ID, or get all of a user's received BuddyRequests",
        tags: [
            "BuddyRequests",
        ],
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
        return Database.getReceivedBuddyRequests({userId, id}, transactionClient);
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
export const getReceivedBuddyRequests = new MicroserviceEndpoint("getReceivedBuddyRequests")
    .addSwaggerOperation(operation)
    .addService(service);
