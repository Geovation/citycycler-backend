import * as FirebaseUtils from "../../common/firebaseUtils";
import * as chai from "chai";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as rp from "request-promise-native";
import * as retryRequest from "retry-request";

const expect = chai.expect;
const describe = mocha.describe;
const it = mocha.it;
const before = mocha.before;
const after = mocha.after;

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
    const user1 = { email: "userTest@e2e-test.matchmyroute-backend.appspot.com",
        firstname: "E2E Test",
        surname: "User",
    };
    const user2 = {
        email: "test1@e2e-test.matchmyroute-backend.appspot.com",
        firstname: "E2E Test",
        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21"
            + "bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
        surname: "User 2",
    };
    before(() => {
        return FirebaseUtils.createFirebaseUser(user1.email)
        .then(createResponse => {
            userIds.push(createResponse.user.uid);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            userJwts.push(jwt);
            return FirebaseUtils.createFirebaseUser(user2.email);
        }).then(createResponse => {
            userIds.push(createResponse.user.uid);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            userJwts.push(jwt);
        });
    });
    after("Delete test users from Firebase", () => {
        return FirebaseUtils.deleteFirebaseUsers(userIds);
    });
    describe("Creation", () => {
        it("should create a new user", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: user1,
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
                expect(response.body.result.user.id, "User returned has invalid id: " +
                    JSON.stringify(response.body.result.user.id)).to.equal(userIds[0]);
            });
        });
        it("should create a second user with different details and a profile photo", done => {
            defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[1],
                },
                json: user2,
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
                expect(response.body.result.user.id, "User returned has invalid id: " +
                    JSON.stringify(response.body.result.user.id)).to.equal(userIds[1]);
                expect(response.body.result.user.photo).to.be.a.string;

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
        it("shouldn't create a user with no first name", () => {
            const user = {
                email: "userTest2@e2e-test.matchmyroute-backend.appspot.com",
                firstname: "",
                password: "test",
                surname: "Bloggs",
            };
            return FirebaseUtils.createFirebaseUser(user.email)
            .then(createResponse => {
                userIds.push(createResponse.user.uid);
                return FirebaseUtils.getJwtForUser(createResponse.customToken);
            }).then(jwt => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + jwt,
                    },
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                });
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("First Name Required");
                expect(response.body.status).to.equal(400);
            });
        });
        it("shouldn't create a user with no surname", () => {
            const user = {
                email: "userTest3@e2e-test.matchmyroute-backend.appspot.com",
                firstname: "Joe",
                password: "test",
                surname: "",
            };
            return FirebaseUtils.createFirebaseUser(user.email)
            .then(createResponse => {
                userIds.push(createResponse.user.uid);
                return FirebaseUtils.getJwtForUser(createResponse.customToken);
            }).then(jwt => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + jwt,
                    },
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                });
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Surname Required");
                expect(response.body.status).to.equal(400);
            });
        });
        it("shouldn't create a user with no email", () => {
            const user = {
                email: "",
                firstname: "E2E Test",
                password: "test",
                surname: "User",
            };
            return FirebaseUtils.createFirebaseUser("noEmail@e2e-test.matchmyroute-backend.appspot.com")
            .then(createResponse => {
                userIds.push(createResponse.user.uid);
                return FirebaseUtils.getJwtForUser(createResponse.customToken);
            }).then(jwt => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + jwt,
                    },
                    json: user,
                    method: "PUT",
                    url: url + "/user",
                });
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", body returned is: " + JSON.stringify(response.body));
                expect(response.body.error).to.equal("Email Required");
                expect(response.body.status).to.equal(400);
            });
        });
        // commented out temporarily for transitioning to new accounts (as uniqueness of email
        // was dropped in db temporarily)
        // it("shouldn't create a user with a duplicate email", () => {
        //     const user = {
        //         email: "userTest@e2e-test.matchmyroute-backend.appspot.com",
        //         firstname: "E2E Test",
        //         password: "test",
        //         surname: "User",
        //     };
        //     return FirebaseUtils.createFirebaseUser("duplicateEmail@e2e-test.matchmyroute-backend.appspot.com")
        //         .then(createResponse => {
        //             userIds.push(createResponse.user.uid);
        //             return FirebaseUtils.getJwtForUser(createResponse.customToken);
        //         }).then(jwt => {
        //             return defaultRequest({
        //                 headers: {
        //                     Authorization: "Firebase " + jwt,
        //                 },
        //                 json: user,
        //                 method: "PUT",
        //                 url: url + "/user",
        //             });
        //     }).then(response => {
        //         expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
        //             response.statusCode + ", body returned is: " + JSON.stringify(response.body));
        //         expect(response.body.error).to.equal("An account already exists using this email");
        //         expect(response.body.status).to.equal(409);
        //     });
        // });
    });
    describe("Getting", () => {
        it("should get a user by a valid id", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/user?id=" + userIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.firstname).to.equal("E2E Test",
                    "Got a different first name than expected. Expected: \"E2E Test\", got \"" +
                    response.body.result.firstname + "\". Full response body is: " + JSON.stringify(response.body));
                expect(response.body.result.surname).to.equal("User",
                    "Got a different surname than expected. Expected: \"User\", got \"" +
                    response.body.result.surname + "\". Full response body is: " + JSON.stringify(response.body));
                expect(response.body.result.preferences).to.not.be.undefined;
            });
        });
        it("should get the JWT user when called with no id", () => {
            defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "GET",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.firstname).to.equal("E2E Test",
                    "Got a different first name than expected. Expected: \"E2E Test\", got \"" +
                    response.body.result.firstname + "\". Full response body is: " +
                    JSON.stringify(response.body));
                expect(response.body.result.surname).to.equal("User",
                    "Got a different surname than expected. Expected: \"User\", got \"" +
                    response.body.result.surname + "\". Full response body is: " +
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
                    Authorization: "Firebase " + userJwts[1],
                },
                method: "GET",
                url: url + "/user?id=" + userIds[0],
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
                expect(response.body.result.firstname).to.equal("E2E Test",
                    "Expected result first name to be \"E2E Test\", but it got \""
                    + response.body.result.name +
                    "\". Full response body is: " + JSON.stringify(response.body));
                expect(response.body.result.surname).to.equal("User",
                    "Expected result surname to be \"User\", but it got \""
                    + response.body.result.name +
                    "\". Full response body is: " + JSON.stringify(response.body));
                expect(response.body.result.preferences).to.be.undefined;
            });
        });
        it("should not get a user if the id is invalid", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
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
            const userUpdates = {
                bio: "Updated bio",
                email: "updateduserTest@e2e-test.matchmyroute-backend.appspot.com",
                firstname: "Updated Test",
                photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21" +
                "bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=",
                surname: "User",
            };
            defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/user?id=" + userIds[0],
                });
            }).then(response => {
                let user = response.body.result;
                expect(user.firstname).to.equal("Updated Test");
                expect(user.surname).to.equal("User");
                expect(user.email).to.equal("updateduserTest@e2e-test.matchmyroute-backend.appspot.com");
                expect(user.bio).to.equal("Updated bio");
                expect(user.photo).to.be.a.string;
                retryRequest({
                    json: true,
                    method: "GET",
                    retries: 10,
                    shouldRetryFn: httpMessage => {
                        return httpMessage.statusMessage !== "OK";
                    },
                    url: user.photo,
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
                firstname: "Updated2 Test",
                password: "updated2test",
                surname: "User",
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
        // temporarily removed as we allow multiple users with same email
        // while transitioning to Firebase auth
        // it("should not update a user to an existent email", () => {
        //     const userUpdates = {
        //         email: "test1@e2e-test.matchmyroute-backend.appspot.com",
        //         firstname: "Updated2 Test",
        //         password: "updated2test",
        //         surname: "User",
        //     };
        //     return defaultRequest({
        //         headers: {
        //             Authorization: "Firebase " + userJwts[0],
        //         },
        //         json: userUpdates,
        //         method: "POST",
        //         url: url + "/user",
        //     }).then(response => {
        //         expect(response.statusCode).to.equal(409, "Expected 490 response but got " +
        //             response.statusCode + ", body returned is: " + JSON.stringify(response.body));
        //         expect(response.body.error).to.equal("An account already exists using this email");
        //         expect(response.body.status).to.equal(409);
        //     });
        // });
        it("should update a user's individual properties - name", () => {
            const userUpdates = {
                firstname: "E2E Test",
                surname: "User",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/user?id=" + userIds[0],
                });
            }).then(response => {
                let user = response.body.result;
                expect(user.firstname).to.equal("E2E Test");
                expect(user.surname).to.equal("User");
            });
        });
        it("should update a user's individual properties - email", () => {
            const userUpdates = {
                email: "userTest3@e2e-test.matchmyroute-backend.appspot.com",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/user?id=" + userIds[0],
                });
            }).then(response => {
                let user = response.body.result;
                expect(user.email).to.equal("userTest3@e2e-test.matchmyroute-backend.appspot.com");
            });
        });
        it("should update a user's individual properties - bio", () => {
            const userUpdates = {
                bio: "Bio",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
                    },
                    method: "GET",
                    url: url + "/user?id=" + userIds[0],
                });
            }).then(response => {
                let user = response.body.result;
                expect(user.photo).to.be.a.string;
                retryRequest(
                    {
                        json: true,
                        method: "GET",
                        retries: 10,
                        shouldRetryFn: httpMessage => {
                            return httpMessage.statusMessage !== "OK";
                        },
                        url: user.photo,
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
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
                },
                json: userUpdates,
                method: "POST",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Got non 200 response: " +
                     JSON.stringify(response));
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
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
                    Authorization: "Firebase " + userJwts[0],
                },
                method: "DELETE",
                url: url + "/user",
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error);
            });
        });
    });
});
