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
    delete: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The buddy request ID",
                in: "query",
                name: "id",
                required: true,
                type: "integer",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The buddy request was deleted",
            },
            403: {
                description: "An invalid authorization token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "The buddy request doesn't exist",
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
        summary: "Delete a buddy request",
        tags: [
            "BuddyRequests",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const buddyRequestId = parseInt(params.id, 10);
    return getIdFromJWT(params.authorization).then(userId => {
        return Database.getBuddyRequests({userId, id: buddyRequestId});
    }).then(buddyRequests => {
        if (buddyRequests.length === 1) {
            return Database.deleteBuddyRequest(buddyRequestId);
        } else if (buddyRequests.length === 0) {
            return true;
        } else {
            throw new Error("Multiple buddy requests exist with the id " + buddyRequestId +
                "! This needs to be resolved");
        }
    });
};

// end point definition
export const deleteBuddyRequest = new MicroserviceEndpoint("deleteBuddyRequest")
    .addSwaggerOperation(operation)
    .addService(service);
