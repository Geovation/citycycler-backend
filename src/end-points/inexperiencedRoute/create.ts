import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    put: {
        consumes: ["application/json"],
        description: "This endpoint stores a query object that can be used to find the matched routes." +
        "To search for routes created by this endpoint, make a request to inexperiencedRoute/query with the route id",
        parameters: [
            {
                description: "The start and end points of the route that this query will match",
                in: "body",
                name: "queryObj",
                required: true,
                schema: {
                    $ref: "#/definitions/InexperiencedRoute",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "Created a new inexperienced route",
                schema: {
                    $ref: "#/definitions/CreateInexperiencedRouteResponse",
                },
            },
            400: {
                description: "Invalid search parameters, see error message",
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
        summary: "Save an inexperienced route",
        tags: [
            "InexperiencedRoutes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CreateInexperiencedRouteResponse: {
        properties: {
            result: {
                properties: {
                    id: {
                        description: "The inexperienced route's id",
                        type: "integer",
                    },
                },
            },
        },
        required: ["result"],
    },
    InexperiencedRoute: {
        description: "Information needed to search for a matching route",
        properties: {
            arrivalDateTime: {
                description: "The time in ISO 8601 extended format that the route owner wants to arrive at <endPoint>",
                example: new Date().toISOString(),
                type: "string",
            },
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of " +
                "an experienced route to be considered a match",
                example:  [ 0, 0] ,
            },
            endPointName: {
                description: "The name of where the user wants to end up",
                example:  "64 Crawley Crescent",
                type: "string",
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
            reusable: {
                description: "Whether or not the route should be reusable for other buddy searches/requests",
                example: false,
                type: "boolean",
            },
            startPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will start cycling from. Must be within <radius> of " +
                "an experienced route to be considered a match",
                example:  [ 0, 0] ,
            },
            startPointName: {
                description: "The name of where the user wants to start",
                example:  "18 Ryan Road",
                type: "string",
            },
        },
        required: [
            "arrivalDateTime",
            "radius",
            "startPoint",
            "startPointName",
            "endPoint",
            "endPointName",
            "length",
            "notifyOwner",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    let transactionClient;
    let newId;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization, transactionClient);
    }).then(userId => {
        return Database.createInexperiencedRoute(userId, payload, transactionClient);
    }).then(id => {
        newId = id;
        return Database.commitAndReleaseTransaction(transactionClient);
    }).then(() => {
        return { id: newId, status: 201 };
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
export const createInexperiencedRoute = new MicroserviceEndpoint("createInexperiencedRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
