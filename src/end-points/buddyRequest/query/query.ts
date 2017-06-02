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
    get: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The id of the buddyRequest to use as a query",
                in: "query",
                name: "id",
                required: true,
                type: "integer",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Search was successful",
                schema: {
                    $ref: "#/definitions/GetRoutesResponse",
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
        summary: "Find routes that match this buddy request",
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
    if (isNaN(buddyRequestId) || buddyRequestId < 0) {
        throw new Error("400:Invalid ID");
    }
    let userId;
    return getIdFromJWT(params.authorization).then(authUserId => {
        userId = authUserId;
        return Database.getBuddyRequests({userId, id: buddyRequestId});
    }).then(buddyRequests => {
        if (buddyRequests.length === 1) {
            if (buddyRequests[0].owner === userId) {
                return Database.matchRoutes(buddyRequests[0]);
            } else {
                throw new Error("403:Invalid authorization");
            }
        } else if (buddyRequests.length === 0) {
            throw new Error("404:Buddy Request doesn't exist");
        } else {
            throw new Error("There are multiple buddy requests with the id " + buddyRequestId + "!");
        }
    });
};

// end point definition
export const buddyRequestQuery = new MicroserviceEndpoint("buddyRequestQuery")
    .addSwaggerOperation(operation)
    .addService(service);
