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
                description: "The inexperienced route ID (if empty, all " +
                    "inexperienced routes of the user will be returned)",
                in: "query",
                name: "id",
                required: false,
                type: "integer",
            },
            {
                default: false,
                description: "The flag indicates whether to include the deleted routes",
                in: "query",
                name: "includedeleted",
                required: false,
                type: "boolean",
            },
            {
                description: "Whether only reusable routes should be received " +
                    "or all routes",
                in: "query",
                name: "onlyreusable",
                required: false,
                type: "boolean",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Inexperienced route was retrieved",
                schema: {
                    $ref: "#/definitions/GetInexperiencedRouteResponse",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "Inexperienced route doesn't exist",
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
        summary: "Retrieve an inexperienced route by it's ID. If no ID is provided, all inexperienced routes " +
        "of the user are returned",
        tags: [
            "InexperiencedRoutes",
        ],
    },
};

const definitions = {
    GetInexperiencedRouteResponse: {
        properties: {
            result: {
                $ref: "#/definitions/InexperiencedRouteGetResult",
            },
        },
        required: ["result"],
    },
    InexperiencedRouteData: {
        properties: {
            arrivalDateTime: {
                description: "The time in ISO 8601 extended format that the owner wants to arrive at " +
                "their destination",
                example: new Date().toISOString(),
                type: "string",
            },
            deleted: {
                description: "The deleted status of this route",
                example: "false",
                type: "boolean",
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
                description: "This inexperienced route's internal id",
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
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            radius: {
                 description: "How far away (in meters) the user is willing to cycle from the start and end point",
                 example: 1000,
                 type: "integer",
            },
            reusable: {
                description: "Whether this route is reusable",
                example: "false",
                type: "boolean",
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
        required: [
            "arrivalDateTime",
            "deleted",
            "startPoint",
            "startPointName",
            "endPoint",
            "endPointName",
            "owner",
            "radius",
            "reusable",
            "length",
            "name",
            "id",
        ],
    },
    InexperiencedRouteGetResult: {
        description: "An array of inexperienced routes belonging to this user",
        items: {
            $ref: "#/definitions/InexperiencedRouteData",
        },
        type: "array",
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
    let onlyreusable = true;
    if (params.onlyreusable && params.onlyreusable.length > 0) {
        onlyreusable = params.onlyreusable[0].toLowerCase() === "true";
    }
    let includedeleted = false;
    if (params.includedeleted && params.includedeleted.length > 0) {
        includedeleted = params.includedeleted[0].toLowerCase() === "true";
    }
    let transactionClient;
    let results;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return getIdFromJWT(params.authorization, transactionClient);
    }).then((userId) => {
        return Database.getInexperiencedRoutes({userId, id, includedeleted, onlyreusable}, transactionClient);
    }).then(theResults => {
        results = theResults;
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
export const getInexperiencedRoutes = new MicroserviceEndpoint("getInexperiencedRoutes")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
