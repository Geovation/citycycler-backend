import * as CloudStorage from "./common/cloudstorage";
import ExperiencedRoute from "./common/ExperiencedRouteDataModel";
import InexperiencedRoute from "./common/InexperiencedRouteDataModel";
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import { senecaReady } from "./microservices-framework/web/services";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as moment from "moment";
import * as rp from "request-promise-native";
import * as retryRequest from "retry-request";
import * as logger from "winston";

const expect = chai.expect;
const assert = chai.assert;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;

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

const deleteE2EUsers = (url): Promise<Boolean> => {
    return defaultRequest({
        method: "GET",
        url: url + "/clearE2EObjects",
    }).then(response => {
        if (response.statusCode !== 200) {
            logger.error("Got error when trying to delete the e2e test users: " + JSON.stringify(response));
        }
        return true;
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
        it("should resolve with a 200", () => {
            return defaultRequest({
                url,
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + JSON.stringify(response));
            });
        });
        it("should have CORS enabled", () => {
            rp({
                headers: {
                    Origin: "https://www.example.com",
                },
                json: true,
                resolveWithFullResponse: true,
                url,
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error + " body returned is: " +
                    JSON.stringify(response.body));
                expect(response.headers["access-control-allow-origin"]).to.equal("*");
            });
        });
        it("should have a valid Swagger schema", () => {
            return defaultRequest({
                url: "http://online.swagger.io/validator/debug?url=" +
                "https://matchmyroute-backend.appspot.com/swagger.json",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + JSON.stringify(response));
                expect(response.body).to.eql({}, "Got swagger validation errors: " + JSON.stringify(response.body));
            });
        });
        describe("Users", () => {
            describe("Creation", () => {
                it("should create a new user", () => {
                    const user = { email: "test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "test" };
                    return defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + JSON.stringify(response));
                        expect(typeof response.body).to.equal("object", "Body is of unexpected type");
                        expect(typeof response.body.result).to.equal("object", "Result is of unexpected type. Got " +
                            JSON.stringify(response.body));
                        expect(parseInt(response.body.result.id, 10)).to.not.be.NaN;
                        expect(response.body.result.jwt, "JWT has no token: "
                            + JSON.stringify(response.body.result)).to.have.property("token")
                            .that.is.a("string", "JWT token is not a string, it's a " +
                            (typeof response.body.result.jwt.token) + ", here is the JWT: " +
                             JSON.stringify(response.body.result.jwt));
                        expect(response.body.result.jwt, "JWT has no expires: "
                            + JSON.stringify(response.body.result)).to.have.property("expires")
                            .that.is.a("number", "JWT expires is not a number, it's a " +
                            (typeof response.body.result.jwt.expires) + ", here is the JWT " +
                            JSON.stringify(response.body.result.jwt));

                        userIds.push(parseInt(response.body.result.id, 10));
                        userJwts.push(response.body.result.jwt.token);
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
                    }).then(response => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + JSON.stringify(response));
                        expect(typeof response.body).to.equal("object", "Body is of unexpected type");
                        expect(typeof response.body.result).to.equal("object", "Result is of unexpected type. Got " +
                            JSON.stringify(response.body));
                        expect(parseInt(response.body.result.id, 10)).to.not.be.NaN;
                        expect(response.body.result.jwt, "JWT has no token: "
                            + JSON.stringify(response.body.result)).to.have.property("token")
                            .that.is.a("string", "JWT token is not a string, it's a " +
                            (typeof response.body.result.jwt.token) + ", here is the JWT: " +
                            JSON.stringify(response.body.result.jwt));
                        expect(response.body.result.jwt, "JWT has no expires: "
                            + JSON.stringify(response.body.result)).to.have.property("expires")
                            .that.is.a("number", "JWT expires is not a number, it's a " +
                            (typeof response.body.result.jwt.expires) + ", here is the JWT " +
                            JSON.stringify(response.body.result.jwt));
                        expect(response.body.result.profileImage).to.be.a.string;

                        userIds.push(parseInt(response.body.result.id, 10));
                        userJwts.push(response.body.result.jwt.token);
                        return response.body.result.profileImage;
                    }).then(imgUrl => {
                        // check if photo exists in cloud storage
                        retryRequest({
                            json: true,
                            method: "GET",
                            retries: 10,
                            shouldRetryFn: httpMessage => {
                                return httpMessage.statusMessage !== "OK";
                            },
                            url: imgUrl,
                        }, (error, response, body) => {
                            expect(response.statusCode).to.equal(200, "Image doesn't exist in Cloud Storage");
                            done();
                        });
                    });
                });
                it("shouldn't create a user with no name", () => {
                    const user = { email: "test2@e2e-test.matchmyroute-backend.appspot.com",
                        name: "", password: "test" };
                    return defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Name Required");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("shouldn't create a user with no email", () => {
                    const user = { email: "", name: "E2E Test User", password: "test" };
                    return defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Email Required");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("shouldn't create a user with no password", () => {
                    const user = { email: "test3@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "" };
                    return defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Password Required");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("shouldn't create a user with a duplicate email", () => {
                    const user = { email: "test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "E2E Test User", password: "test" };
                    return defaultRequest({
                        json: user,
                        method: "PUT",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("An account already exists using this email");
                        expect(response.body.status).to.equal(409);
                    });
                });
            });
            describe("Getting", () => {
                it("should get a user by a valid id", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/user?id=" + userIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.result.name).to.equal("E2E Test User",
                            "Got a different name than expected. Expected: \"E2E Test User\", got \"" +
                            response.body.result.name + "\". Full response body is: " + JSON.stringify(response.body));
                        expect(response.body.result.preferences).to.not.be.undefined;
                    });
                });
                it("should get the JWT user when called with no id", () => {
                    defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.result.name).to.equal("E2E Test User",
                            "Got a different name than expected. Expected: \"E2E Test User\", got \"" +
                            response.body.result.name + "\". Full response body is: " +
                            JSON.stringify(response.body));
                        expect(response.body.result.preferences).to.not.be.undefined;
                    });
                });
                it("should not get a user if auth is missing", () => {
                    return defaultRequest({
                        method: "GET",
                        url: url + "/user?id=" + userIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Invalid authorization");
                        expect(response.body.status).to.equal(403);
                    });
                });
                it("should get a user if auth is for another user, but should not have the preferences", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        method: "GET",
                        url: url + "/user?id=" + userIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.result.name).to.equal("E2E Test User",
                            "Expected result name to be \"E2E Test User\", but it got \""
                            + response.body.result.name +
                            "\". Full response body is: " + JSON.stringify(response.body));
                        expect(response.body.result.preferences).to.be.undefined;
                    });
                });
                it("should not get a user if the id is invalid", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "GET",
                        url: url + "/user?id=" + -1,
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("User doesn't exist");
                        expect(response.body.status).to.equal(404);
                    });
                });
            });
            describe("Updating", () => {
                it("should update a user", done => {
                    let photoName;
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
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.name).to.equal("Updated Test User");
                        expect(user.email).to.equal("updatedtest@e2e-test.matchmyroute-backend.appspot.com");
                        expect(user.bio).to.equal("Updated bio");
                        expect(user.photo).to.equal(CloudStorage.createFilenameForUser(userIds[0]));
                        photoName = user.photo;
                        // Test password change by logging in with the new password
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            json: {
                                email: "updatedtest@e2e-test.matchmyroute-backend.appspot.com",
                                password: "updatedtest",
                            },
                            method: "POST",
                            url: url + "/auth/user",
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 login response: " +
                            JSON.stringify(response));
                        // check if photo exists in cloud storage
                        const imgUrl = process.env.STORAGE_BASE_URL +
                        "/" +
                        process.env.STORAGE_BUCKET +
                        "/" +
                        photoName;
                        retryRequest({
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
                        });
                    });
                });
                it("should not update a user without auth", () => {
                    const userUpdates = {
                        email: "updated2test@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Updated2 Test User", password: "updated2test",
                    };
                    return defaultRequest({
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Invalid authorization");
                        expect(response.body.status).to.equal(403);
                    });
                });
                it("should not update a user to an extant email", () => {
                    const userUpdates = {
                        email: "test1@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Updated2 Test User", password: "updated2test",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("An account already exists using this email");
                        expect(response.body.status).to.equal(409);
                    });
                });
                it("should update a user's individual properties - name", () => {
                    const userUpdates = {
                        name: "E2E Test User",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.name).to.equal("E2E Test User");
                    });
                });
                it("should update a user's individual properties - email", () => {
                    const userUpdates = {
                        email: "test@e2e-test.matchmyroute-backend.appspot.com",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.email).to.equal("test@e2e-test.matchmyroute-backend.appspot.com");
                    });
                });
                it("should update a user's individual properties - password", () => {
                    const userUpdates = {
                        password: "test",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        // Test by logging in with the new password
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            json: {
                                email: "test@e2e-test.matchmyroute-backend.appspot.com",
                                password: "test",
                            },
                            method: "POST",
                            url: url + "/auth/user",
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 login response: " +
                            JSON.stringify(response));
                    });
                });
                it("should update a user's individual properties - bio", () => {
                    const userUpdates = {
                        bio: "Bio",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.bio).to.equal("Bio");
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
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
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
                            }, (error, response2, body) => {
                                expect(response2.statusCode).to.equal(200, "Image doesn't exist in Cloud Storage");
                                done();
                            }
                        );
                    });
                });
                it("should update a user's individual properties - photo (removal)", () => {
                    const userUpdates = {
                        photo: null,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.photo).to.be.null;
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
                it("should update a user's individual properties - preferences", () => {
                    const userUpdates = {
                        preferences: {
                            rideDifficulty: "fast",
                            units: "kilometers",
                        },
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                             JSON.stringify(response));
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user?id=" + userIds[0],
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.preferences.rideDifficulty).to.equal("fast");
                        expect(user.preferences.units).to.equal("kilometers");
                    });
                });
                it("should not update helped count", () => {
                    const userUpdates = {
                        helpedCount: 999,
                        profile_helped_count: 999,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update users helped count", () => {
                    const userUpdates = {
                        profile_help_count: 999,
                        usersHelped: 999,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update users rating", () => {
                    const userUpdates = {
                        profile_rating_sum: 999,
                        rating: 10,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update users distance", () => {
                    const userUpdates = {
                        distance: 100000,
                        profile_distance: 100000,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update joined date", () => {
                    const userUpdates = {
                        joined: 100,
                        profile_joined: 100,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update password hash directly", () => {
                    const userUpdates = {
                        pwh: new Buffer("updated"),
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update password rounds directly", () => {
                    const userUpdates = {
                        rounds: 999,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
                it("should not update salt", () => {
                    const userUpdates = {
                        salt: new Buffer("notsosalty"),
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        json: userUpdates,
                        method: "POST",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Got non 400 response: " + JSON.stringify(response));
                    });
                });
            });
            describe("Deletion", () => {
                it("should not delete a user with a no auth", () => {
                    return defaultRequest({
                        method: "DELETE",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Invalid authorization");
                        expect(response.body.status).to.equal(403);
                    });
                });
                it("should let a user delete themself", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[0],
                        },
                        method: "DELETE",
                        url: url + "/user",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                    });
                });
            });
            describe("Authentication", () => {
                describe("Initial", () => {
                    it("should provide a JWT", () => {
                        const auth = { email: "test1@e2e-test.matchmyroute-backend.appspot.com", password: "test" };
                        return defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error);
                            expect(response.body.result, "JWT has no token: "
                                + JSON.stringify(response.body.result)).to.have.property("token")
                                .that.is.a("string", "JWT token is not a string, it's a " +
                                (typeof response.body.result.token) + ", here is the JWT: " +
                                JSON.stringify(response.body.result));
                            expect(response.body.result, "JWT has no expires: "
                                + JSON.stringify(response.body.result)).to.have.property("expires")
                                .that.is.a("number", "JWT expires is not a number, it's a " +
                                (typeof response.body.result.expires) + ", here is the JWT " +
                                JSON.stringify(response.body.result));
                        });
                    });
                    it("should not provide a JWT if the password is incorrect", () => {
                        const auth = { email: "test1@e2e-test.matchmyroute-backend.appspot.com", password: "iforgot" };
                        return defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                            expect(response.body.error).to.equal("Incorrect Password");
                            expect(response.body.status).to.equal(403);
                        });
                    });
                    it("should not provide a JWT if the email doesn't exist", () => {
                        const auth = { email: "test@e2e-test.matchmyroute-backend.appspot.com", password: "test" };
                        return defaultRequest({
                            json: auth,
                            method: "POST",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                            expect(response.body.error).to.equal("Incorrect Password");
                            expect(response.body.status).to.equal(403);
                        });
                    });
                });
                describe("Subsequent", () => {
                    it("should provide a JWT", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error);
                            expect(response.body.result, "JWT has no token: " +
                                JSON.stringify(response.body.result)).to.have.property("token")
                                .that.is.a("string", "JWT token is not a string, it's a " +
                                (typeof response.body.result.token) + ", here is the JWT: " +
                                JSON.stringify(response.body.result));
                            expect(response.body.result, "JWT has no expires: " +
                                JSON.stringify(response.body.result)).to.have.property("expires")
                                .that.is.a("number", "JWT expires is not a number, it's a " +
                                (typeof response.body.result.expires) + ", here is the JWT " +
                                JSON.stringify(response.body.result));
                        });
                    });
                    it("should not provide a JWT if there is no auth", () => {
                        return defaultRequest({
                            method: "GET",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                            expect(response.body.error).to.equal("Invalid authorization");
                            expect(response.body.status).to.equal(403);
                        });
                    });
                    it("should not provide a JWT if there is invalid auth", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[0],
                            },
                            method: "GET",
                            url: url + "/user/auth",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                            expect(response.body.error).to.equal("Invalid authorization");
                            expect(response.body.status).to.equal(403);
                        });
                    });
                });
            });
        });
        describe("ExperiencedRoutes", () => {
            before(() => {
                // Create another test user (userIds[2])
                const user = { email: "test2@e2e-test.matchmyroute-backend.appspot.com",
                    name: "E2E Test User3", password: "test" };
                return defaultRequest({
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                }).then(response => {
                    userIds.push(parseInt(response.body.result.id, 10));
                    userJwts.push(response.body.result.jwt.token);
                });
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
                            Authorization: "Bearer " + userJwts[1],
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
                        routeIds.push(parseInt(response.body.result.id, 10));
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
                            Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[0],
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
                            Authorization: "Bearer " + userJwts[1],
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
                    it("should get an experienced route by a valid id with no auth", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error);
                            expect(response.body.result.length).to.equal(1);
                            expect(response.body.result[0].owner).to.equal(userIds[1],
                                "Route belongs to another user. Expected owner to be " +
                                userIds[1] + ", but it was " + response.body.result.owner +
                                ". Full response body is: " + JSON.stringify(response.body));
                        });
                    });
                    it("should not get an experienced route by an invalid id", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + -1,
                        }).then(response => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                                response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                            expect(response.body.error).to.equal("ExperiencedRoute doesn't exist");
                            expect(response.body.status).to.equal(404);
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
                            owner: userIds[1],
                            route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                            startPointName: "122 Stanley Street",
                        });
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                                Authorization: "Bearer " + userJwts[1],
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
                            expect(thisRoute.name).to.equal("Ride to work");
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
                                Authorization: "Bearer " + userJwts[1],
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
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                        expect(route.owner).to.equal(userIds[1]);
                    });
                });
                it("should not be able to update route", () => {
                    const updates = {
                        id: routeIds[0],
                        route: [[5, 5], [7, 7]],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/experiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[2],
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
                    // Set up another route belonging to userIds[2]
                    const route = new ExperiencedRoute({
                        arrivalTime: "14:00:00+00",
                        departureTime: "13:00:00+00",
                        endPointName: "33 Rachel Road",
                        length: 5000,
                        name: "Ride to work",
                        owner: userIds[2],
                        route: [[0, 0], [1, 0], [1, 1]],
                        startPointName: "112 Stanley Street",
                    });
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
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
                            Authorization: "Bearer " + userJwts[1],
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
                            Authorization: "Bearer " + userJwts[2],
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
                it("should delete an experienced route", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[1],
                        },
                        method: "DELETE",
                        url: url + "/experiencedRoute?id=" + routeIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[1],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[0],
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                            ". This means the route was not deleted");
                    });
                });
                it("should delete any routes belonging to a user, when a user is deleted", () => {
                    // Should delete routeIds[2], which we setup in beforeAll
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "DELETE",
                        url: url + "/user?id=" + userIds[2],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[2],
                            },
                            method: "GET",
                            url: url + "/experiencedRoute?id=" + routeIds[2],
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                        response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                        ". This means the user was not deleted");
                    });
                });
            });
        });
        describe("Inexperienced Routes", () => {
            before(() => {
                // Create another test user (userIds[3])
                const user = {
                    email: "test3@e2e-test.matchmyroute-backend.appspot.com",
                    name: "Test User4",
                    password: "test",
                };
                return defaultRequest({
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                }).then(response => {
                    userIds.push(parseInt(response.body.result.id, 10));
                    userJwts.push(response.body.result.jwt.token);
                });
            });
            describe("Creation", () => {
                it("should create inexperienced routes", () => {
                    const inexperiencedRoute = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer foobar",
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
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
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
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                        notifyOwner: false,
                        radius: -500,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                it("should get an inexperiencedRoute by a valid id", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.result.length).to.equal(1);
                        expect(response.body.result[0].owner).to.equal(userIds[3],
                            "Inexperienced route belongs to another user." +
                            "Expected owner to be " + userIds[3] + ", but it was " + response.body.result.owner +
                            ". Full response body is: " + JSON.stringify(response.body));
                    });
                });
                it("should not get an experienced route by an invalid id", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute?id=-1",
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Inexperienced Route doesn't exist");
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
                let shouldMatchId;
                let shouldNotMatchId;
                before("set up an experienced route and two inexperienced routes that do and don't match it", () => {
                    // Set up a long straight route that is easy to reason about
                    // Then set up an inexperienced route that should match this route,
                    // and one that shouldn't
                    const route = new ExperiencedRoute({
                        arrivalTime: "13:15:00+00",
                        days: ["tuesday", "friday", "sunday"],
                        departureTime: "12:15:00+00",
                        endPointName: "33 Rachel Road",
                        length: 5000,
                        name: "Ride to work",
                        owner: userIds[3],
                        route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                        startPointName: "112 Stanley Street",
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
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
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
                                    Authorization: "Bearer " + userJwts[3],
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
                                    Authorization: "Bearer " + userJwts[3],
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
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
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
                it("should give an empty list with a non matching inexperienced route", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldNotMatchId,
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
                it("should err with no auth", () => {
                    return defaultRequest({
                        headers: {},
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
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
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id=" + shouldMatchId,
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Invalid authorization");
                        expect(response.body.status).to.equal(403);
                    });
                });
                it("should err with no id", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "GET",
                        url: url + "/inexperiencedRoute/query?id",
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
                            Authorization: "Bearer " + userJwts[3],
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
                        endPoint: [14, 14],
                        id: inexperiencedRouteIds[0],
                        notifyOwner: true,
                        radius: 1500,
                        startPoint: [11, 11],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                        expect(inexperiencedRoute.endPoint).to.eql(updates.endPoint);
                        expect(inexperiencedRoute.notifyOwner).to.equal(updates.notifyOwner);
                        expect(inexperiencedRoute.radius).to.equal(updates.radius);
                        expect(inexperiencedRoute.startPoint).to.eql(updates.startPoint);
                    });
                });
                it("should update one property at a time - arrivalDateTime", () => {
                    const updates = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        id: inexperiencedRouteIds[0],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                it("should update one property at a time - endPoint", () => {
                    const updates = {
                        endPoint: [15, 15],
                        id: inexperiencedRouteIds[0],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                        expect(inexperiencedRoute.endPoint).to.eql(updates.endPoint);
                    });
                });
                it("should update one property at a time - startPoint", () => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                        expect(inexperiencedRoute.startPoint).to.eql(updates.startPoint);
                    });
                });
                it("should not update owner", () => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        owner: -10,
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                            Authorization: "Bearer " + userJwts[1],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
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
                            Authorization: "Bearer " + userJwts[3],
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
                it("should not update with invalid startPoint (3D)", () => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10, 10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("should not update with invalid startPoint (1D)", () => {
                    const updates = {
                        id: inexperiencedRouteIds[0],
                        startPoint: [10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.error).to.equal("InexperiencedRoute requires a 2D start point");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("should not update with invalid endPoint (3D)", () => {
                    const updates = {
                        endPoint: [10, 10, 10],
                        id: inexperiencedRouteIds[0],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(response.body.status).to.equal(400);
                    });
                });
                it("should not update with invalid endPoint (1D)", () => {
                    const updates = {
                        endPoint: [10],
                        id: inexperiencedRouteIds[0],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: updates,
                        method: "POST",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        expect(response.body.error).to.equal("InexperiencedRoute requires a 2D end point");
                        expect(response.body.status).to.equal(400);
                    });
                });
            });
            describe("Deleting", () => {
                before(() => {
                    // Make a new inexperienced route (inexperiencedRouteIds[1])
                    const inexperiencedRoute = {
                        arrivalTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        json: inexperiencedRoute,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    }).then(response => {
                        inexperiencedRouteIds.push(response.body.result);
                    });
                });
                it("should not delete an inexperienced route with an invalid id", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/inexperiencedRoute?id=" + -1,
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 403 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Inexperienced Route doesn't exist");
                        expect(response.body.status).to.equal(404);
                    });
                });
                it("should not delete an inexperienced route with no auth", () => {
                    return defaultRequest({
                        method: "DELETE",
                        url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[0],
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
                            Authorization: "Bearer " + userJwts[2],
                        },
                        method: "DELETE",
                        url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 404 response but got " +
                            response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                        expect(response.body.error).to.equal("Invalid authorization");
                        expect(response.body.status).to.equal(403);
                    });
                });
                it("should delete an inexperienced route", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/InexperiencedRoute?id=" + inexperiencedRouteIds[0],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                        response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[0],
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                        response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                        ". This means the inexperiencedRoute was not deleted");
                    });
                });
                it("should delete a user's inexperienced routes when that user is deleted", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + userJwts[3],
                        },
                        method: "DELETE",
                        url: url + "/user?id=" + userIds[3],
                    }).then(response => {
                        expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + userJwts[3],
                            },
                            method: "GET",
                            url: url + "/inexperiencedRoute?id=" + inexperiencedRouteIds[1],
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                        response.statusCode + ", body returned is: " + JSON.stringify(response.body) +
                        ". This means the inexperiencedRoute was not deleted");
                    });
                });
            });
        });
        describe("Buddy Requests", () => {
            let i = 4;      // We keep track of this to decide what the email address of each user should be. Yuck.
            let expUserId;  // The experienced User id
            let expUserJwt;  // The experienced User token
            let experiencedRoute;   // The experienced Route
            let inexpUserId;  // The inexperienced User id
            let inexpUserJwt;  // The inexperienced User token
            let inexperiencedRoute; // The inexperienced Route
            let randomUserJwt;  // A token for a user unconnected to these buddy requests
            let buddyRequestObject; // A BuddyRequest object with the ids all set correctly
            before("Create 3 test users with respective routes", () => {
                // The random user
                const user1 = {
                    email: "test" + i + "@e2e-test.matchmyroute-backend.appspot.com",
                    name: "Random Test User",
                    password: "test",
                };
                return defaultRequest({
                    json: user1,
                    method: "PUT",
                    url: url + "/user",
                }).then(response => {
                    randomUserJwt = response.body.result.jwt.token;
                    // The inexperienced User
                    const user2 = {
                        email: "test" + (i + 1) + "@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Inexperienced Test User",
                        password: "test",
                    };
                    return defaultRequest({
                        json: user2,
                        method: "PUT",
                        url: url + "/user",
                    });
                }).then(response => {
                    inexpUserId = parseInt(response.body.result.id, 10);
                    inexpUserJwt = response.body.result.jwt.token;
                    // The experienced User
                    const user3 = {
                        email: "test" + (i + 2) + "@e2e-test.matchmyroute-backend.appspot.com",
                        name: "Experienced Test User",
                        password: "test",
                    };
                    return defaultRequest({
                        json: user3,
                        method: "PUT",
                        url: url + "/user",
                        });
                }).then(response => {
                    expUserId = parseInt(response.body.result.id, 10);
                    expUserJwt = response.body.result.jwt.token;
                    // The inexperienced Route
                    const route1 = {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: route1,
                        method: "PUT",
                        url: url + "/inexperiencedRoute",
                    });
                }).then(response => {
                    inexperiencedRoute = parseInt(response.body.result.id, 10);
                    // The experienced Route
                    const route2 = {
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
                            Authorization: "Bearer " + expUserJwt,
                        },
                        json: route2,
                        method: "PUT",
                        url: url + "/experiencedRoute",
                    });
                }).then(response => {
                    experiencedRoute = parseInt(response.body.result.id, 10);
                    buddyRequestObject = {
                        averageSpeed: 5,
                        divorcePoint: [1, 1],
                        divorcePointName: "32 Shelly Street",
                        divorceTime: "2017-06-08T12:00:28.684Z",
                        experiencedRoute,
                        experiencedRouteName: "Ride to work",
                        experiencedUser: expUserId,
                        inexperiencedRoute,
                        meetingPoint: [0, 0],
                        meetingPointName: "64 Ryan Road",
                        meetingTime: "2017-06-08T11:34:28.684Z",
                        route: [[0, 0], [0.5, 0.5], [1, 1]],
                    };
                });
            });
            describe("Creation", () => {
                it("should create a BuddyRequest", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        expect(response.statusCode).to.equal(201, "Expected 201 response but got " +
                            response.statusCode + ", error given is: " + response.error + " body is " +
                            response.body);
                        expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof response.body);
                        expect(parseInt(response.body.result, 10)).to.not.equal(NaN, "The returned ID is NaN. " +
                            "Full response body is: " + JSON.stringify(response.body));
                    });
                });
                it("should not create a BuddyRequest with no auth", () => {
                    return defaultRequest({
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                    });
                });
                it("should not create a BuddyRequest with invalid auth", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer monkey",
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                    });
                });
            });
            describe("Retrieval", () => {
                let buddyRequest1Id;
                let buddyRequest2Id;
                before("Set up 2 buddy requests from inexp user -> exp user", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        buddyRequest1Id = parseInt(response.body.result.id, 10);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + inexpUserJwt,
                            },
                            json: buddyRequestObject,
                            method: "PUT",
                            url: url + "/buddyRequest",
                        });
                    }).then(response => {
                        buddyRequest2Id = parseInt(response.body.result.id, 10);
                    });
                });
                describe("Sent Buddy Requests", () => {
                    it("should get a user's sent buddy requests", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent?id=" + buddyRequest1Id,
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof response.body);
                            let buddyRequests = response.body.result;
                            expect(buddyRequests.length).to.equal(1);
                            expect(buddyRequests[0].id).to.equal(buddyRequest1Id);
                            expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[0].divorceTime)
                                .isSame(buddyRequestObject.divorceTime)).to.be.true;
                            expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[0].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[0].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[0].meetingTime)
                                .isSame(buddyRequestObject.meetingTime)).to.be.true;
                            expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[0].owner).to.equal(inexpUserId);
                            expect(buddyRequests[0].status).to.equal("pending");
                            expect(buddyRequests[0].reason).to.equal("");
                            expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created)).to.be.true;
                        });
                    });
                    it("should get all of a user's sent buddy requests when no id is given", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent",
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof response.body);
                            let buddyRequests = response.body.result;
                            // Should get 2 from before() and 1 from the creation tests
                            expect(buddyRequests.length).to.equal(3);
                            expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[0].divorceTime)
                                .isSame(buddyRequestObject.divorceTime),
                                "Divorce time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.divorceTime) +
                                "\nActual: " + moment(buddyRequests[0].divorceTime)).to.be.true;
                            expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[0].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[0].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[0].meetingTime)
                                .isSame(buddyRequestObject.meetingTime),
                                "Meeting time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                                "\nActual: " + moment(buddyRequests[0].meetingTime)).to.be.true;
                            expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[0].owner).to.equal(inexpUserId);
                            expect(buddyRequests[0].status).to.equal("pending");
                            expect(buddyRequests[0].reason).to.equal("");
                            expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created)).to.be.true;
                            expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[1].divorceTime)
                                .isSame(buddyRequestObject.divorceTime),
                                "Divorce time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.divorceTime) +
                                "\nActual: " + moment(buddyRequests[1].divorceTime)).to.be.true;
                            expect(buddyRequests[1].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[1].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[1].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[1].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[1].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[1].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[1].meetingTime)
                                .isSame(buddyRequestObject.meetingTime),
                                "Meeting time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                                "\nActual: " + moment(buddyRequests[1].meetingTime)).to.be.true;
                            expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[1].owner).to.equal(inexpUserId);
                            expect(buddyRequests[1].status).to.equal("pending");
                            expect(buddyRequests[1].reason).to.equal("");
                            expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[1].updated).isSame(buddyRequests[1].created)).to.be.true;
                        });
                    });
                    it("should not get a user's received buddy requests from the sent endpoint", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent",
                        }).then(response => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                        });
                    });
                    it("should not get a user's sent buddy requests with no auth", () => {
                        return defaultRequest({
                            method: "GET",
                            url: url + "/buddyRequest/sent",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                        });
                    });
                    it("should not let a random user access the buddy request", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + randomUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent",
                        }).then(response => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                        });
                    });
                });
                describe("Received Buddy Requests", () => {
                    it("should get a user's received buddy requests", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/received?id=" + buddyRequest1Id,
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof response.body);
                            let buddyRequests = response.body.result;
                            expect(buddyRequests.length).to.equal(1);
                            expect(buddyRequests[0].id).to.equal(buddyRequest1Id);
                            expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[0].divorceTime)
                                .isSame(buddyRequestObject.divorceTime)).to.be.true;
                            expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[0].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[0].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[0].meetingTime)
                                .isSame(buddyRequestObject.meetingTime)).to.be.true;
                            expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[0].owner).to.equal(inexpUserId);
                            expect(buddyRequests[0].status).to.equal("pending");
                            expect(buddyRequests[0].reason).to.equal("");
                            expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created)).to.be.true;
                        });
                    });
                    it("should get all of a user's received buddy requests when no id is given", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/received",
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            expect(typeof response.body).to.equal("object", "Body is of unexpected type. " +
                            "Expected object, but got a " + typeof response.body);
                            let buddyRequests = response.body.result;
                            // Should get 2 from before() and 1 from the creation tests
                            expect(buddyRequests.length).to.equal(3);
                            expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[0].divorceTime)
                                .isSame(buddyRequestObject.divorceTime),
                                "Divorce time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.divorceTime) +
                                "\nActual: " + moment(buddyRequests[0].divorceTime)).to.be.true;
                            expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[0].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[0].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[0].meetingTime)
                                .isSame(buddyRequestObject.meetingTime),
                                "Meeting time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                                "\nActual: " + moment(buddyRequests[0].meetingTime)).to.be.true;
                            expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[0].owner).to.equal(inexpUserId);
                            expect(buddyRequests[0].status).to.equal("pending");
                            expect(buddyRequests[0].reason).to.equal("");
                            expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created)).to.be.true;
                            expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                            expect(moment(buddyRequests[1].divorceTime)
                                .isSame(buddyRequestObject.divorceTime),
                                "Divorce time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.divorceTime) +
                                "\nActual: " + moment(buddyRequests[1].divorceTime)).to.be.true;
                            expect(buddyRequests[1].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                            expect(buddyRequests[1].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                            expect(buddyRequests[1].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                            expect(buddyRequests[1].experiencedRouteName)
                                .to.equal(buddyRequestObject.experiencedRouteName);
                            expect(buddyRequests[1].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                            expect(buddyRequests[1].inexperiencedRoute)
                                .to.equal(buddyRequestObject.inexperiencedRoute);
                            expect(moment(buddyRequests[1].meetingTime)
                                .isSame(buddyRequestObject.meetingTime),
                                "Meeting time is different to expected." +
                                "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                                "\nActual: " + moment(buddyRequests[1].meetingTime)).to.be.true;
                            expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                            expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                            expect(buddyRequests[1].owner).to.equal(inexpUserId);
                            expect(buddyRequests[1].status).to.equal("pending");
                            expect(buddyRequests[1].reason).to.equal("");
                            expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                            expect(moment(buddyRequests[1].updated).isSame(buddyRequests[1].created)).to.be.true;
                        });
                    });
                    it("should not get a user's sent buddy requests from the received endpoint", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/received",
                        }).then(response => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                        });
                    });
                    it("should not get a user's sent buddy requests with no auth", () => {
                        return defaultRequest({
                            method: "GET",
                            url: url + "/buddyRequest/received",
                        }).then(response => {
                            expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                            " body is " + response.body);
                        });
                    });
                    it("should not let a random user access the buddy request", () => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + randomUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/received",
                        }).then(response => {
                            expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                        });
                    });
                });
            });
            describe("Updating", () => {
                let buddyRequestId;
                let mostRecentlyUpdated;
                before("Create a buddy request to update", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        buddyRequestId = parseInt(response.body.result.id, 10);
                        mostRecentlyUpdated = moment();
                    });
                });

                // This is a list of things that should be able to be updated
                const thingsThatCanBeUpdated = [
                    {meetingTime: "2017-06-08T10:20:28.684Z"},
                    {divorceTime: "2017-06-08T12:12:12.684Z"},
                    {meetingPoint: [0.5, 0.5]},
                    {divorcePoint: [0.6, 0.6]},
                    {meetingPointName: "32 Arthur Avenue"},
                    {divorcePointName: "64 Derek Drive"},
                    {   // All at once
                        divorcePoint: [0.7, 0.7],
                        divorcePointName: "63 Derek Drive",
                        divorceTime: "2017-07-08T12:12:12.684Z",
                        meetingPoint: [0.4, 0.4],
                        meetingPointName: "31 Arthur Avenue",
                        meetingTime: "2017-07-08T10:20:28.684Z",
                    },
                ];

                for (const updates of thingsThatCanBeUpdated) {
                    const keys = Object.keys(updates).join(", ");
                    it("should update " + keys, () => {
                        const updatesWithId = Object.assign({id: buddyRequestId}, updates);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + expUserJwt,
                            },
                            json: updatesWithId,
                            method: "POST",
                            url: url + "/buddyRequest",
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            // Get the buddyRequest we just updated
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                method: "GET",
                                url: url + "/buddyRequest/sent?id=" + buddyRequestId,
                            });
                        }).then(response => {
                            expect(response.statusCode).to.equal(200, "Expected 200 response  when " +
                            "retrieving BuddyRequest but got " + response.statusCode +
                            ", error given is: " + response.error + " body is " + response.body);
                            expect(response.body.result.length).to.equal(1, "Got too many BuddyRequests");
                            let buddyRequest = response.body.result[0];
                            for (const key in updates) {
                                if (updates.hasOwnProperty(key)) {
                                    if (key.indexOf("Time") !== -1) {
                                        expect(moment(buddyRequest[key]).isSame(updates[key])).to.be.true;
                                    } else {
                                        expect(buddyRequest[key]).to.eql(updates[key]);
                                    }
                                }
                            }
                            expect(moment(buddyRequest.updated).isAfter(mostRecentlyUpdated)).to.be.true;
                            mostRecentlyUpdated = moment(buddyRequest.updated);
                        });
                    });
                }

                // These should not be able to be updated.
                // If the error prop is undefined, the update should fail silently, and just not have cahnged anything
                // If it is a number, expect the response to be rejected with that number response
                const thingsThatCannotBeUpdated: any[] = [
                    {owner: -1},
                    {experiencedUser: -1},
                    {experiencedRoute: -1},
                    {experiencedRouteName: "A silly name!"},
                    {inexperiencedRoute: -1},
                    {averageSpeed: 200},
                    {created: "2000-01-01T12:00:00.000Z"},
                    {updated: "2000-01-01T12:00:00.000Z"},
                    {route: [[1, 1], [0.5, 0.5], [2, 2]]},
                    {status: "rejected"},
                    {reason: "Shoddy Reason"},
                    {
                        divorceTime: "2017-06-08T10:12:12.684Z",
                        error: 400,
                        meetingTime: "2017-06-08T12:20:28.684Z",
                    },
                ];

                for (const updates of thingsThatCannotBeUpdated) {
                    const updateables = _.omit(updates, ["error"]);
                    const keys = Object.keys(updateables).join(", ");
                    it("should not update " + keys, () => {
                        const updatesWithId = Object.assign({id: buddyRequestId}, updateables);
                        return defaultRequest({
                            headers: {
                                Authorization: "Bearer " + expUserJwt,
                            },
                            json: updatesWithId,
                            method: "POST",
                            url: url + "/buddyRequest",
                        }).then(response => {
                            if (updates.error) {
                                expect(response.statusCode).to.equal(updates.error, "Expected " + updates.error +
                                " response but got " + response.statusCode +
                                ", error given is: " + response.error + " body is " + response.body);
                            } else {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                                // Get the buddyRequest we just updated
                                return defaultRequest({
                                    headers: {
                                        Authorization: "Bearer " + inexpUserJwt,
                                    },
                                    method: "GET",
                                    url: url + "/buddyRequest/sent?id=" + buddyRequestId,
                                }).then(response2 => {
                                    expect(response2.statusCode).to.equal(200, "Expected 200 response  when " +
                                    "retrieving BuddyRequest but got " + response2.statusCode +
                                    ", error given is: " + response2.error + " body is " + response2.body);
                                    expect(response2.body.result.length).to.equal(1, "Got too many BuddyRequests");
                                    let buddyRequest = response2.body.result[0];
                                    for (const key in updateables) {
                                        if (updates.hasOwnProperty(key)) {
                                            if (key.indexOf("Time") !== -1) {
                                                expect(moment(buddyRequest[key]).isSame(updates[key])).to.be.false;
                                            } else {
                                                expect(buddyRequest[key]).not.to.eql(updates[key]);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });
                }

                it("should not make any updates as an inexperienced user", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: {meetingTime: "2017-06-08T10:20:28.684Z"},
                        method: "POST",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                            " body is " + response.body);
                    });
                });
            });
            describe("Updating Status", () => {
                let buddyRequestId;
                beforeEach("Create a buddy request to update", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + inexpUserJwt,
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        buddyRequestId = parseInt(response.body.result.id, 10);
                    });
                });
                describe("An experienced user", () => {
                    describe("with a 'pending' BuddyRequest", () => {
                        it("should be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            });
                        });
                        it("should be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "It's raining today",
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            });
                        });
                        it("should be able to reject it without a reason", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                response.statusCode + ", error given is: " + response.error +
                                " body is " + response.body);
                            });
                        });
                        it("should not be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "It's raining today",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't cancel a pending BuddyRequest. You should reject it instead.");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with an 'accepted' BuddyRequest", () => {
                        beforeEach("Set the status to accepted", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            });
                        });
                        it("should be able to accept it (again), updating the reason", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "Make sure you can keep up!",
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reject an accepted BuddyRequest. You should cancel it instead.");
                            });
                        });
                        it("should be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "I'm lazy", // We should really have a list of unacceptable reasons...
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to cancel it without a reason", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "A reason needs to be given to cancel a BuddyRequest");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with a 'rejected' BuddyRequest", () => {
                        beforeEach("Set the status to rejected", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            });
                        });
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't accept a rejected BuddyRequest");
                            });
                        });
                        it("should be able to reject it (again), updating the reason", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "It's raining today",
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "It's raining today",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to cancel it without a reason", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "A reason needs to be given to cancel a BuddyRequest");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with a 'canceled' BuddyRequest", () => {
                        beforeEach("Set the status to accepted, then canceled", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                const status2 = {
                                    id: buddyRequestId,
                                    reason: "Because the sky is falling",
                                    status: "canceled",
                                };
                                return defaultRequest({
                                    headers: {
                                        Authorization: "Bearer " + expUserJwt,
                                    },
                                    json: status2,
                                    method: "POST",
                                    url: url + "/buddyRequest/status",
                                });
                            });
                        });
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't accept a canceled BuddyRequest");
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reject a canceled BuddyRequest");
                            });
                        });
                        it("should be able to cancel it (again), updating the reason", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "It's raining cats and dogs!",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                });
                describe("As an inexperienced user", () => {
                    describe("with a 'pending' BuddyRequest", () => {
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can accept a BuddyRequest");
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can reject a BuddyRequest");
                            });
                        });
                        it("should be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "I changed my mind, sorry!",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to cancel it without a reason", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "A reason needs to be given to cancel a BuddyRequest");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.ody);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with an 'accepted' BuddyRequest", () => {
                        beforeEach("Set the status to accepted", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            });
                        });
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can accept a BuddyRequest");
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can reject a BuddyRequest");
                            });
                        });
                        it("should be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "Your profile picture scared me",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to cancel it without a reason", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "A reason needs to be given to cancel a BuddyRequest");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with a 'rejected' BuddyRequest", () => {
                        beforeEach("Set the status to rejected", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            });
                        });
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can accept a BuddyRequest");
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can reject a BuddyRequest");
                            });
                        });
                        it("should not be able to cancel it", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "I don't like the look of your nose",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't cancel a rejected BuddyRequest");
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                    describe("with a 'canceled' BuddyRequest", () => {
                        beforeEach("Set the status to accepted, then canceled", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + expUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                const status2 = {
                                    id: buddyRequestId,
                                    reason: "Because the sky is falling",
                                    status: "canceled",
                                };
                                return defaultRequest({
                                    headers: {
                                        Authorization: "Bearer " + expUserJwt,
                                    },
                                    json: status2,
                                    method: "POST",
                                    url: url + "/buddyRequest/status",
                                });
                            });
                        });
                        it("should not be able to accept it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "accepted",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can accept a BuddyRequest");
                            });
                        });
                        it("should not be able to reject it", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "rejected",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(403, "Expected 403 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Only the experienced cyclist can reject a BuddyRequest");
                            });
                        });
                        it("should be able to cancel it (again), updating the reason", () => {
                            const status = {
                                id: buddyRequestId,
                                reason: "You ride too fast for me",
                                status: "canceled",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                            });
                        });
                        it("should not be able to reset it to pending", () => {
                            const status = {
                                id: buddyRequestId,
                                status: "pending",
                            };
                            return defaultRequest({
                                headers: {
                                    Authorization: "Bearer " + inexpUserJwt,
                                },
                                json: status,
                                method: "POST",
                                url: url + "/buddyRequest/status",
                            }).then(response => {
                                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                                    response.statusCode + ", error given is: " + response.error +
                                    " body is " + response.body);
                                expect(response.body.error).to.be.equal(
                                    "Can't reset a BuddyRequest's status to 'pending'");
                            });
                        });
                    });
                });
                it("should give a hint to anyone who spells 'canceled' the non-US way", () => {
                    const status = {
                        id: buddyRequestId,
                        status: "cancelled",
                    };
                    return defaultRequest({
                        headers: {
                            Authorization: "Bearer " + expUserJwt,
                        },
                        json: status,
                        method: "POST",
                        url: url + "/buddyRequest/status",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                            response.statusCode + ", error given is: " + response.error +
                            " body is " + response.body);
                        expect(response.body.error).to.be.equal(
                            "Invalid status 'cancelled', did you mean 'canceled'?");
                    });
                });
            });
        });
    });
});
