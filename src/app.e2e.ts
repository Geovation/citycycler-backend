/* tslint:disable */
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as EventEmitter from "events";
import * as request from "request";
import * as Database from "./common/database";
import * as mocha from "mocha";
import { RouteDataModel } from "./common/RouteDataModel";

const expect = chai.expect;
const assert = chai.assert;
const before = mocha.before;
const after = mocha.after;
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;   // Some things take a while...

describe("MatchMyRoute API", () => {
    const startServer = !process.env.URL;
    const url = (process.env.URL || "http://localhost:8080") + "/api/v0";
    let server;
    let userIds = [];   // A list of users created that will be deleted at the end of this test run
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    let routeIds = [];  // A list of routes created that will be deleted at the end of this test run
    before(done => {
        console.log("startServer is: " + startServer);
        if (startServer) {
            class AppEmitter extends EventEmitter { };
            const appEmitter = new AppEmitter();
            setupServer(appEmitter);
            appEmitter.on("ready", () => {
                console.log("Starting server");
                server = app.listen(process.env.PORT || "8080", () => {
                    console.log("App listening on port %s", server.address().port);
                    done();
                });
            });
        } else {
            done();
        }
    });

    after(done => {
        console.log("Cleaning up...")
        let promises = [];
        routeIds.forEach(id => {
            promises.push(Database.sql("DELETE FROM routes WHERE id=$1", [id]));
        });
        userIds.forEach(id => {
            console.log("Deleting user " + id);
            promises.push(Database.sql("DELETE FROM users WHERE id=$1", [id]));
        });
        Promise.all(promises).then(() => {
            setTimeout(() => {  // 1s wait for any pending database operations
                Database.shutDownPool().then(() => {
                    if (startServer) {
                        console.log("Shutting down server...");
                        gracefulShutdown();
                        server.close((err) => {
                            console.log("done.");
                            done();
                        });
                    } else {
                        gracefulShutdown();
                        done();
                    }
                });
            }, 1000);
        });
    });

    describe("Root", () => {
        it("should resolve with a 200", done => {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                url,
            }, (error, response, body) => {
                expect(error).to.be.null;
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + error);
                done();
            });
        });
        it("should have CORS enabled", done => {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                url,
            }, (error, response, body) => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + error);
                expect(response.headers["access-control-allow-origin"]).to.equal("*");
                done();
            });
        });
        if (!startServer) {
            // This will only work if we are testing against the live system
            it("should have a valid Swagger schema", done => {
                request({
                    url: "http://online.swagger.io/validator/debug?url=https://matchmyroute-backend.appspot.com/swagger.json",
                }, (error, response, body) => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + error);
                    expect(body).to.equal("{}", "Got swagger validation errors: " + JSON.stringify(body));
                    done();
                });
            });
        }

        describe("Users", () => {
            describe("Creation", () => {
                it("should create a new user", done => {
                    const user = { "email": "test@example.com", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(typeof body.result).to.equal("object", "Result is of unexpected type. Got " +
                            JSON.stringify(body));
                        expect(parseInt(body.result.id, 10)).to.not.be.NaN;

                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt);
                        done();
                    });
                });
                it("should create a second user with different details", done => {
                    const user = { "email": "test1@example.com", "name": "Test User2", "password": "test" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(typeof body).to.equal("object",
                            "Body is of unexpected type, expected object, " + "but it's a " + typeof body);
                        expect(parseInt(body.result.id, 10)).to.not.equal(NaN,
                            "Id returned was not a number. result is: " + JSON.stringify(body.result));
                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt);
                        done();
                    });
                });
                it("shouldn't create a user with no name", done => {
                    const user = { "email": "test2@example.com", "name": "", "password": "test" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("shouldn't create a user with no email", done => {
                    const user = { "email": "", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("shouldn't create a user with no password", done => {
                    const user = { "email": "test3@example.com", "name": "Test User", "password": "" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("shouldn't create a user with a duplicate email", done => {
                    const user = { "email": "test@example.com", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/user",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
            });
            describe("Getting", () => {
                it("should get a user by a valid id", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/user/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        if (typeof body === "string") {
                            body = JSON.parse(body);
                        }
                        expect(body.result.name).to.equal("Test User",
                            "Got a different name than expected. Expected: \"Test User\", got \"" +
                            body.result.name + "\". Full response body is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not get a user if auth is missing", done => {
                    request({
                        url: url + "/user/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should get a user if auth is for another user", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/user/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        if (typeof body === "string") {
                            body = JSON.parse(body);
                        }
                        expect(body.result.name).to.equal("Test User",
                            "Expected result name to be \"Test User\", but it got \"" + body.result.name +
                            "\". Full response body is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not get a user if the id is invalid", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/user/" + -1,
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
            });
            describe("Deletion", () => {
                it("should not delete a user with an invalid id", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/user?id=" + -1,
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not delete a user with a no auth", done => {
                    request({
                        url: url + "/user?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not let a user delete other users", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/user?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should let a user delete themself", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/user?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        done();
                    });
                });
            });
            describe("Authentication", () => {
                describe("Initial", () => {
                    it("should provide a JWT", done => {
                        const auth = { email: "test1@example.com", password: "test" };
                        request({
                            url: url + "/user/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(typeof body.result).to.equal("string", "JWT returned was not a string." +
                                " Got response: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not provide a JWT if the password is incorrect", done => {
                        const auth = { email: "test1@example.com", password: "iforgot" };
                        request({
                            url: url + "/user/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not provide a JWT if the email doesn't exist", done => {
                        const auth = { email: "test@example.com", password: "test" };
                        request({
                            url: url + "/user/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            done();
                        });
                    });
                });
                describe("Subsequent", () => {
                    it("should provide a JWT", done => {
                        request({
                            url: url + "/user/auth",
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(typeof body.result).to.equal("string", "JWT returned was not a string." +
                                " Got response: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not provide a JWT if there is no auth", done => {
                        request({
                            url: url + "/user/auth",
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not provide a JWT if there is invalid auth", done => {
                        request({
                            url: url + "/user/auth",
                            headers: {
                                "Authorisation": "Bearer " + userJwts[0],
                            },
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            done();
                        });
                    });
                });
            });
        });
        describe("Routes", () => {
            before(done => {
                // Create another test user (userIds[2])
                const user = { "email": "test2@example.com", "name": "Test User3", "password": "test" };
                request({
                    url: url + "/user",
                    json: user,
                    method: "POST",
                }, (error, response, body) => {
                    userIds.push(parseInt(body.result.id, 10));
                    userJwts.push(body.result.jwt);
                    done();
                });
            });
            describe("Creation", () => {
                it("should create routes", done => {
                    const route = {
                        "arrivalTime": 1200,
                        "departureTime": 600,
                        "owner": userIds[1],
                        "route": [[0, 0], [1, 0], [1, 1]],
                        "days": ["monday"],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(typeof body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof body);
                        expect(parseInt(body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                            "Full response body is: " + JSON.stringify(body));
                        routeIds.push(parseInt(body.result, 10));
                        done();
                    });
                });
                it("should not create routes when the auth is invalid", done => {
                    const route = {
                        "arrivalTime": 1200,
                        "departureTime": 600,
                        "owner": userIds[1],
                        "route": [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not create routes when the arrival is before the departure", done => {
                    const route = {
                        "arrivalTime": 100,
                        "departureTime": 600,
                        "owner": userIds[1],
                        "route": [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not create routes for an invalid owner", done => {
                    const route = {
                        "arrivalTime": 1200,
                        "departureTime": 600,
                        "owner": userIds[2],
                        "route": [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not create routes when the auth missing", done => {
                    const route = {
                        "arrivalTime": 1200,
                        "departureTime": 600,
                        "owner": userIds[1],
                        "route": [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
            });
            describe("Getting", () => {
                describe("By ID", () => {
                    it("should get a route by a valid id with no auth", done => {
                        request({
                            url: url + "/route?id=" + routeIds[0],
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result.owner).to.equal(userIds[1], "Route belongs to another user." +
                                "Expected owner to be " + userIds[1] + ", but it was " + body.result.owner +
                                ". Full response body is: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not get a route by an invalid id", done => {
                        request({
                            url: url + "/route?id=" + -1,
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            done();
                        });
                    });
                });
                describe("By Nearby", () => {
                    it("Skipping this because it might soon be depreciated", () => { });
                });
                describe("By Matching", () => {
                    beforeAll(done => {
                        // Set up a long straight route that is easy to reason about
                        const route = new RouteDataModel({
                            "arrivalTime": 660,
                            "departureTime": 60,
                            "owner": userIds[1],
                            "route": [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                            "days": ["tuesday", "friday", "sunday"],
                        });
                        const promise = Database.putRoute(route);
                        promise.then(routeId => {
                            routeIds.push(routeId); // Should be routeIds[1]
                            done();
                        }, err => {
                            console.log("Error while setting up the route to test route matching");
                            throw err;
                        });
                    });
                    it("should match a route", done => {
                        const matchParams = {
                            start: {
                                latitude: 0,
                                longitude: 1.4,
                                radius: 500,
                            },
                            end: {
                                latitude: 0,
                                longitude: 4.6,
                                radius: 500,
                            },
                            time: 500,
                            days: ["thursday", "friday", "sunday"],
                        };
                        request({
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            url: url + "/routes/match",
                            json: matchParams,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body))
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                                JSON.stringify(body.result));
                            expect(thisRoute.owner).to.equal(userIds[1]);
                            // Should be the intersection between the route days and the search days
                            expect(thisRoute.days).to.eql(["friday", "sunday"]);
                            expect(thisRoute.meetingTime).to.be.at.least(60, "meetingTime is smaller than the" +
                                "route's start time (60). Got " + thisRoute.meetingTime + ". Route is: " +
                                JSON.stringify(thisRoute));
                            expect(thisRoute.meetingTime).to.be.at.most(660, "meetingTime is larger than the " +
                                "route's end time (660). Got " + thisRoute.meetingTime + ". Route is: " +
                                JSON.stringify(thisRoute));
                            expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                            expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
                            done();
                        });
                    });
                    it("should not match a route in the wrong direction", done => {
                        const matchParams = {
                            start: {
                                latitude: 0,
                                longitude: 4.6,
                                radius: 500,
                            },
                            end: {
                                latitude: 0,
                                longitude: 1.4,
                                radius: 500,
                            },
                            time: 500,
                            days: ["thursday", "friday", "sunday"],
                        };
                        request({
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            url: url + "/routes/match",
                            json: matchParams,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body))
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                    it("should not match a route when non-matching days are given", done => {
                        const matchParams = {
                            start: {
                                latitude: 0,
                                longitude: 1.4,
                                radius: 500,
                            },
                            end: {
                                latitude: 0,
                                longitude: 4.6,
                                radius: 500,
                            },
                            time: 500,
                            days: ["thursday"],
                        };
                        request({
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            url: url + "/routes/match",
                            json: matchParams,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body))
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                    it("should match a route when neither days nor time is given", done => {
                        const matchParams = {
                            start: {
                                latitude: 0,
                                longitude: 1.4,
                                radius: 500,
                            },
                            end: {
                                latitude: 0,
                                longitude: 4.6,
                                radius: 500,
                            },
                        };
                        request({
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            url: url + "/routes/match",
                            json: matchParams,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body))
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                                JSON.stringify(body.result));
                            expect(thisRoute.owner).to.equal(userIds[1]);
                            // Should be the intersection between the route days and the search days
                            expect(thisRoute.days).to.eql(["tuesday", "friday", "sunday"]);
                            expect(thisRoute.meetingTime).to.be.at.least(60, "meetingTime is smaller than the" +
                                "route's start time (60). Got " + thisRoute.meetingTime + ". Route is: " +
                                JSON.stringify(thisRoute));
                            expect(thisRoute.meetingTime).to.be.at.most(660, "meetingTime is larger than the " +
                                "route's end time (660). Got " + thisRoute.meetingTime + ". Route is: " +
                                JSON.stringify(thisRoute));
                            expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                            expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
                            done();
                        });
                    });
                });
            });
            describe("Updating", () => {
                it("should update all properties at once", done => {
                    const updates = {
                        id: routeIds[0],
                        days: ["tuesday"],
                        arrivalTime: 1500,
                        departureTime: 900,
                        route: [[0, 0], [1, 0], [1, 1], [0, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.days).to.eql(["tuesday"]);
                                expect(route.arrivalTime).to.equal(1500);
                                expect(route.departureTime).to.equal(900);
                                expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should update one property at a time - arrivalTime", done => {
                    const updates = {
                        id: routeIds[0],
                        arrivalTime: 1200,
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.days).to.eql(["tuesday"]);
                                expect(route.arrivalTime).to.equal(1200);
                                expect(route.departureTime).to.equal(900);
                                expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should update one property at a time - departureTime", done => {
                    const updates = {
                        id: routeIds[0],
                        departureTime: 600,
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.days).to.eql(["tuesday"]);
                                expect(route.arrivalTime).to.equal(1200);
                                expect(route.departureTime).to.equal(600);
                                expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should update one property at a time - days", done => {
                    const updates = {
                        id: routeIds[0],
                        days: ["monday", "sunday"],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.days).to.eql(["monday", "sunday"]);
                                expect(route.arrivalTime).to.equal(1200);
                                expect(route.departureTime).to.equal(600);
                                expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should update one property at a time - route", done => {
                    const updates = {
                        id: routeIds[0],
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.days).to.eql(["monday", "sunday"]);
                                expect(route.arrivalTime).to.equal(1200);
                                expect(route.departureTime).to.equal(600);
                                expect(route.route).to.eql([[0, 0], [1, 0], [1, 1]]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should not be able to update ownership", done => {
                    const updates = {
                        id: routeIds[0],
                        owner: userIds[0],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id, owner, ST_AsText(route) as route, days::integer as days, " +
                            "departureTime, arrivalTime FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                                let route;
                                try {
                                    route = RouteDataModel.fromSQLRow(result.rows[0]);
                                } catch (err) {
                                    assert.fail(0, 1, "Update resulted in an invalid RouteDataModel: " +
                                        err).and.notify(done);
                                }
                                expect(route.owner).to.equal(userIds[1]);
                                done();
                            }, err => {
                                assert.fail(0, 1, "Error getting the route from the database to check that it's " +
                                    "not updated: " + err).and.notify(done);
                            });
                    });
                });
                it("should not allow updating to invalid departureTime", done => {
                    const updates = {
                        id: routeIds[0],
                        departureTime: 1500,
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", response is: " + JSON.stringify(response));
                        console.log("Got " + error);
                        done();
                    });
                });
                it("should not allow updating to invalid arrivalTime", done => {
                    const updates = {
                        id: routeIds[0],
                        arrivalTime: 500,
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        console.log("Got " + error);
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", response is: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not allow updating to invalid arrivalTime + departureTime", done => {
                    const updates = {
                        id: routeIds[0],
                        departureTime: 1500,
                        arrivalTime: 1000
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", response is: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not allow updating to invalid route", done => {
                    const updates = {
                        id: routeIds[0],
                        route: [[0, 0, 0], [1], [2, 2]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", response is: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not allow updating another user's route", done => {
                    const updates = {
                        id: routeIds[0],
                        days: ["friday"],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[2],
                        },
                        url: url + "/route",
                        json: updates,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", response is: " + response);
                        done();
                    });
                });
            });
            describe("Deletion", () => {
                before(done => {
                    // Set up another route belonging to userIds[2]
                    const route = {
                        "arrivalTime": 1200,
                        "departureTime": 600,
                        "owner": userIds[2],
                        "route": [[0, 0], [1, 0], [1, 1]],
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[2],
                        },
                        url: url + "/route",
                        json: route,
                        method: "PUT",
                    }, (error, response, body) => {
                        routeIds.push(parseInt(body.result, 10));
                        done();
                    });
                });
                it("should not delete a route with an invalid id", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route?id=" + -1,
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not delete a route with no auth", done => {
                    request({
                        url: url + "/route?id=" + routeIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not be able to delete another user's route", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[2],
                        },
                        url: url + "/route?id=" + routeIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500, "Expected 500 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should delete a route", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route?id=" + routeIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id from routes where id=$1;", [routeIds[0]]).then(result => {
                            expect(result.rowCount).to.equal(0, "Route was not deleted! Found this in database: " +
                                JSON.stringify(result.rows));
                            done();
                        }, err => {
                            assert.fail(err, 0, "Inner Promise was rejected (Database.sql) " + err);
                        });
                    });
                });
                it("should delete any routes belonging to a user, when a user is deleted", done => {
                    // Should delete routeIds[1], which we setup in before
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[2],
                        },
                        url: url + "/user?id=" + userIds[2],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        Database.sql("SELECT id from routes where id=$1;", [routeIds[2]]).then(result => {
                            expect(result.rowCount).to.equal(0, "Route was not deleted! Found this in database: " +
                                JSON.stringify(result.rows));
                            done();
                        }, err => {
                            assert.fail(err, 0, "Inner Promise was rejected (Database.sql) " + err);
                        });
                    });
                });
            });
        });
    });
});
