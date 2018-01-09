import ExperiencedRoute from "../../common/ExperiencedRouteDataModel";
import * as FirebaseUtils from "../../common/firebaseUtils";
import InexperiencedRoute from "../../common/InexperiencedRouteDataModel";
import * as chai from "chai";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as moment from "moment";
import * as rp from "request-promise-native";
import * as logger from "winston";

const expect = chai.expect;
const assert = chai.assert;
const before = mocha.before;
const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;

const url = (process.env.URL || "http://localhost:8080") + "/api/v0";

// A default request wrapper, to make our lives easier
// since we only change some things in our requests
const defaultRequest = (options): Promise<any> => {
    // Pack in some defaults
    _.defaults(options,
        {
            headers: {
                Origin: "https://www.example.com",
            },
            json: true,
            resolveWithFullResponse: true,
            simple: false,
        });
    return rp(options);
};

describe("InexperiencedRoute endpoint", () => {
    let userIds = [];   // A list of users created
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    let routeIds = [];  // A list of routes created that will be deleted at the end of this test run
    let inexperiencedRouteIds = [];   // A list of Inexperienced Route IDs that will be deleted at the end of this run
    before(() => {
        const user1 = {
            email: "inexperiencedRouteTest@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "E2E Test",
            surname: "User 3",
        };
        const user2 = {
            email: "inexperiencedRouteTest2@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "E2E Test",
            surname: "User 4",
        };
        return FirebaseUtils.createFirebaseUser(user1.email)
        .then(createResponse => {
            userIds.push(createResponse.user.uid);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            userJwts.push(jwt);
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + jwt,
                },
                json: user1,
                method: "PUT",
                url: url + "/user",
            });
        }).then(() => {
            return FirebaseUtils.createFirebaseUser(user2.email);
        }).then(createResponse => {
            userIds.push(createResponse.user.uid);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            userJwts.push(jwt);
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + jwt,
                },
                json: user2,
                method: "PUT",
                url: url + "/user",
            });
        });
    });
    after("Delete test users from Firebase", () => {
        return FirebaseUtils.deleteFirebaseUsers(userIds);
    });
    describe("Creation", () => {
        it("should create inexperienced routes", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body is " +
                    JSON.stringify(response.body));
                expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                    "Expected object, but got a " + typeof response.body);
                expect(parseInt(response.body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                    "Full response body is: " + JSON.stringify(response.body));
                inexperiencedRouteIds.push(parseInt(response.body.result.id, 10));
            });
        });
        it("should create inexperienced routes that are not reusable", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: false,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body is " +
                    JSON.stringify(response.body));
                expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                    "Expected object, but got a " + typeof response.body);
                expect(parseInt(response.body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                    "Full response body is: " + JSON.stringify(response.body));
                inexperiencedRouteIds.push(parseInt(response.body.result.id, 10));
            });
        });
        it("should not create inexperienced route with invalid auth", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase foobar",
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should not create inexperienced route with no auth", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {},
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should not create inexperienced route with invalid radius", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: -500,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Radius must be positive");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not create inexperienced route with invalid startPoint (3D)", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute requires a 2D start point");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not create inexperienced route with invalid startPoint (1D)", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute requires a 2D start point");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not create inexperienced route with invalid endPoint (3D)", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute requires a 2D end point");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not create inexperienced route with invalid endPoint (1D)", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute requires a 2D end point");
                expect(response.body.status).to.equal(400);
            });
        });
    });
    describe("Retrieval", () => {
        before("Set up one more inexperienced route", () => {
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body is " +
                    JSON.stringify(response.body));
                inexperiencedRouteIds.push(response.body.result.id);
            });
        });
        it("should get all inexperienced routes if no id is given", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.length).to.equal(2);
                expect(response.body.result[0].owner).to.equal(userIds[0],
                    "Route belongs to another user. Expected owner to be " +
                    userIds[0] + ", but it was " + response.body.result.owner +
                    ". Full response body is: " + JSON.stringify(response.body));
            });
        });
        it("should only get non-deleted reusable inexperienced routes if includedeleted is set to false", () => {
            return defaultRequest({
                headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "DELETE",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[2],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                inexperiencedRouteIds.pop();
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?includedeleted=false",
                });
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.length).to.equal(1);
                expect(response.body.result[0].deleted).to.be.false;
            });
        });
        it("should get all reusable inexperienced routes if includedeleted is set to true", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/inexperiencedRoute?includedeleted=true",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.length).to.equal(2);
                expect(response.body.result[0].deleted).to.be.true;
            });
        });
        it("should get an inexperiencedRoute by a valid id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.length).to.equal(1);
                expect(response.body.result[0].owner).to.equal(userIds[0],
                    "Inexperienced route belongs to another user." +
                    "Expected owner to be " + userIds[0] + ", but it was " + response.body.result.owner +
                    ". Full response body is: " + JSON.stringify(response.body));
            });
        });
        it("should not get an inexperienced route by an invalid id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/inexperiencedRoute?id=-1",
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute does not exist or is a deleted route");
                expect(response.body.status).to.equal(404);
            });
        });
        it("should not get an inexperienced route with no auth", () => {
            return defaultRequest({
                headers: {},
                method: "GET",
                url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
    });
    describe("Querying against Routes", () => {
        let routeId;
        let nonMatchedRouteId;
        let shouldMatchId;
        let shouldMatchTuesdayId;
        let shouldMatchSundayId;
        let shouldNotMatchId;
        before("set up experienced routes and inexperienced routes that do and don't match it", () => {
            // Set up a long straight route that is easy to reason about
            // Then set up three inexperienced routes on different dates that should match this route,
            // and one that shouldn't
            const route = new ExperiencedRoute({
                arrivalTime: "13:15:00+00",
                days: ["tuesday", "friday", "saturday", "sunday"],
                departureTime: "12:15:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                owner: userIds[0],
                route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                startPointName: "112 Stanley Street",
            });
            const matchingInexperiencedRoute = {
                arrivalDateTime: "2017-06-02T12:00:00+00", // On Friday
                endPoint: [0, 4.8],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [0, 1.3],
                startPointName: "33 Stanley Street",
            };
            const matchingTuesdayInexperiencedRoute = {
                arrivalDateTime: "2017-09-26T12:00:00+00",
                endPoint: [0, 4.8],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [0, 1.3],
                startPointName: "33 Stanley Street",
            };
            const matchingSundayInexperiencedRoute = {
                arrivalDateTime: "2017-10-01T12:00:00+00",
                endPoint: [0, 4.8],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [0, 1.3],
                startPointName: "33 Stanley Street",
            };
            const nonMatchingInexperiencedRoute = {
                arrivalDateTime: "2017-06-02T12:00:00+00",
                endPoint: [0, 1.5],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [0, 10],
                startPointName: "33 Stanley Street",
            };
            // Set up another long straight route specifically for test user 4 to test against
            const nonMatchedRoute = new ExperiencedRoute({
                arrivalTime: "13:15:00+00",
                days: ["tuesday", "friday", "saturday", "sunday"],
                departureTime: "12:15:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                owner: userIds[1],
                route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                startPointName: "112 Stanley Street",
            });
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the route to test route matching");
                    throw response.error || response.body;
                } else {
                    routeIds.push(response.body.result.id);
                    routeId = response.body.result.id;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[1],
                        },
                        json: nonMatchedRoute,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    });
                }
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the route to test route matching");
                    throw response.error || response.body;
                } else {
                    routeIds.push(response.body.result.id);
                    nonMatchedRouteId = response.body.result.id;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[1],
                        },
                        json: matchingInexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    });
                }
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the (matching) inexperienced route to " +
                        "test route matching");
                    throw response.error || response.body;
                } else {
                    shouldMatchId = response.body.result.id;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[1],
                        },
                        json: matchingTuesdayInexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    });
                }
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the (matching) Tuesday inexperienced route to " +
                        "test route matching");
                    throw response.error || response.body;
                } else {
                    shouldMatchTuesdayId = response.body.result.id;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[1],
                        },
                        json: matchingSundayInexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    });
                }
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the (matching) Sunday inexperienced route to " +
                        "test route matching");
                    throw response.error || response.body;
                } else {
                    shouldMatchSundayId = response.body.result.id;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[1],
                        },
                        json: nonMatchingInexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    });
                }
            }).then(response => {
                if (response.statusCode !== 201) {
                    logger.error("Error while setting up the (non-matching) " +
                        "inexperienced route to test route matching");
                    throw response.error || response.body;
                } else {
                    shouldNotMatchId = response.body.result.id;
                }
            });
        });
        it("should match with a matching inexperienced route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const thisRoute = response.body.result.filter((route) => {
                    return route.id === routeId;
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should match with a matching inexperienced route on the next day", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchId,
                    newArrivalDateTime: "2017-06-03T12:00:00+00", // On Saturday
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const thisRoute = response.body.result.filter((route) => {
                    return route.id === routeId;
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should match with a matching inexperienced route on Tuesday", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchTuesdayId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const thisRoute = response.body.result.filter((route) => {
                    return route.id === routeId;
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should match with a matching inexperienced route on Sunday", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchSundayId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const thisRoute = response.body.result.filter((route) => {
                    return route.id === routeId;
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should not return sensitive information for the matching inexperienced route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.body.result[0].pwh).to.equal(undefined, "Pwh should not be included");
                expect(response.body.result[0].salt).to.equal(undefined, "Salt should not be included");
                expect(response.body.result[0].rounds).to.equal(undefined, "Rounds should not be included");
                expect(response.body.result[0].jwtSecret).to.equal(undefined, "jwtSecret should not be included");
            });
        });
        it("should give an empty list with a non matching inexperienced route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldNotMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const routes = response.body.result.filter((route) => {
                    return route.id === routeId;
                });
                expect(routes.length).to.equal(0, "Route was matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should not match an experienced route if it was deleted", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/experiencedRoute?id=" + routeIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[1],
                    },
                    json: {
                        id: shouldMatchId,
                    },
                    method: "POST",
                    url: url + "/inexperiencedRoute/query",
                });
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const routes = response.body.result.filter((route) => {
                    return route.id === routeId;
                });
                expect(routes.length).to.equal(0, "Route was matched. Results were " +
                    JSON.stringify(response.body.result));
            });
        });
        it("should not match an experienced route if it is owned by that user", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: shouldMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                    "results, body is: " + JSON.stringify(response.body));
                const nonMatchedRoute = response.body.result.filter((route) => {
                    return route.id === nonMatchedRouteId;
                })[0];
                expect(nonMatchedRoute).to.equal(undefined,
                    "Got route when we shouldn't: " + JSON.stringify(nonMatchedRoute));
            });
        });
        it("should err with no auth", () => {
            return defaultRequest({
                headers: {},
                json: {
                    id: shouldMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should err with someone elses inexperienced route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: {
                    id: shouldMatchId,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute does not exist or is a deleted route");
                expect(response.body.status).to.equal(404);
            });
        });
        it("should err with no id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: {
                    id: null,
                },
                method: "POST",
                url: url + "/inexperiencedRoute/query",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid ID");
                expect(response.body.status).to.equal(400);
            });
        });
    });
    describe("Updating", () => {
        it("should handle an empty update", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
            });
        });
        it("should update all properties at once", () => {
            const updates = {
                arrivalDateTime: "2000-01-01T13:30:00+00",
                id: inexperiencedRouteIds[0],
                name: "Ride to the cinema",
                notifyOwner: true,
                radius: 1500,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(
                    moment(inexperiencedRoute.arrivalDateTime).isSame(updates.arrivalDateTime)
                ).to.be.true;
                expect(inexperiencedRoute.notifyOwner).to.equal(updates.notifyOwner);
                expect(inexperiencedRoute.radius).to.equal(updates.radius);
                expect(inexperiencedRoute.name).to.eql(updates.name);
            });
        });
        it("should update one property at a time - arrivalDateTime", () => {
            const updates = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                id: inexperiencedRouteIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(
                    moment(inexperiencedRoute.arrivalDateTime).isSame(updates.arrivalDateTime)
                ).to.be.true;
            });
        });
        it("should update one property at a time - radius", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                radius: 1000,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.radius).to.equal(updates.radius);
            });
        });
        it("should update one property at a time - notifyOwner", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                notifyOwner: false,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.notifyOwner).to.equal(updates.notifyOwner);
            });
        });
        it("should update one property at a time - name", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                name: "Ride to the park",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.name).to.equal(updates.name);
            });
        });
        it("should not update owner", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                owner: -10,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.owner).not.to.equal(updates.owner);
            });
        });
        it("should not update startPoint", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                startPoint: [22, 22],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.startPoint).not.to.eql(updates.startPoint);
            });
        });
        it("should not update endPoint", () => {
            const updates = {
                endPoint: [0.5, 0.5],
                id: inexperiencedRouteIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.endPoint).not.to.equal(updates.endPoint);
            });
        });
        it("should not update startPointName", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                startPointName: "Silly Name",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.startPointName).not.to.eql(updates.startPointName);
            });
        });
        it("should not update endPointName", () => {
            const updates = {
                endPointName: "Outrageous Name",
                id: inexperiencedRouteIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.endPointName).not.to.equal(updates.endPointName);
            });
        });
        it("should not update with bad auth", () => {
            const updates = {
                arrivalDateTime: "2000-01-01T13:30:00+00",
                endPoint: [14, 14],
                id: inexperiencedRouteIds[0],
                notifyOwner: true,
                radius: 1500,
                startPoint: [11, 11],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[2],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                });
            }).then(response => {
                let inexperiencedRoute;
                expect(response.body.result.length).to.equal(1);
                try {
                    inexperiencedRoute = new InexperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                    err);
                }
                expect(inexperiencedRoute.arrivalDateTime).not.to.equal(updates.arrivalDateTime);
                expect(inexperiencedRoute.endPoint).not.to.eql(updates.endPoint);
                expect(inexperiencedRoute.notifyOwner).not.to.equal(updates.notifyOwner);
                expect(inexperiencedRoute.radius).not.to.equal(updates.radius);
                expect(inexperiencedRoute.startPoint).not.to.eql(updates.startPoint);
            });
        });
        it("should not update with invalid radius", () => {
            const updates = {
                id: inexperiencedRouteIds[0],
                radius: -1500,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.error).to.equal("Radius must be positive");
                expect(response.body.status).to.equal(400);
            });
        });
    });
    describe("Deleting", () => {
        before(() => {
            // Make another new inexperienced route (inexperiencedRouteIds[2])
            const inexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [10, 10],
                startPointName: "33 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: inexperiencedRoute,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            }).then(response => {
                inexperiencedRouteIds.push(parseInt(response.body.result.id, 10));
            });
        });
        it("should not delete an inexperienced route with an invalid id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/inexperiencedRoute?id=" + -1,
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute does not exist or is a deleted route");
                expect(response.body.status).to.equal(404);
            });
        });
        it("should not delete an inexperienced route with no auth", () => {
            return defaultRequest({
                method: "DELETE",
                url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[1],
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should not be able to delete another user's inexperienced route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                method: "DELETE",
                url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("InexperiencedRoute does not exist or is a deleted route");
                expect(response.body.status).to.equal(404);
            });
        });
        it("should delete an inexperienced route by setting the deleted status to be true", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0] + "&includedeleted=true",
                });
            }).then(response => {
                expect(response.body.result[0].deleted).to.equal(true, "Expected deleted object to be true but got " +
                response.body.result[0].deleted + ", body returned is: " + JSON.stringify(response.body) +
                ". This means the route was not deleted");
            });
        });
        it("should delete a user's inexperienced routes when that user is deleted", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/user?id=" + userIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[2],
                });
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                ". This means the inexperiencedRoute was not deleted");
            });
        });
    });
});
