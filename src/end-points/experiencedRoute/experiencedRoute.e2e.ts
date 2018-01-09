import ExperiencedRoute from "../../common/ExperiencedRouteDataModel";
import * as FirebaseUtils from "../../common/firebaseUtils";
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

describe("ExperiencedRoute endpoint", () => {
    let userIds = [];   // A list of users created
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    let routeIds = [];  // A list of routes created
    before(() => {
        const user1 = {
            email: "experiencedRouteTest@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "E2E Test",
            surname: "User 3",
        };
        const user2 = {
            email: "experiencedRouteTest2@e2e-test.matchmyroute-backend.appspot.com",
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
        it("should create experienced routes", () => {
            const route = {
                arrivalTime: "13:00:00+00",
                days: ["monday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body is " + response.body);
                expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                    "Expected object, but got a " + typeof response.body);
                expect(parseInt(response.body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                    "Full response body is: " + JSON.stringify(response.body));
                routeIds.push(response.body.result.id);
            });
        });
        it("should create experienced routes without a name", () => {
            const route = {
                arrivalTime: "13:00:00+00",
                days: ["monday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body is " + response.body);
                expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                    "Expected object, but got a " + typeof response.body);
                expect(parseInt(response.body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                    "Full response body is: " + JSON.stringify(response.body));
                routeIds.push(response.body.result.id);
            });
        });
        it("should not create experienced routes when the auth is invalid", () => {
            const route = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "friday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[3],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should not create experienced routes when the arrival is before the departure", () => {
            const route = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "friday", "sunday"],
                departureTime: "14:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Arrival time is before Departure time");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not create experienced routes when the auth missing", () => {
            const route = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "friday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
    });
    describe("Getting", () => {
        describe("By ID", () => {
            it("should get all experienced routes if no id is given", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute",
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
            it("should get an experienced route by a valid id", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    expect(response.body.result.length).to.equal(1);
                    expect(response.body.result[0].owner).to.equal(userIds[0],
                        "Route belongs to another user. Expected owner to be " +
                        userIds[0] + ", but it was " + response.body.result.owner +
                        ". Full response body is: " + JSON.stringify(response.body));
                });
            });
            it("should not get an experienced route by an invalid id", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + -1,
                }).then(response => {
                    expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                        response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                    expect(response.body.error).to.equal("ExperiencedRoute does not exist or is a deleted route");
                    expect(response.body.status).to.equal(404);
                });
            });
        });
        describe("By includedeleted", () => {
            it("should only get non-deleted experienced routes if includedeleted is set to false", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "DELETE",
                    url: url + "/experiencedRoute?id=" + routeIds[1],
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    routeIds.pop();
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/experiencedRoute?includedeleted=false",
                    });
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    expect(response.body.result.length).to.equal(1);
                    expect(response.body.result[0].deleted).to.be.false;
                });
            });
            it("should get all experienced routes if includedeleted is set to true", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?includedeleted=true",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    expect(response.body.result.length).to.equal(2);
                    expect(response.body.result[0].deleted).to.be.true;
                });
            });
        });
        /* tslint:disable no-empty */
        describe("By Nearby", () => {
            it("Skipping this because it might soon be depreciated", () => { });
        });
        /* tslint:enable no-empty */
        describe("By Matching", () => {
            before(() => {
                // Set up a long straight route that is easy to reason about
                const route = new ExperiencedRoute({
                    arrivalTime: "13:15:00+00",
                    days: ["tuesday", "friday", "sunday"],
                    departureTime: "12:15:00+00",
                    endPointName: "33 Rachel Road",
                    length: 5000,
                    name: "Ride to work",
                    owner: userIds[0],
                    route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                    startPointName: "122 Stanley Street",
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
                        logger.error("Error while setting up the experienced route to test route matching");
                        throw response.error || response.body;
                    } else {
                        routeIds.push(response.body.result.id); // Should be routeIds[1]
                    }
                });
            });
            it("should match an experienced route", () => {
                const matchParams = {
                    arrivalDateTime: "2017-09-08T13:20:00+00",
                    endPoint: [0, 4.6],
                    radius: 500,
                    startPoint: [0, 1.4],
                };
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    json: matchParams,
                    method: "POST",
                    url: url + "/experiencedRoutes/match",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    expect(response.body.result instanceof Array).to.equal(true,
                        "body.result is not a list of " + "results, body is: " +
                        JSON.stringify(response.body));
                    const thisRoute = response.body.result.filter((route) => {
                        return route.id === routeIds[1];
                    })[0];
                    expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                        JSON.stringify(response.body.result));
                    expect(thisRoute, "Route does not have owner").to.have.property("owner");
                    expect(thisRoute.owner, "Owner does not have id").to.have.property("id");
                    expect(thisRoute.owner.id).to.equal(userIds[0], "Owner is not who was expected");
                    // Should be the intersection between the route days and the search days
                    expect(moment("2017-09-08T12:15:00+00").isBefore(thisRoute.meetingTime)).to.equal(true,
                        "meetingTime is before the route's start time (12:15:00+00). Got " +
                        thisRoute.meetingTime);
                    expect(moment("2017-09-08T13:15:00+00").isAfter(thisRoute.meetingTime)).to.equal(true,
                        "meetingTime is after the route's end time (13:15:00+00). Got " +
                        thisRoute.meetingTime);
                    expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                    expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
                    expect(thisRoute.name).to.equal("Ride to work");
                    expect(thisRoute.route).to.eql([[0, 1.4], [0, 2], [0, 3], [0, 4], [0, 4.6]]);
                    expect(thisRoute.length).to.equal(353848);
                    expect(thisRoute.averageSpeed).to.equal(184.3);
                });
            });
            it("should not match an experienced route in the wrong direction", () => {
                const matchParams = {
                    arrivalDateTime: "2017-09-08T13:20:00+00",
                    endPoint: [0, 1.4],
                    radius: 500,
                    startPoint: [4.6, 0],
                };
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    json: matchParams,
                    method: "POST",
                    url: url + "/experiencedRoutes/match",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    if (typeof response.body === "string") {
                        response.body = JSON.parse(response.body);
                    }
                    expect(response.body.result instanceof Array).to.equal(true,
                        "body.result is not a list of " + "results, body is: " +
                        JSON.stringify(response.body));
                    const thisRoute = response.body.result.filter((route) => {
                        return route.id === routeIds[1];
                    })[0];
                    expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                        JSON.stringify(response.body.result));
                });
            });
            it("should not match an experienced route when non-matching days are given", () => {
                const matchParams = {
                    arrivalDateTime: "2017-09-09T13:20:00+00",
                    endPoint: [0, 4.6],
                    radius: 500,
                    startPoint: [0, 1.4],
                };
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    json: matchParams,
                    method: "POST",
                    url: url + "/experiencedRoutes/match",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                    expect(response.body.result instanceof Array).to.equal(true,
                        "body.result is not a list of " + "results, body is: " +
                        JSON.stringify(response.body));
                    const thisRoute = response.body.result.filter((route) => {
                        return route.id === routeIds[1];
                    })[0];
                    expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                        JSON.stringify(response.body.result));
                });
            });
        });
    });
    describe("Updating", () => {
        it("should update all properties at once", () => {
            const updates = {
                arrivalTime: "14:00:00+00",
                days: ["tuesday"],
                departureTime: "13:00:00+00",
                id: routeIds[0],
                name: "Ride home",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                expect(response.body.result.length).to.equal(1);
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.days).to.eql(["tuesday"]);
                expect(route.arrivalTime).to.equal("14:00:00+00");
                expect(route.departureTime).to.equal("13:00:00+00");
                expect(route.name).to.equal(updates.name);
            });
        });
        it("should update one property at a time - arrivalTime", () => {
            const updates = {
                arrivalTime: "15:00:00+00",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.days).to.eql(["tuesday"]);
                expect(route.arrivalTime).to.equal("15:00:00+00");
                expect(route.departureTime).to.equal("13:00:00+00");
            });
        });
        it("should update one property at a time - departureTime", () => {
            const updates = {
                departureTime: "14:00:00+00",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.days).to.eql(["tuesday"]);
                expect(route.arrivalTime).to.equal("15:00:00+00");
                expect(route.departureTime).to.equal("14:00:00+00");
            });
        });
        it("should update one property at a time - name", () => {
            const updates = {
                id: routeIds[0],
                name: "Ride to work",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.name).to.equal(updates.name);
            });
        });
        it("should update one property at a time - days", () => {
            const updates = {
                days: ["monday", "sunday"],
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.days).to.eql(["monday", "sunday"]);
                expect(route.arrivalTime).to.equal("15:00:00+00");
                expect(route.departureTime).to.equal("14:00:00+00");
            });
        });
        it("should not be able to update ownership", () => {
            const updates = {
                id: routeIds[0],
                owner: userIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.owner).to.equal(userIds[0]);
            });
        });
        it("should not be able to update route", () => {
            const updates = {
                id: routeIds[0],
                route: [[5, 5], [7, 7]],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                    err);
                }
                expect(route.route).not.to.eql(updates.route);
            });
        });
        it("should not be able to update startPointName", () => {
            const updates = {
                id: routeIds[0],
                startPointName: "Flappy wappy doodah",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.startPointName).not.to.equal(updates.startPointName);
            });
        });
        it("should not be able to update endPointName", () => {
            const updates = {
                endPointName: "Flappy wappy doodah",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.endPointName).not.to.equal(updates.endPointName);
            });
        });
        it("should not be able to update length", () => {
            const updates = {
                id: routeIds[0],
                length: 2000,
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0],
                });
            }).then(response => {
                let route;
                try {
                    route = new ExperiencedRoute(response.body.result[0]);
                } catch (err) {
                    assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                        err);
                }
                expect(route.length).not.to.equal(updates.length);
            });
        });
        it("should not allow updating to invalid departureTime", () => {
            const updates = {
                departureTime: "18:00:00+00",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Arrival time is before Departure time");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not allow updating to invalid arrivalTime", () => {
            const updates = {
                arrivalTime: "10:00:00+00",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Arrival time is before Departure time");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not allow updating to invalid arrivalTime + departureTime", () => {
            const updates = {
                arrivalTime: "05:00:00+00",
                departureTime: "07:00:00+00",
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Arrival time is before Departure time");
                expect(response.body.status).to.equal(400);
            });
        });
        it("should not allow updating another user's route", () => {
            const updates = {
                days: ["friday"],
                id: routeIds[0],
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: updates,
                method: "POST",
                url: url + "/experiencedRoute",
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
    });
    describe("Deletion", () => {
        before(() => {
            // Set up another route belonging to userIds[1]
            const route = new ExperiencedRoute({
                arrivalTime: "14:00:00+00",
                departureTime: "13:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                owner: userIds[1],
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "112 Stanley Street",
            });
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: route,
                method: "PUT",
                url: url + "/experiencedRoute",
            }).then(response => {
                routeIds.push(parseInt(response.body.result.id, 10));
            });
        });
        it("should not delete an experienced route with an invalid id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/experiencedRoute?id=" + -1,
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("ExperiencedRoute doesn't exist");
                expect(response.body.status).to.equal(404);
            });
        });
        it("should not delete an experienced route with no auth", () => {
            return defaultRequest({
                method: "DELETE",
                url: url + "/experiencedRoute?id=" + routeIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should not be able to delete another user's route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                method: "DELETE",
                url: url + "/experiencedRoute?id=" + routeIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Invalid authorization");
                expect(response.body.status).to.equal(403);
            });
        });
        it("should delete an experienced route by setting the deleted status to be true", () => {
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
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[0] + "&includedeleted=true",
                });
            }).then(response => {
                expect(response.body.result[0].deleted).to.equal(true, "Expected deleted object to be true but got " +
                    response.body.result[0].deleted + ", body returned is: " + JSON.stringify(response.body) +
                    ". This means the route was not deleted");
            });
        });
        it("should delete any routes belonging to a user, when a user is deleted", () => {
            // Should delete routeIds[2], which we setup in beforeAll
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                method: "DELETE",
                url: url + "/user?id=" + userIds[1],
            }).then(deleteResponse => {
                expect(deleteResponse.statusCode).to.equal(200, "Expected 200 response but got " +
                    deleteResponse.statusCode + ", error given is: " + deleteResponse.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[1],
                    },
                    method: "GET",
                    url: url + "/experiencedRoute?id=" + routeIds[2],
                });
            }).then(response => {
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                ". This means the routes that belonged to the user were not deleted");
            });
        });
    });
});
