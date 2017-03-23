/* tslint:disable */
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as request from "request";
import * as Database from "./common/database";

const expect = chai.expect;
const assert = chai.assert;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;   // Some things take a while...

describe("MatchMyRoute API", () => {
    const startServer = !process.env.URL;
    const url = (process.env.URL || "http://localhost:8080") + "/api/v0";
    let server;
    let userIds = [];   // A list of users created that will be deleted at the end of this test run
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    let routeIds = [];  // A list of routes created that will be deleted at the end of this test run
    beforeAll(done => {
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

    afterAll(done => {
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
                expect(response.statusCode).to.equal(200);
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
                expect(response.statusCode).to.equal(200);
                expect(response.headers["access-control-allow-origin"]).to.equal("*");
                done();
            });
        });

        describe("Users", () => {
            describe("Creation", () => {
                it("should create a new user", done => {
                    const user = { "email": "test@example.com", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response");
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(parseInt(body.result.id, 10)).to.not.be.NaN;

                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt);
                        done();
                    });
                });
                it("should create a second user with different details", done => {
                    const user = { "email": "test1@example.com", "name": "Test User2", "password": "test" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response");
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(parseInt(body.result.id, 10)).to.not.be.NaN;

                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt);
                        done();
                    });
                });
                it("shouldn't create a user with no name", done => {
                    const user = { "email": "test2@example.com", "name": "", "password": "test" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("shouldn't create a user with no email", done => {
                    const user = { "email": "", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("shouldn't create a user with no password", done => {
                    const user = { "email": "test3@example.com", "name": "Test User", "password": "" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("shouldn't create a user with a duplicate email", done => {
                    const user = { "email": "test@example.com", "name": "Test User", "password": "test" };
                    request({
                        url: url + "/users",
                        json: user,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        url: url + "/users/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200);
                        if (typeof body === "string") {
                            body = JSON.parse(body);
                        }
                        expect(body.result.name).to.equal("Test User", "Got a different name than expected");
                        done();
                    });
                });
                it("should not get a user if auth is missing", done => {
                    request({
                        url: url + "/users/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("should get a user if auth is for another user", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/users/" + userIds[0],
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200);
                        if (typeof body === "string") {
                            body = JSON.parse(body);
                        }
                        expect(body.result.name).to.equal("Test User");
                        done();
                    });
                });
                it("should not get a user if the id is invalid", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/users/" + -1,
                        method: "GET",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        url: url + "/users?id=" + -1,
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("should not delete a user with a no auth", done => {
                    request({
                        url: url + "/users?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("should not let a user delete other users", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/users?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("should let a user delete themself", done => {
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[0],
                        },
                        url: url + "/users?id=" + userIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200);
                        done();
                    });
                });
            });
            describe("Authentication", () => {
                describe("Initial", () => {
                    it("should provide a JWT", done => {
                        const auth = { email: "test1@example.com", password: "test" };
                        request({
                            url: url + "/users/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(typeof body.result).to.equal("string");
                            done();
                        });
                    });
                    it("should not provide a JWT if the password is incorrect", done => {
                        const auth = { email: "test1@example.com", password: "iforgot" };
                        request({
                            url: url + "/users/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500);
                            done();
                        });
                    });
                    it("should not provide a JWT if the email doesn't exist", done => {
                        const auth = { email: "test@example.com", password: "test" };
                        request({
                            url: url + "/users/auth",
                            json: auth,
                            method: "POST",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500);
                            done();
                        });
                    });
                });
                describe("Subsequent", () => {
                    it("should provide a JWT", done => {
                        request({
                            url: url + "/users/auth",
                            headers: {
                                "Authorisation": "Bearer " + userJwts[1],
                            },
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(typeof body.result).to.equal("string");
                            done();
                        });
                    });
                    it("should not provide a JWT if there is no auth", done => {
                        request({
                            url: url + "/users/auth",
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500);
                            done();
                        });
                    });
                    it("should not provide a JWT if there is invalid auth", done => {
                        request({
                            url: url + "/users/auth",
                            headers: {
                                "Authorisation": "Bearer " + userJwts[0],
                            },
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500);
                            done();
                        });
                    });
                });
            });
        });
        describe("Routes", () => {
            beforeAll(done => {
                // Create another test user (userIds[2])
                const user = { "email": "test2@example.com", "name": "Test User3", "password": "test" };
                request({
                    url: url + "/users",
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
                    };
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[1],
                        },
                        url: url + "/route",
                        json: route,
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response");
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(parseInt(body.result, 10)).to.not.be.NaN;
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
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        method: "POST",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                            expect(response.statusCode).to.equal(200);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result.owner).to.equal(userIds[1]);
                            done();
                        });
                    });
                    it("should not get a route by an invalid id", done => {
                        request({
                            url: url + "/route?id=" + -1,
                            method: "GET",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(500);
                            done();
                        });
                    });
                });
                describe("By Nearby", () => {
                    it("Skipping this because it might soon be depreciated", () => { });
                });
            });
            describe("Deletion", () => {
                beforeAll(done => {
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
                        method: "POST",
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
                        expect(response.statusCode).to.equal(500);
                        done();
                    });
                });
                it("should not delete a route with no auth", done => {
                    request({
                        url: url + "/route?id=" + routeIds[0],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(500);
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
                        expect(response.statusCode).to.equal(500);
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
                        expect(response.statusCode).to.equal(200);
                        Database.sql("SELECT id from routes where id=$1;", [routeIds[0]]).then(result => {
                            expect(result.rowCount).to.equal(0);
                            done();
                        }, err => {
                            assert.fail(err, 0, "Inner Promise was rejected (Database.sql) " + err);
                        });
                    });
                });
                it("should delete any routes beloning to a user, when a user is deleted", done => {
                    // Should delete routeIds[1], which we setup in beforeAll
                    request({
                        headers: {
                            "Authorisation": "Bearer " + userJwts[2],
                        },
                        url: url + "/users?id=" + userIds[2],
                        method: "DELETE",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200);
                        Database.sql("SELECT id from routes where id=$1;", [routeIds[1]]).then(result => {
                            expect(result.rowCount).to.equal(0);
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
