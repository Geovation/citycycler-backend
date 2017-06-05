import { getIdFromJWT } from "../../common/auth";
import { createInexperiencedRoute as createQuery } from "../../common/database";
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
        description: "This endpoint stores an object that can be used to find matching routes - in effect a " +
        "query object. To search for routes created by this endpoint, make a request to inexperiencedRoute/query?{ID}",
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
        summary: "Save a inexperienced route",
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
                example:  [ 0, 0] ,
            },
        },
        required: ["arrivalDateTime", "radius", "startPoint", "endPoint", "notifyOwner"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorization).then(userId => {
        return createQuery(userId, payload).then(id => {
            return { id, status: 201 };
        });
    }, err => {
        throw err;
    });
};

// end point definition
export const createInexperiencedRoute = new MicroserviceEndpoint("createInexperiencedRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
