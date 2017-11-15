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
                description: "The route ID (if empty, all routes of the user will be returned)",
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
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "Route was retrieved",
                schema: {
                    $ref: "#/definitions/GetRouteResponse",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "Route doesn't exist",
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
        summary: "Retrieve an experienced route by it's ID. If no ID is provided, all routes " +
        "of the user are returned",
        tags: [
            "ExperiencedRoutes",
        ],
    },
};

const definitions = {
    GetRouteResponse: {
        properties: {
            result: {
                $ref: "#/definitions/RouteGetResult",
            },
        },
        required: ["result"],
    },
    RouteData: {
        properties: {
            arrivalTime: {
                description: "The time in ISO 8601 extended format that the owner will arrive at their destination",
                example: "12:22:00Z",
                type: "string",
            },
            days: {
                description: "Which days of the week the owner cycles this route",
                example: ["monday", "wednesday", "friday"],
                items: {
                    description: "A day of the week",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
            deleted: {
                description: "The deleted status of this route",
                example: "false",
                type: "boolean",
            },
            departureTime: {
                description: "The time in ISO 8601 extended format that the owner will start their route",
                example: "12:22:00Z",
                type: "string",
            },
            endPointName: {
                description: "The english name of where this route ends",
                example: "23 Richard Road",
                type: "string",
            },
            id: {
                description: "This route's internal id",
                type: "integer",
            },
            length: {
                description: "This route's length in meters",
                example: 5000,
                type: "integer",
            },
            name: {
                description: "The name of this route",
                example: "Ride to work",
                type: "string",
            },
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            route: {
                $ref: "#/definitions/CoordList",
            },
            startPointName: {
                description: "The english name of where this route starts",
                example: "32 Liam Lane",
                type: "string",
            },
        },
        required: [
            "arrivalTime",
            "deleted",
            "departureTime",
            "endPointName",
            "length",
            "owner",
            "route",
            "id",
            "startPointName",
            "name",
        ],
    },
    RouteGetResult: {
        description: "An array of routes belonging to this user",
        items: {
            $ref: "#/definitions/RouteData",
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
    let includedeleted = false;
    if (params.includedeleted && params.includedeleted.length > 0) {
        includedeleted = params.includedeleted[0].toLowerCase() === "true";
    }
    return getIdFromJWT(params.authorization).then((userId) => {
        return Database.getExperiencedRoutes({userId, id, includedeleted});
    });
};

// end point definition
export const getExperiencedRoutes = new MicroserviceEndpoint("getExperiencedRouteById")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
