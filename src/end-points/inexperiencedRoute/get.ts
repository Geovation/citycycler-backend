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
            endPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will finish cycling. Must be within <radius> of " +
                "an experienced route to be considered a match",
            },
            id: {
                description: "This inexperienced route's internal id",
                type: "integer",
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
            startPoint: {
                $ref: "#/definitions/Coordinate",
                description: "Where the user will start cycling from. Must be within <radius> of " +
                "an experienced route to be considered a match",
            },
        },
        required: ["arrivalDateTime", "departureTime", "startPoint", "endPoint", "owner", "radius", "route", "id"],
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
    return getIdFromJWT(params.authorization).then((userId) => {
        return Database.getInexperiencedRoutes({userId, id});
    });
};

// end point definition
export const getInexperiencedRoutes = new MicroserviceEndpoint("getInexperiencedRoutes")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
