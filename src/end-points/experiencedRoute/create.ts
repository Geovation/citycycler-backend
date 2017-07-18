import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import ExperiencedRoute from "../../common/ExperiencedRouteDataModel";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    put: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The route and metadata about it",
                in: "body",
                name: "route",
                required: true,
                schema: {
                    $ref: "#/definitions/NewRouteData",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
                description: "New route was created",
                schema: {
                    $ref: "#/definitions/CreateRouteResponse",
                },
            },
            400: {
                description: "An invalid route object was supplied, see the error message for an explanation",
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
        summary: "Create a new route",
        tags: [
            "ExperiencedRoutes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CoordList: {
        description: "A list of [lat,long] coordinates that make up the route",
        example: [[0, 0], [1, 1]],
        items: {
            items: {
                $ref: "#/definitions/Coordinate",
            },
            minItems: 2,
            type: "array",
        },
        type: "array",
    },
    Coordinate: {
        items: {
            maxLength: 2,
            minLength: 2,
            type: "integer",
        },
        type: "array",
    },
    CreateRouteResponse: {
        description: "The Route's ID",
        properties: {
            result: {
                properties: {
                    id: {
                        format: "int32",
                        type: "number",
                    },
                },
                required: ["id"],
            },
        },
        required: ["result"],
    },
    NewRouteData: {
        properties: {
            arrivalTime: {
                description: "The time in ISO 8601 extended format that the owner arrives at their destination",
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
            length: {
                description: "How long this route is in meters",
                example: 5000,
                type: "integer",
            },
            name: {
                description: "A name for this route. Defaults to 'startPointName to endPointName'.",
                example: "Ride to work",
                type: "string",
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
        required: ["arrivalTime", "departureTime", "days", "endPointName", "length", "route", "startPointName"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    return getIdFromJWT(params.authorization).then(owner => {
        params.body.owner = owner;
        let route = new ExperiencedRoute(params.body);
        return Database.putExperiencedRoute(route);
    }).then(routeId => {
        return { id: routeId, status: 201 };
    });
};

// end point definition
export const createExperiencedRoute = new MicroserviceEndpoint("createExperiencedRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
