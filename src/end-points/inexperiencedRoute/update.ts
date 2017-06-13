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
                description: "The inexperienced route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/InexperiencedRouteChanges",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Inexperienced route was updated",
                schema: {
                    $ref: "#/definitions/UpdateInexperiencedRouteResponse",
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
        summary: "Update an existing inexperienced route",
        tags: [
            "InexperiencedRoutes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    InexperiencedRouteChanges: {
        properties: {
            arrivalDateTime: {
                description: "The time in ISO 8601 extended format that the owner wants to arrive at " +
                "their destination",
                example: new Date().toISOString(),
                type: "string",
            },
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of " +
                "an experienced route to be considered a match",
            },
            endPointName: {
                description: "The name of where the user wants to end up",
                example:  "64 Crawley Crescent",
                type: "string",
            },
            id: {
                description: "The internal id of this inexperienced route",
                format: "int32",
                type: "integer",
            },
            length: {
                description: "How long this route is, by the shortest possible route, in meters",
                example: 6666,
                type: "number",
            },
            name: {
                description: "The name of this route",
                example: "Ride to the park",
                type: "string",
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
                description: "Where the user will start cycling from. Must be within <radius> of " +
                "an experienced route to be considered a match",
            },
            startPointName: {
                description: "The name of where the user wants to start",
                example:  "18 Ryan Road",
                type: "string",
            },
        },
        required: ["id"],
    },
    UpdateInexperiencedRouteResponse: {
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
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization, transactionClient);
    }).then(authUserId => {
        userId = authUserId;
        if (userId !== undefined) {
            return Database.getInexperiencedRoutes({userId, id: payload.id}, transactionClient);
        } else {
            throw new Error("403:Invalid authorization");
        }
    }).then(inexperiencedRoutes => {
        if (inexperiencedRoutes.length === 1) {
            if (inexperiencedRoutes[0].owner === userId) {
                return Database.updateInexperiencedRoute(inexperiencedRoutes[0], payload, transactionClient);
            } else {
                throw new Error("403:Invalid authorization");
            }
        } else if (inexperiencedRoutes.length === 0) {
            throw new Error("404:Inexperienced route not found");
        } else {
            throw new Error("Multiple inexperienced routes exist with the id " + payload.id +
                "! This needs to be resolved");
        }
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
export const updateInexperiencedRoute = new MicroserviceEndpoint("updateInexperiencedRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
