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
        summary: "Delete a inexperienced route",
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
    return getIdFromJWT(params.authorization).then(userId => {
        return Database.getInexperiencedRoutes({userId, id: inexperiencedRouteId});
    }).then(inexperiencedRoutes => {
        if (inexperiencedRoutes.length === 1) {
            return Database.deleteInexperiencedRoute(inexperiencedRouteId);
        } else if (inexperiencedRoutes.length === 0) {
            throw new Error("404:InexperiencedRoute doesn't exist");
        } else {
            throw new Error("Multiple inexperienced routes exist with the id " + inexperiencedRouteId +
                "! This needs to be resolved");
        }
    });
};

// end point definition
export const deleteInexperiencedRoute = new MicroserviceEndpoint("deleteInexperiencedRoute")
    .addSwaggerOperation(operation)
    .addService(service);
