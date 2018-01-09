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
        description: "This endpoint accepts id of the inexperienced route with new optional arrival datetime " +
        "and returns the matched experienced routes",
        parameters: [
            {
                description: "The data needed to find the matched route",
                in: "body",
                name: "query",
                required: true,
                schema: {
                    $ref: "#/definitions/QueryInfo",
                },
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

// DEFINITIONS

const definitions = {
    QueryInfo: {
        description: "Information needed to search for matched route",
        properties: {
            id: {
                description: "The id of the inexperienced route to use as a query",
                type: "number",
            },
            newArrivalDateTime: {
                description: "The new arrival datetime of this route in ISO 8601 extended format",
                example: new Date().toISOString(),
                type: "string",
            },
        },
        required: ["id"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const inexperiencedRouteId = parseInt(params.body.id, 10);
    const newArrivalDateTime = params.body.newArrivalDateTime ? params.body.newArrivalDateTime : null;
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
                return Database.matchRoutes(inexperiencedRoutes[0], userId, newArrivalDateTime);
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
    .addSwaggerDefinitions(definitions)
    .addService(service);
