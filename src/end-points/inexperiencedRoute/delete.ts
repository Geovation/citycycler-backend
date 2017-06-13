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
                description: "The inexperienced route ID",
                in: "query",
                name: "id",
                required: true,
                type: "integer",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The inexperienced route was deleted",
            },
            403: {
                description: "An invalid authorization token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "The inexperienced route doesn't exist",
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
        summary: "Delete an inexperienced route",
        tags: [
            "InexperiencedRoutes",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const inexperiencedRouteId = parseInt(params.id, 10);
    let transactionClient;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization, transactionClient);
    }).then(userId => {
        return Database.getInexperiencedRoutes({userId, id: inexperiencedRouteId}, transactionClient);
    }).then(inexperiencedRoutes => {
        if (inexperiencedRoutes.length === 1) {
            return Database.deleteInexperiencedRoute(inexperiencedRouteId, transactionClient);
        } else if (inexperiencedRoutes.length === 0) {
            throw new Error("404:InexperiencedRoute doesn't exist");
        } else {
            throw new Error("Multiple inexperienced routes exist with the id " + inexperiencedRouteId +
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
export const deleteInexperiencedRoute = new MicroserviceEndpoint("deleteInexperiencedRoute")
    .addSwaggerOperation(operation)
    .addService(service);
