import * as CloudStorage from "../../common/cloudstorage";
import * as chai from "chai";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as rp from "request-promise-native";
import * as retryRequest from "retry-request";

const expect = chai.expect;
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

describe("User endpoint", () => {
    let userIds = [];   // A list of users created
    let userJwts = [];  // JWTs corresponding to the respective users in userIds
    describe("Creation", () => {
        it("should create a new user", () => {
            const user = { email: "userTest@e2e-test.matchmyroute-backend.appspot.com",
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
                expect(response.body.result, "Creation did not yield a user. Got: " +
                    JSON.stringify(response.body.result)).to.have.property("user");
                expect(parseInt(response.body.result.user.id, 10), "User returned has invalid id: " +
                    JSON.stringify(response.body.result.user.id)).to.not.be.NaN;
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

                userIds.push(parseInt(response.body.result.user.id, 10));
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
                expect(response.body.result, "Creation did not yield a user. Got: " +
                    JSON.stringify(response.body.result)).to.have.property("user");
                expect(parseInt(response.body.result.user.id, 10), "User returned has invalid id: " +
                    JSON.stringify(response.body.result.user.id)).to.not.be.NaN;
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
                expect(response.body.result.user.photo).to.be.a.string;

                userIds.push(parseInt(response.body.result.user.id, 10));
                userJwts.push(response.body.result.jwt.token);
                return response.body.result.user.photo;
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
            const user = { email: "userTest2@e2e-test.matchmyroute-backend.appspot.com",
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
            const user = { email: "userTest@e2e-test.matchmyroute-backend.appspot.com",
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
                email: "updateduserTest@e2e-test.matchmyroute-backend.appspot.com",
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
                expect(user.email).to.equal("updateduserTest@e2e-test.matchmyroute-backend.appspot.com");
                expect(user.bio).to.equal("Updated bio");
                expect(user.photo).to.equal(CloudStorage.createFilenameForUser(userIds[0]));
                photoName = user.photo;
                // Test password change by logging in with the new password
                return defaultRequest({
                    headers: {
                        Authorization: "Bearer " + userJwts[0],
                    },
                    json: {
                        email: "updateduserTest@e2e-test.matchmyroute-backend.appspot.com",
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
                email: "updated2userTest@e2e-test.matchmyroute-backend.appspot.com",
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
                email: "userTest3@e2e-test.matchmyroute-backend.appspot.com",
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
                expect(user.email).to.equal("userTest3@e2e-test.matchmyroute-backend.appspot.com");
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
                        email: "userTest@e2e-test.matchmyroute-backend.appspot.com",
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
            it("should provide a JWT and the User", () => {
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
                    expect(response.body.result, "Call did not return user: " +
                        JSON.stringify(response.body.result)).to.have.property("user");
                    expect(response.body.result.user, "User object does not have id: " +
                        JSON.stringify(response.body.result)).to.have.property("id");
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
                    expect(response.body.user, "User object was returned").to.be.undefined;
                });
            });
            it("should not provide a JWT if the email doesn't exist", () => {
                const auth = { email: "userTest@e2e-test.matchmyroute-backend.appspot.com", password: "test" };
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
