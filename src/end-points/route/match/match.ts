import { getIdFromJWT } from "../../../common/auth";
import { matchRoutes } from "../../../common/database";
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
        parameters: [
            {
                description: "The start and end points of the route to match",
                in: "body",
                name: "startEnd",
                required: true,
                schema: {
                    $ref: "#/definitions/StartEndPoints",
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
        summary: "Find routes that pass through 2 points",
        tags: [
            "Routes",
        ],
    },
};

// DEFINITIONS

const definitions = {
    GetRoutesResponse: {
        properties: {
            result: {
                $ref: "#/definitions/RouteSearchResult",
            },
        },
        required: ["result"],
    },
    RouteSearchData: {
        description: "Information about a matching route",
        properties: {
            distanceFromDivorcePoint: {
                description: "How far in meters the user will have to cycle from the divorce point to their " +
                "destination",
                type: "integer",
            },
            distanceToMeetingPoint: {
                description: "How far in meters the user will have to cycle from their starting point to the " +
                "meeting point",
                type: "integer",
            },
            divorcePoint: {
                description: "The closest point for the user to leave the owner's route to get to their endpoint",
                items: {
                    description: "The latitude or longitude",
                    type: "integer",
                },
                type: "array",
            },
            divorceTime: {
                description: "The expected date and time in ISO 8601 extended format that the route owner will " +
                "reach the divorcePoint",
                example: new Date().toISOString(),
                type: "string",
            },
            id: {
                description: "This route's internal id",
                type: "integer",
            },
            meetingPoint: {
                description: "The closest point for the user to meet the owner on their route from their startpoint",
                items: {
                    description: "The latitude or longitude",
                    type: "integer",
                },
                type: "array",
            },
            meetingTime: {
                description: "The expected time in ISO 8601 extended format that the route owner will " +
                "reach the meetingPoint",
                example: new Date().toISOString(),
                type: "string",
            },
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            timeFromDivorcePoint : {
                description: "A time interval in ISO 8601 format that it is " +
                "estimated to take the user to cycle from the divorce point " +
                "to their destination",
                example: "PT1H5M30S",
                type: "string",
            },
            timeToMeetingPoint : {
                description: "A time interval in ISO 8601 format that it is " +
                "estimated to take the user to cycle from their start point " +
                "to the meeting point. ",
                example: "PT1H5M30S",
                type: "string",
            },
        },
        required: ["meetingPoint", "divorcePoint", "meetingTime", "owner", "days", "id"],
    },
    RouteSearchResult: {
        description: "A list of Routes that were found near the given point",
        items: {
            $ref: "#/definitions/RouteSearchData",
        },
        type: "array",
    },
    StartEndPoints: {
        properties: {
            endPoint: {
                $ref: "#/definitions/Coordinate",
            },
            radius: {
                description: "How far the user is willing to travel alone to get to/from the meeting point and " +
                "divorce point",
                example: 500,
                type: "integer",
            },
            startPoint: {
                $ref: "#/definitions/Coordinate",
            },
            time: {
                description: "The date and time (in ISO 8601 extended format), the user wants reach their destination",
                example: new Date().toISOString(),
                type: "string",
            },
        },
        required: ["start", "end", "radius", "time"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorization).then(() => {
        return matchRoutes(payload);
    }, err => {
        throw err;
    });
};

// end point definition
export const matchRoute = new MicroserviceEndpoint("matchRoute")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
