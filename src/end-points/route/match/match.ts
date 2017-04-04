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
                description: "An invalid authorisation token was supplied",
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
    PointWithRadius: {
        properties: {
            latitude: {
                description: "The latitude of this point",
                type: "integer",
            },
            longitude: {
                description: "The longitude of this point",
                type: "integer",
            },
            radius: {
                description: "The radius in which to search around this point, in meters",
                type: "integer",
            },
        },
        required: ["latitude", "longitude", "radius"],
    },
    RouteSearchData: {
        description: "Information about a matching route",
        properties: {
            days: {
                description: "Which days of the week the owner cycles this route, that the user can also cycle on",
                example: ["monday", "wednesday", "friday"],
                items: {
                    description: "A day of the week",
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
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
                description: "The time in seconds past midnight that the route owner will reach the divorcePoint",
                type: "integer",
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
                description: "The time in seconds past midnight that the route owner will reach the meetingPoint",
                type: "integer",
            },
            owner: {
                description: "The userId of the user who owns this route",
                type: "integer",
            },
            timeFromDivorcePoint : {
                description: "How long in seconds it is estimated to take the user to cycle from the divorce point " +
                "to their destination",
                type: "integer",
            },
            timeToMeetingPoint : {
                description: "How long in seconds it is estimated to take the user to cycle from their start point " +
                "to the meeting point",
                type: "integer",
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
            days: {
                description: "Which days of the week the user wants to cycle this route. " +
                "If unset, it will default to any day",
                example: ["monday", "wednesday", "friday"],
                items: {
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    type: "string",
                },
                type: "array",
            },
            end: {
                $ref: "#/definitions/PointWithRadius",
            },
            start: {
                $ref: "#/definitions/PointWithRadius",
            },
            time: {
                description: "What time (in seconds past midnight), the user wants reach their destination",
                type: "integer",
            },
        },
        required: ["start", "end"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    return getIdFromJWT(params.authorisation).then(() => {
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
