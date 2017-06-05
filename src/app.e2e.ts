import * as CloudStorage from "./common/cloudstorage";
import ExperiencedRoute from "./common/ExperiencedRouteDataModel";
import InexperiencedRoute from "./common/InexperiencedRouteDataModel";
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import { senecaReady } from "./microservices-framework/web/services";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as mocha from "mocha";
import * as moment from "moment";
import * as request from "request";
import * as retryRequest from "retry-request";
import * as logger from "winston";

const expect = chai.expect;
const assert = chai.assert;
const before = mocha.before;
const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;

// Set some defaults for our requests
const defaultRequest = request.defaults({
    headers: {
        Origin: "https://www.example.com",
    },
    json: true,
});

const deleteE2EUsers = (url): Promise<Boolean> => {
    return new Promise(resolve => {
        defaultRequest({
            method: "GET",
            url: url + "/clearE2EUsers",
        }, (error, response, body) => {
            if (error !== null) {
                logger.error("Got error when trying to delete the e2e test users: " + JSON.stringify(error));
            }
            return resolve(true);
        });
    });
};

describe("MatchMyRoute API", () => {
    const startServer = !process.env.URL;
    const url = (process.env.URL || "http://localhost:8080") + "/api/v0";
    let server;
    let userIds = [];   // A list of users created that will be deleted at the end of this test run
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    let routeIds = [];  // A list of routes created that will be deleted at the end of this test run
    let inexperiencedRouteIds = [];   // A list of Inexperienced Route IDs that will be deleted at the end of this run
    /* tslint:disable only-arrow-functions */
    before(function(done) { // Must not be an arrow function because we need access to `this`
        this.timeout(0);    // Disable timeouts for the server startup
        logger.info("startServer is: " + startServer);
        if (startServer) {
            class AppEmitter extends EventEmitter { };
            const appEmitter = new AppEmitter();
            setupServer(appEmitter);
            appEmitter.on("ready", () => {
                logger.info("Starting server");
                server = app.listen(process.env.PORT || "8080", () => {
                    logger.debug("App listening on port %s", server.address().port);
                    deleteE2EUsers(url).then(() => {
                        done();
                    });
                });
            });
        } else {
            senecaReady.then(() => {
                deleteE2EUsers(url).then(() => {
                    done();
                });
            });
        }
    });
    /* tslint:enable only-arrow-functions */

    after(done => {
        logger.info("Cleaning up...");
        deleteE2EUsers(url).then(() => {
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
    });

    describe("Root", () => {
        it("should resolve with a 200", done => {
            defaultRequest({
                url,
            }, (error, response, body) => {
                expect(error).to.be.null;
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + error);
                done();
            });
        });
        it("should have CORS enabled", done => {
            defaultRequest({
                url,
            }, (error, response, body) => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + error + " body returned is: " +
                    JSON.stringify(body), " response returned is: " + JSON.stringify(response));
                expect(response.headers["access-control-allow-origin"]).to.equal("*");
                done();
            });
        });
        it("should have a valid Swagger schema", done => {
            defaultRequest({
                url: "http://online.swagger.io/validator/debug?url=" +
                "https://matchmyroute-backend.appspot.com/swagger.json",
            }, (error, response, body) => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + error);
                expect(body).to.eql({}, "Got swagger validation errors: " + JSON.stringify(body));
                done();
            });
        });
        describe("Users", () => {
            describe("Creation", () => {
                it("should create a new user", done => {
                    const user = { email: "test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "test" };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(typeof body.result).to.equal("object", "Result is of unexpected type. Got " +
                            JSON.stringify(body));
                        expect(parseInt(body.result.id, 10)).to.not.be.NaN;
                        expect(body.result.jwt, "JWT has no token: "
                            + JSON.stringify(body.result)).to.have.property("token")
                            .that.is.a("string", "JWT token is not a string, it's a " +
                            (typeof body.result.jwt.token) + ", here is the JWT: " + JSON.stringify(body.result.jwt));
                        expect(body.result.jwt, "JWT has no expires: "
                            + JSON.stringify(body.result)).to.have.property("expires")
                            .that.is.a("number", "JWT expires is not a number, it's a " +
                            (typeof body.result.jwt.expires) + ", here is the JWT " +
                            JSON.stringify(body.result.jwt));

                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt.token);
                        done();
                    });
                });
                it("should create a second user with different details and a profile photo", done => {
                    const user = {
                        email: "test1@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User2",
                        password: "test",
                        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21"
                            + "bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
                    };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(typeof body).to.equal("object", "Body is of unexpected type");
                        expect(typeof body.result).to.equal("object", "Result is of unexpected type. Got " +
                            JSON.stringify(body));
                        expect(parseInt(body.result.id, 10)).to.not.be.NaN;
                        expect(body.result.jwt, "JWT has no token: "
                            + JSON.stringify(body.result)).to.have.property("token")
                            .that.is.a("string", "JWT token is not a string, it's a " +
                            (typeof body.result.jwt.token) + ", here is the JWT: " + JSON.stringify(body.result.jwt));
                        expect(body.result.jwt, "JWT has no expires: "
                            + JSON.stringify(body.result)).to.have.property("expires")
                            .that.is.a("number", "JWT expires is not a number, it's a " +
                            (typeof body.result.jwt.expires) + ", here is the JWT " +
                            JSON.stringify(body.result.jwt));
                        expect(body.result.profileImage).to.be.a.string;

                        userIds.push(parseInt(body.result.id, 10));
                        userJwts.push(body.result.jwt.token);

                        // check if photo exists in cloud storage
                        const imgUrl = body.result.profileImage;
                        retryRequest(
                            {
                                json: true,
                                method: "GET",
                                retries: 10,
                                shouldRetryFn: httpMessage => {
                                    return httpMessage.statusMessage !== "OK";
                                },
                                url: imgUrl,
                            }, (error1, response1, body1) => {
                                expect(response1.statusCode).to.equal(200, "Image doesn't exist in Cloud Storage");
                                done();
                            }
                        );
                    });
                });
                it("shouldn't create a user with no name", done => {
                    const user = { email: "test2@e2e-test.matchmyroute-backend.appspot.com",
                        name: "", password: "test" };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Name Required");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("shouldn't create a user with no email", done => {
                    const user = { email: "", name: "E2E Test User", password: "test" };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Email Required");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("shouldn't create a user with no password", done => {
                    const user = { email: "test3@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "" };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Password Required");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("shouldn't create a user with a duplicate email", done => {
                    const user = { email: "test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "test" };
                    defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("An account already exists using this email");
                        expect(body.status).to.equal(409);
                        done();
                    });
                });
            });
            describe("Getting", () => {
                it("should get a user by a valid id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/user/" + userIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.result.name).to.equal("E2E Test User",
                            "Got a different name than expected. Expected: \"E2E Test User\", got \"" +
                            body.result.name + "\". Full response body is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not get a user if auth is missing", done => {
                    defaultRequest({
                        method: "GET",
                        url: url + "/user/" + userIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should get a user if auth is for another user", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        method: "GET",
                        url: url + "/user/" + userIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.result.name).to.equal("E2E Test User",
                            "Expected result name to be \"E2E Test User\", but it got \"" + body.result.name +
                            "\". Full response body is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not get a user if the id is invalid", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/user/" + -1,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("User doesn't exist");
                        expect(body.status).to.equal(404);
                        done();
                    });
                });
            });
            describe("Updating", () => {
                it("should update a user", done => {
                    const userUpdates = {
                        bio: "Updated bio",
                        email: "updatedtest@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Updated Test User",
                        password: "updatedtest",
                        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21" +
                        "bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.name).to.equal("Updated Test User");
                            expect(user.email).to.equal("updatedtest@e2e-test.matchmyroute-backend.appspot.com");
                            expect(user.bio).to.equal("Updated bio");
                            expect(user.photo).to.equal(CloudStorage.createFilenameForUser(userIds[0]));
                            // Test password change by logging in with the new password
                            defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + userJwts[0],
                                },
                                json: {
                                    email: "updatedtest@e2e-test.matchmyroute-backend.appspot.com",
                                    password: "updatedtest",
                                },
                                method: "POST",
                                url: url + "/auth/user",
                            }, (error3, response3, body3) => {
                                expect(response3.statusCode).to.equal(200, "Got non 200 login response: " +
                                    JSON.stringify(response3));
                                // check if photo exists in cloud storage
                                const imgUrl = process.env.STORAGE_BASE_URL +
                                "/" +
                                process.env.STORAGE_BUCKET +
                                "/" +
                                user.photo;
                                retryRequest(
                                    {
                                        json: true,
                                        method: "GET",
                                        retries: 10,
                                        shouldRetryFn: httpMessage => {
                                            return httpMessage.statusMessage !== "OK";
                                        },
                                        url: imgUrl,
                                    }, (error4, response4, body4) => {
                                        expect(response4.statusCode)
                                            .to.equal(200, "Image doesn't exist in Cloud Storage");
                                        done();
                                    }
                                );
                            });
                        });
                    });
                });
                it("should not update a user without auth", done => {
                    const userUpdates = {
                        email: "updated2test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Updated2 Test User", password: "updated2test",
                    };
                    defaultRequest({
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not update a user to an extant email", done => {
                    const userUpdates = {
                        email: "test1@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Updated2 Test User", password: "updated2test",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("An account already exists using this email");
                        expect(body.status).to.equal(409);
                        done();
                    });
                });
                it("should update a user's individual properties - name", done => {
                    const userUpdates = {
                        name: "E2E Test User",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.name).to.equal("E2E Test User");
                            done();
                        });
                    });
                });
                it("should update a user's individual properties - email", done => {
                    const userUpdates = {
                        email: "test@e2e-test.matchmyroute-backend.appspot.com",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.email).to.equal("test@e2e-test.matchmyroute-backend.appspot.com");
                            done();
                        });
                    });
                });
                it("should update a user's individual properties - password", done => {
                    const userUpdates = {
                        password: "test",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        // Test by logging in with the new password
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            json: {
                                email: "test@e2e-test.matchmyroute-backend.appspot.com",
                                password: "test",
                            },
                            method: "POST",
                            url: url + "/auth/user",
                        }, (error2, response2, body2) => {
                            expect(response2.statusCode).to.equal(200, "Got non 200 login response: " +
                                JSON.stringify(response2));
                            done();
                        });
                    });
                });
                it("should update a user's individual properties - bio", done => {
                    const userUpdates = {
                        bio: "Bio",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.bio).to.equal("Bio");
                            done();
                        });
                    });
                });
                it("should update a user's individual properties - photo", done => {
                    const userUpdates = {
                        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21"
                            + "bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.photo).to.equal(CloudStorage.createFilenameForUser(userIds[0]));
                            // done();
                            // check if photo exists in cloud storage
                            const imgUrl = process.env.STORAGE_BASE_URL +
                            "/" +
                            process.env.STORAGE_BUCKET +
                            "/" +
                            user.photo;
                            retryRequest(
                                {
                                    json: true,
                                    method: "GET",
                                    retries: 10,
                                    shouldRetryFn: httpMessage => {
                                        return httpMessage.statusMessage !== "OK";
                                    },
                                    url: imgUrl,
                                }, (error3, response3, body3) => {
                                    expect(response3.statusCode).to.equal(200, "Image doesn't exist in Cloud Storage");
                                    done();
                                }
                            );
                        });

                    });
                });
                it("should update a user's individual properties - photo (removal)", done => {
                    const userUpdates = {
                        photo: null,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/" + userIds[0],
                        }, (error2, response2, body2) => {
                            let user = body2.result;
                            expect(user.photo).to.be.null;
                            done();
                        });
                        // this does not work as the public URL is still available for some (unknown) time
                        // through google cloud storage
                        // const imgUrl = process.env.STORAGE_BASE_URL +
                        // "/" +
                        // process.env.STORAGE_BUCKET +
                        // "/" +
                        // CloudStorage.createFilenameForUser(userIds[0]);
                        // defaultRequest({
                        //     method: "GET",
                        //     url: imgUrl,
                        // }, (error3, response3, body3) => {
                        //     expect(response3.statusCode).to.equal(403, "Image still exists in Cloud Storage");
                        //     done();
                        // });
                    });
                });
                it("should not update help count", done => {
                    const userUpdates = {
                        helped: 999,
                        profile_helped: 999,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not update joined date", done => {
                    const userUpdates = {
                        joined: 100,
                        profile_joined: 100,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not update password hash directly", done => {
                    const userUpdates = {
                        pwh: new Buffer("updated"),
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not update password rounds directly", done => {
                    const userUpdates = {
                        rounds: 999,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                        done();
                    });
                });
                it("should not update salt", done => {
                    const userUpdates = {
                        salt: new Buffer("notsosalty"),
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                        done();
                    });
                });
            });
            describe("Deletion", () => {
                it("should not delete a user with a no auth", done => {
                    defaultRequest({
                        method: "DELETE",
                        url: url + "/user",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should let a user delete themself", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "DELETE",
                        url: url + "/user",
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
                        const auth = { email: "test1@e2e-test.matchmyroute-backend.appspot.com", password: "test" };
                        defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result, "JWT has no token: "
                                + JSON.stringify(body.result)).to.have.property("token")
                                .that.is.a("string", "JWT token is not a string, it's a " +
                                (typeof body.result.token) + ", here is the JWT: " + JSON.stringify(body.result));
                            expect(body.result, "JWT has no expires: "
                                + JSON.stringify(body.result)).to.have.property("expires")
                                .that.is.a("number", "JWT expires is not a number, it's a " +
                                (typeof body.result.expires) + ", here is the JWT " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                    it("should not provide a JWT if the password is incorrect", done => {
                        const auth = { email: "test1@e2e-test.matchmyroute-backend.appspot.com", password: "iforgot" };
                        defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            expect(body.error).to.equal("Incorrect Password");
                            expect(body.status).to.equal(403);
                            done();
                        });
                    });
                    it("should not provide a JWT if the email doesn't exist", done => {
                        const auth = { email: "test@e2e-test.matchmyroute-backend.appspot.com", password: "test" };
                        defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            expect(body.error).to.equal("Incorrect Password");
                            expect(body.status).to.equal(403);
                            done();
                        });
                    });
                });
                describe("Subsequent", () => {
                    it("should provide a JWT", done => {
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result, "JWT has no token: " +
                                JSON.stringify(body.result)).to.have.property("token")
                                .that.is.a("string", "JWT token is not a string, it's a " +
                                (typeof body.result.token) + ", here is the JWT: " + JSON.stringify(body.result));
                            expect(body.result, "JWT has no expires: " +
                                JSON.stringify(body.result)).to.have.property("expires")
                                .that.is.a("number", "JWT expires is not a number, it's a " +
                                (typeof body.result.expires) + ", here is the JWT " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                    it("should not provide a JWT if there is no auth", done => {
                        defaultRequest({
                            method: "GET",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            expect(body.error).to.equal("Invalid authorization");
                            expect(body.status).to.equal(403);
                            done();
                        });
                    });
                    it("should not provide a JWT if there is invalid auth", done => {
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/auth",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            expect(body.error).to.equal("Invalid authorization");
                            expect(body.status).to.equal(403);
                            done();
                        });
                    });
                });
            });
        });
        describe("ExperiencedRoutes", () => {
            before(done => {
                // Create another test user (userIds[2])
                const user = { email: "test2@e2e-test.matchmyroute-backend.appspot.com",
                    name: "E2E Test User3", password: "test" };
                defaultRequest({
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                }, (error, response, body) => {
                    userIds.push(parseInt(body.result.id, 10));
                    userJwts.push(body.result.jwt.token);
                    done();
                });
            });
            describe("Creation", () => {
                it("should create experienced routes", done => {
                    const route = {
                        arrivalTime: "13:00:00+00",
                        days: ["monday"],
                        departureTime: "12:00:00+00",
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + error + " body is " + body);
                        expect(typeof body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof body);
                        expect(parseInt(body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                            "Full response body is: " + JSON.stringify(body));
                        routeIds.push(parseInt(body.result.id, 10));
                        done();
                    });
                });
                it("should not create experienced routes when the auth is invalid", done => {
                    const route = {
                        arrivalTime: "13:00:00+00",
                        departureTime: "12:00:00+00",
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not create experienced routes when the arrival is before the departure", done => {
                    const route = {
                        arrivalTime: "13:00:00+00",
                        departureTime: "14:00:00+00",
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Arrival time is before Departure time");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not create experienced routes when the auth missing", done => {
                    const route = {
                        arrivalTime: "13:00:00+00",
                        departureTime: "12:00:00+00",
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
            });
            describe("Getting", () => {
                describe("By ID", () => {
                    it("should get an experienced route by a valid id with no auth", done => {
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            expect(body.result.length).to.equal(1);
                            expect(body.result[0].owner).to.equal(userIds[1], "Route belongs to another user." +
                                "Expected owner to be " + userIds[1] + ", but it was " + body.result.owner +
                                ". Full response body is: " + JSON.stringify(body));
                            done();
                        });
                    });
                    it("should not get an experienced route by an invalid id", done => {
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + -1,
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(body));
                            expect(body.error).to.equal("ExperiencedRoute doesn't exist");
                            expect(body.status).to.equal(404);
                            done();
                        });
                    });
                });
                /* tslint:disable no-empty */
                describe("By Nearby", () => {
                    it("Skipping this because it might soon be depreciated", () => { });
                });
                /* tslint:enable no-empty */
                describe("By Matching", () => {
                    before(done => {
                        // Set up a long straight route that is easy to reason about
                        const route = new ExperiencedRoute({
                            arrivalTime: "13:15:00+00",
                            days: ["tuesday", "friday", "sunday"],
                            departureTime: "12:15:00+00",
                            owner: userIds[1],
                            route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                        });
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            json: route,
                            method: "PUT",
                            url: url + "/experiencedRoute",
                        }, (error, response, body) => {
                            if (response.statusCode !== 201) {
                                logger.error("Error while setting up the experienced route to test route matching");
                                throw error || body;
                            } else {
                                routeIds.push(body.result.id); // Should be routeIds[1]
                                done();
                            }
                        });
                    });
                    it("should match an experienced route", done => {
                        const matchParams = {
                            arrivalDateTime: "2017-09-08T13:20:00+00",
                            endPoint: [0, 4.6],
                            radius: 500,
                            startPoint: [0, 1.4],
                        };
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            json: matchParams,
                            method: "POST",
                            url: url + "/experiencedRoutes/match",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body));
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                                JSON.stringify(body.result));
                            expect(thisRoute.owner).to.equal(userIds[1]);
                            // Should be the intersection between the route days and the search days
                            expect(moment("2017-09-08T12:15:00+00").isBefore(thisRoute.meetingTime)).to.equal(true,
                                "meetingTime is before the route's start time (12:15:00+00). Got " +
                                thisRoute.meetingTime);
                            expect(moment("2017-09-08T13:15:00+00").isAfter(thisRoute.meetingTime)).to.equal(true,
                                "meetingTime is after the route's end time (13:15:00+00). Got " +
                                thisRoute.meetingTime);
                            expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                            expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
                            done();
                        });
                    });
                    it("should not match an experienced route in the wrong direction", done => {
                        const matchParams = {
                            arrivalDateTime: "2017-09-08T13:20:00+00",
                            endPoint: [0, 1.4],
                            radius: 500,
                            startPoint: [4.6, 0],
                        };
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            json: matchParams,
                            method: "POST",
                            url: url + "/experiencedRoutes/match",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body));
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                    it("should not match an experienced route when non-matching days are given", done => {
                        const matchParams = {
                            arrivalDateTime: "2017-09-09T13:20:00+00",
                            endPoint: [0, 4.6],
                            radius: 500,
                            startPoint: [0, 1.4],
                        };
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            json: matchParams,
                            method: "POST",
                            url: url + "/experiencedRoutes/match",
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + error);
                            if (typeof body === "string") {
                                body = JSON.parse(body);
                            }
                            expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                                "results, body is: " + JSON.stringify(body));
                            const thisRoute = body.result.filter((route) => {
                                return route.id === routeIds[1];
                            })[0];
                            expect(thisRoute).to.equal(undefined, "Route was matched. Results were " +
                                JSON.stringify(body.result));
                            done();
                        });
                    });
                });
            });
            describe("Updating", () => {
                it("should update all properties at once", done => {
                    const updates = {
                        arrivalTime: "14:00:00+00",
                        days: ["tuesday"],
                        departureTime: "13:00:00+00",
                        id: routeIds[0],
                        route: [[0, 0], [1, 0], [1, 1], [0, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            expect(body2.result.length).to.equal(1);
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.days).to.eql(["tuesday"]);
                            expect(route.arrivalTime).to.equal("14:00:00+00");
                            expect(route.departureTime).to.equal("13:00:00+00");
                            expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                            done();
                        });
                    });
                });
                it("should update one property at a time - arrivalTime", done => {
                    const updates = {
                        arrivalTime: "15:00:00+00",
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.days).to.eql(["tuesday"]);
                            expect(route.arrivalTime).to.equal("15:00:00+00");
                            expect(route.departureTime).to.equal("13:00:00+00");
                            expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                            done();
                        });
                    });
                });
                it("should update one property at a time - departureTime", done => {
                    const updates = {
                        departureTime: "14:00:00+00",
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.days).to.eql(["tuesday"]);
                            expect(route.arrivalTime).to.equal("15:00:00+00");
                            expect(route.departureTime).to.equal("14:00:00+00");
                            expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                            done();
                        });
                    });
                });
                it("should update one property at a time - days", done => {
                    const updates = {
                        days: ["monday", "sunday"],
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.days).to.eql(["monday", "sunday"]);
                            expect(route.arrivalTime).to.equal("15:00:00+00");
                            expect(route.departureTime).to.equal("14:00:00+00");
                            expect(route.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                            done();
                        });
                    });
                });
                it("should update one property at a time - route", done => {
                    const updates = {
                        id: routeIds[0],
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.days).to.eql(["monday", "sunday"]);
                            expect(route.arrivalTime).to.equal("15:00:00+00");
                            expect(route.departureTime).to.equal("14:00:00+00");
                            expect(route.route).to.eql([[0, 0], [1, 0], [1, 1]]);
                            done();
                        });
                    });
                });
                it("should not be able to update ownership", done => {
                    const updates = {
                        id: routeIds[0],
                        owner: userIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            let route;
                            try {
                                route = new ExperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid ExperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(route.owner).to.equal(userIds[1]);
                            done();
                        });
                    });
                });
                it("should not allow updating to invalid departureTime", done => {
                    const updates = {
                        departureTime: "18:00:00+00",
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Arrival time is before Departure time");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not allow updating to invalid arrivalTime", done => {
                    const updates = {
                        arrivalTime: "10:00:00+00",
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Arrival time is before Departure time");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not allow updating to invalid arrivalTime + departureTime", done => {
                    const updates = {
                        arrivalTime: "05:00:00+00",
                        departureTime: "07:00:00+00",
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Arrival time is before Departure time");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not allow updating to invalid route", done => {
                    const updates = {
                        id: routeIds[0],
                        route: [[0, 0, 0], [1], [2, 2]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Coordinates in a ExperiencedRoute should only have 2 " +
                            "items in them, [latitude, longitude]");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not allow updating another user's route", done => {
                    const updates = {
                        days: ["friday"],
                        id: routeIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
            });
            describe("Deletion", () => {
                before(done => {
                    // Set up another route belonging to userIds[2]
                    const route = {
                        arrivalTime: "14:00:00+00",
                        departureTime: "13:00:00+00",
                        owner: userIds[2],
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        routeIds.push(parseInt(body.result.id, 10));
                        done();
                    });
                });
                it("should not delete an experienced route with an invalid id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        method: "DELETE",
                        url: url + "/experiencedRoute?id=" + -1,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(404, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("ExperiencedRoute doesn't exist");
                        expect(body.status).to.equal(404);
                        done();
                    });
                });
                it("should not delete an experienced route with no auth", done => {
                    defaultRequest({
                        method: "DELETE",
                        url: url + "/experiencedRoute?id=" + routeIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not be able to delete another user's route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "DELETE",
                        url: url + "/experiencedRoute?id=" + routeIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should delete an experienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        method: "DELETE",
                        url: url + "/experiencedRoute?id=" + routeIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }, (error2, response2, body2) => {
                            expect(response2.statusCode).to.equal(404, "Expected 404 response but got " +
                                response2.statusCode + ", body returned is: " + JSON.stringify(body2) +
                                ". This means the route was not deleted");
                            done();
                        });
                    });
                });
                it("should delete any routes belonging to a user, when a user is deleted", done => {
                    // Should delete routeIds[2], which we setup in beforeAll
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "DELETE",
                        url: url + "/user?id=" + userIds[2],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[2],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[2],
                        }, (error2, response2, body2) => {
                            expect(response2.statusCode).to.equal(403, "Expected 403 response but got " +
                                response2.statusCode + ", body returned is: " + JSON.stringify(body2) +
                                ". This means the user was not deleted");
                            done();
                        });
                    });
                });
            });
        });
        describe("Inexperienced Routes", () => {
            before(done => {
                // Create another test user (userIds[3])
                const user = { email: "test3@example.com", name: "Test User4", password: "test" };
                defaultRequest({
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                }, (error, response, body) => {
                    userIds.push(parseInt(body.result.id, 10));
                    userJwts.push(body.result.jwt.token);
                    done();
                });
            });
            describe("Creation", () => {
                it("should create inexperienced routes", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + error + " body is " + JSON.stringify(body));
                        expect(typeof body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof body);
                        expect(parseInt(body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                            "Full response body is: " + JSON.stringify(body));
                        inexperiencedRouteIds.push(parseInt(body.result.id, 10));
                        done();
                    });
                });
                it("should not create inexperienced route with invalid auth", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer foobar",
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not create inexperienced route with no auth", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {},
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not create inexperienced route with invalid radius", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Radius must be positive");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not create inexperienced route with invalid startPoint (3D)", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not create inexperienced route with invalid startPoint (1D)", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not create inexperienced route with invalid endPoint (3D)", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15, 15],
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not create inexperienced route with invalid endPoint (1D)", done => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15],
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
            });
            describe("Retrieval", () => {
                it("should get an inexperiencedRoute by a valid id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.result.length).to.equal(1);
                        expect(body.result[0].owner).to.equal(userIds[3],
                            "Inexperienced route belongs to another user." +
                            "Expected owner to be " + userIds[3] + ", but it was " + body.result.owner +
                            ". Full response body is: " + JSON.stringify(body));
                        done();
                    });
                });
                it("should not get an experienced route by an invalid id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute?id=-1",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Inexperienced Route doesn't exist");
                        expect(body.status).to.equal(404);
                        done();
                    });
                });
                it("should not get an inexperienced route with no auth", done => {
                    defaultRequest({
                        headers: {},
                        method: "GET",
                        url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
            });
            describe("Querying against Routes", () => {
                let routeId;
                let shouldMatchId;
                let shouldNotMatchId;
                before("set up an experienced route and two inexperienced routes that do and don't match it", done => {
                    // Set up a long straight route that is easy to reason about
                    // Then set up an inexperienced route that should match this route,
                    // and one that shouldn't
                    const route = new ExperiencedRoute({
                        arrivalTime: "13:15:00+00",
                        days: ["tuesday", "friday", "sunday"],
                        departureTime: "12:15:00+00",
                        owner: userIds[3],
                        route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                    });
                    const matchingInexperiencedRoute = {
                        arrivalDateTime: "2017-06-02T12:00:00+00",
                        endPoint: [0, 4.8],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [0, 1.3],
                    };
                    const nonMatchingInexperiencedRoute = {
                        arrivalDateTime: "2017-06-02T12:00:00+00",
                        endPoint: [0, 1.5],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [0, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: route,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    }, (error, response, body) => {
                        if (response.statusCode !== 201) {
                            logger.error("Error while setting up the route to test route matching");
                            throw error || body;
                        } else {
                            routeIds.push(body.result.id);
                            routeId = body.result.id;
                            defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + userJwts[3],
                                },
                                json: matchingInexperiencedRoute,
                                method: "PUT",
                                url: url + "/inexperiencedRoute",
                            }, (error2, response2, body2) => {
                                if (response2.statusCode !== 201) {
                                    logger.error("Error while setting up the (matching) inexperienced route to " +
                                        "test route matching");
                                    throw error2 || body2;
                                } else {
                                    shouldMatchId = body2.result.id;
                                    defaultRequest({
                                        headers: {
                                            Authorization: "Bearer " + userJwts[3],
                                        },
                                        json: nonMatchingInexperiencedRoute,
                                        method: "PUT",
                                        url: url + "/inexperiencedRoute",
                                    }, (error3, response3, body3) => {
                                        if (response3.statusCode !== 201) {
                                            logger.error("Error while setting up the (non-matching) " +
                                                "inexperienced route to test route matching");
                                            throw error3 || body3;
                                        } else {
                                            shouldNotMatchId = body3.result.id;
                                            done();
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
                it("should match with a matching inexperienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                            "results, body is: " + JSON.stringify(body));
                        const thisRoute = body.result.filter((route) => {
                            return route.id === routeId;
                        })[0];
                        expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                            JSON.stringify(body.result));
                        done();
                    });
                });
                it("should give an empty list with a non matching inexperienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldNotMatchId,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.result instanceof Array).to.equal(true, "body.result is not a list of " +
                            "results, body is: " + JSON.stringify(body));
                        const routes = body.result.filter((route) => {
                            return route.id === routeId;
                        });
                        expect(routes.length).to.equal(0, "Route was matched. Results were " +
                            JSON.stringify(body.result));
                        done();
                    });
                });
                it("should err with no auth", done => {
                    defaultRequest({
                        headers: {},
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should err with someone elses inexperienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should err with no id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid ID");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
            });
            describe("Updating", () => {
                it("should handle an empty update", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        done();
                    });
                });
                it("should update all properties at once", done => {
                    const updates = {
                        arrivalDateTime: "2000-01-01T13:30:00+00",
                        endPoint: [14, 14],
                        id: inexperiencedRouteIds[0],
                        notifyOwner: true,
                        radius: 1500,
                        startPoint: [11, 11],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(
                                moment(inexperiencedRoute.arrivalDateTime).isSame(updates.arrivalDateTime)
                            ).to.be.true;
                            expect(inexperiencedRoute.endPoint).to.eql(updates.endPoint);
                            expect(inexperiencedRoute.notifyOwner).to.equal(updates.notifyOwner);
                            expect(inexperiencedRoute.radius).to.equal(updates.radius);
                            expect(inexperiencedRoute.startPoint).to.eql(updates.startPoint);
                            done();
                        });
                    });
                });
                it("should update one property at a time - arrivalDateTime", done => {
                    const updates = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        id: inexperiencedRouteIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(
                                moment(inexperiencedRoute.arrivalDateTime).isSame(updates.arrivalDateTime)
                            ).to.be.true;
                            done();
                        });
                    });
                });
                it("should update one property at a time - radius", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        radius: 1000,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.radius).to.equal(updates.radius);
                            done();
                        });
                    });
                });
                it("should update one property at a time - notifyOwner", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        notifyOwner: false,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.notifyOwner).to.equal(updates.notifyOwner);
                            done();
                        });
                    });
                });
                it("should update one property at a time - endPoint", done => {
                    const updates = {
                        endPoint: [15, 15],
                        id: inexperiencedRouteIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.endPoint).to.eql(updates.endPoint);
                            done();
                        });
                    });
                });
                it("should update one property at a time - startPoint", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.startPoint).to.eql(updates.startPoint);
                            done();
                        });
                    });
                });
                it("should not update owner", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        owner: -10,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.owner).not.to.equal(updates.owner);
                            done();
                        });
                    });
                });
                it("should not update with bad auth", done => {
                    const updates = {
                        arrivalDateTime: "2000-01-01T13:30:00+00",
                        endPoint: [14, 14],
                        id: inexperiencedRouteIds[0],
                        notifyOwner: true,
                        radius: 1500,
                        startPoint: [11, 11],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            let inexperiencedRoute;
                            expect(body2.result.length).to.equal(1);
                            try {
                                inexperiencedRoute = new InexperiencedRoute(body2.result[0]);
                            } catch (err) {
                                assert.fail(0, 1, "Update resulted in an invalid InexperiencedRoute: " +
                                    err).and.notify(done);
                            }
                            expect(inexperiencedRoute.arrivalDateTime).not.to.equal(updates.arrivalDateTime);
                            expect(inexperiencedRoute.endPoint).not.to.eql(updates.endPoint);
                            expect(inexperiencedRoute.notifyOwner).not.to.equal(updates.notifyOwner);
                            expect(inexperiencedRoute.radius).not.to.equal(updates.radius);
                            expect(inexperiencedRoute.startPoint).not.to.eql(updates.startPoint);
                            done();
                        });
                    });
                });
                it("should not update with invalid radius", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        radius: -1500,
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.error).to.equal("Radius must be positive");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not update with invalid startPoint (3D)", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10, 10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not update with invalid startPoint (1D)", done => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not update with invalid endPoint (3D)", done => {
                    const updates = {
                        endPoint: [10, 10, 10],
                        id: inexperiencedRouteIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
                it("should not update with invalid endPoint (1D)", done => {
                    const updates = {
                        endPoint: [10],
                        id: inexperiencedRouteIds[0],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + error);
                        expect(body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(body.status).to.equal(400);
                        done();
                    });
                });
            });
            describe("Deleting", () => {
                before(done => {
                    // Make a new inexperienced route (inexperiencedRouteIds[1])
                    const inexperiencedRoute = {
                        arrivalTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }, (error, response, body) => {
                        inexperiencedRouteIds.push(body.result);
                        done();
                    });
                });
                it("should not delete an inexperienced route with an invalid id", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/inexperiencedRoute?id=" + -1,
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(404, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Inexperienced Route doesn't exist");
                        expect(body.status).to.equal(404);
                        done();
                    });
                });
                it("should not delete an inexperienced route with no auth", done => {
                    defaultRequest({
                        method: "DELETE",
                        url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should not be able to delete another user's inexperienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "DELETE",
                        url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(403, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(body));
                        expect(body.error).to.equal("Invalid authorization");
                        expect(body.status).to.equal(403);
                        done();
                    });
                });
                it("should delete an inexperienced route", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        }, (error2, response2, body2) => {
                            expect(response2.statusCode).to.equal(404, "Expected 404 response but got " +
                                response2.statusCode + ", body returned is: " + JSON.stringify(body2) +
                                ". This means the inexperiencedRoute was not deleted");
                            done();
                        });
                    });
                });
                it("should delete a user's inexperienced routes when that user is deleted", done => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/user?id=" + userIds[3],
                    }, (error, response, body) => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + error);
                        defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[1],
                        }, (error2, response2, body2) => {
                            expect(response2.statusCode).to.equal(403, "Expected 403 response but got " +
                                response2.statusCode + ", body returned is: " + JSON.stringify(body2) +
                                ". This means the inexperiencedRoute was not deleted");
                            done();
                        });
                    });
                });
            });
        });
    });
});
