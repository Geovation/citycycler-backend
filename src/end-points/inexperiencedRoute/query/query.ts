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
                description: "The id of the inexperiencedRoute to use as a query",
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
        summary: "Find routes that match this inexperienced route",
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
    if (isNaN(inexperiencedRouteId) || inexperiencedRouteId < 0) {
        throw new Error("400:Invalid ID");
    }
    let userId;
    return getIdFromJWT(params.authorization).then(authUserId => {
        userId = authUserId;
        return Database.getInexperiencedRoutes({userId, id: inexperiencedRouteId});
    }).then(inexperiencedRoutes => {
        if (inexperiencedRoutes.length === 1) {
            if (inexperiencedRoutes[0].owner === userId) {
                return Database.matchRoutes(inexperiencedRoutes[0]);
            } else {
                throw new Error("403:Invalid authorization");
            }
        } else if (inexperiencedRoutes.length === 0) {
            throw new Error("404:Inexperienced Route doesn't exist");
        } else {
            throw new Error("There are multiple inexperienced routes with the id " + inexperiencedRouteId + "!");
        }
    });
};

// end point definition
export const inexperiencedRouteQuery = new MicroserviceEndpoint("inexperiencedRouteQuery")
    .addSwaggerOperation(operation)
    .addService(service);
