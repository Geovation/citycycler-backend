import * as FirebaseUtils from "../../common/firebaseUtils";
import * as chai from "chai";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as moment from "moment";
import * as rp from "request-promise-native";

const expect = chai.expect;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
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
                contentType: "application/json",
            },
            json: true,
            resolveWithFullResponse: true,
            simple: false,
        });
    return rp(options);
};

describe("BuddyRequest endpoint", () => {
    let uids = [];
    let expUserId;  // The experienced User id
    let expUserJwt;  // The experienced User token
    let experiencedRouteId;   // The experienced Route id
    let experiencedRouteId2;   // Another experienced Route id
    let inexpUserId;  // The inexperienced User id
    let inexpUserJwt;  // The inexperienced User token
    let inexpUserId2;  // Another inexperienced User id
    let inexpUserJwt2;  // Another inexperienced User token
    let inexperiencedRouteId; // The inexperienced Route id
    let inexperiencedRouteId2; // Another inexperienced Route id
    let inexperiencedRouteId3; // Another inexperienced Route id
    let randomUserId;
    let randomUserJwt;  // A token for a user unconnected to these buddy requests
    let buddyRequestObject; // A BuddyRequest object with the ids all set correctly
    let buddyRequestObject2; // Another BuddyRequest object with the ids all set correctly
    let buddyRequestObject3; // Another BuddyRequest object with the ids all set correctly
    let buddyRequestObject4; // Another BuddyRequest object with the ids all set correctly
    before("Create 4 test users with respective routes", () => {
        // The random user
        const user1 = {
            email: "buddyReqestTest@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "Random Test",
            surname: "User",
        };
        // The inexperienced User
        const user2 = {
            email: "buddyReqestTest2@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "Inexperienced Test",
            surname: "User 1",
        };

        // Another inexperienced User
        const user3 = {
            email: "buddyReqestTest3@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "Inexperienced Test",
            surname: "User 2",
        };

        // The experienced User
        const user4 = {
            email: "buddyReqestTest4@e2e-test.matchmyroute-backend.appspot.com",
            firstname: "Experienced Test",
            surname: "User",
        };

        return FirebaseUtils.createFirebaseUser(user1.email)
        .then(createResponse => {
            randomUserId = createResponse.user.uid;
            uids.push(randomUserId);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            randomUserJwt = jwt;
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + randomUserJwt,
                },
                json: user1,
                method: "PUT",
                url: url + "/user",
            });
        }).then(() => {
            return FirebaseUtils.createFirebaseUser(user2.email);
        }).then(createResponse => {
            inexpUserId = createResponse.user.uid;
            uids.push(inexpUserId);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            inexpUserJwt = jwt;
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
                },
                json: user2,
                method: "PUT",
                url: url + "/user",
            });
        }).then(() => {
            return FirebaseUtils.createFirebaseUser(user3.email);
        }).then(createResponse => {
            inexpUserId2 = createResponse.user.uid;
            uids.push(inexpUserId2);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            inexpUserJwt2 = jwt;
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt2,
                },
                json: user3,
                method: "PUT",
                url: url + "/user",
            });
        }).then(() => {
            return FirebaseUtils.createFirebaseUser(user4.email);
        }).then(createResponse => {
            expUserId = createResponse.user.uid;
            uids.push(expUserId);
            return FirebaseUtils.getJwtForUser(createResponse.customToken);
        }).then(jwt => {
            expUserJwt = jwt;
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
                },
                json: user4,
                method: "PUT",
                url: url + "/user",
            });
        }).then(() => {
            // The inexperienced Route
            const route1 = {
                arrivalDateTime: "2017-06-08T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home",
                notifyOwner: false,
                radius: 1000,
                startPoint: [10, 10],
                startPointName: "16 Lenny Lane",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
                },
                json: route1,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            });
        }).then(response => {
            inexperiencedRouteId = parseInt(response.body.result.id, 10);
            // Another inexperienced Route
            const route2 = {
                arrivalDateTime: "2017-11-10T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home2",
                notifyOwner: false,
                radius: 1000,
                startPoint: [10, 10],
                startPointName: "16 Lenny Lane",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
                },
                json: route2,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            });
        }).then(response => {
            inexperiencedRouteId2 = parseInt(response.body.result.id, 10);
            // Another inexperienced Route
            const route3 = {
                arrivalDateTime: "2017-11-10T13:00:00+00",
                endPoint: [15, 15],
                endPointName: "18 Penny Promenade",
                length: 1222,
                name: "Ride home3",
                notifyOwner: false,
                radius: 1000,
                startPoint: [10, 10],
                startPointName: "16 Lenny Lane",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt2,
                },
                json: route3,
                method: "PUT",
                url: url + "/inexperiencedRoute",
            });
        }).then(response => {
            inexperiencedRouteId3 = parseInt(response.body.result.id, 10);
            // The experienced Route
            const route4 = {
                arrivalTime: "13:00:00+00",
                days: ["monday", "thursday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
                },
                json: route4,
                method: "PUT",
                url: url + "/experiencedRoute",
            });
        }).then(response => {
            experiencedRouteId = parseInt(response.body.result.id, 10);
            buddyRequestObject = {
                averageSpeed: 5,
                divorcePoint: [1, 1],
                divorcePointName: "32 Shelly Street",
                divorceTime: "2017-06-08T12:00:28.684Z",
                experiencedRoute: experiencedRouteId,
                experiencedRouteName: "Ride to work",
                experiencedUser: expUserId,
                inexperiencedRoute: inexperiencedRouteId,
                inexperiencedRouteName: "Ride to my friend Jerry's",
                length: 1000,
                meetingPoint: [0, 0],
                meetingPointName: "64 Ryan Road",
                meetingTime: "2017-06-08T11:34:28.684Z",
                route: [[0, 0], [0.5, 0.5], [1, 1]],
            };
            // Another experienced Route
            const route5 = {
                arrivalTime: "13:00:00+00",
                days: ["monday", "friday"],
                departureTime: "11:00:00+00",
                endPointName: "33 Rachel Road",
                length: 5000,
                name: "Ride to work2",
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "122 Stanley Street",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
                },
                json: route5,
                method: "PUT",
                url: url + "/experiencedRoute",
            });
        }).then(response => {
            experiencedRouteId2 = parseInt(response.body.result.id, 10);
            buddyRequestObject2 = {
                averageSpeed: 5,
                divorcePoint: [1, 1],
                divorcePointName: "32 Shelly Street",
                divorceTime: "2017-11-10T12:00:28.684Z",
                experiencedRoute: experiencedRouteId2,
                experiencedRouteName: "Ride to work2",
                experiencedUser: expUserId,
                inexperiencedRoute: inexperiencedRouteId,
                inexperiencedRouteName: "Ride to 18 Penny Promenade",
                length: 1000,
                meetingPoint: [0, 0],
                meetingPointName: "64 Ryan Road",
                meetingTime: "2017-11-10T11:34:28.684Z",
                route: [[0, 0], [0.5, 0.5], [1, 1]],
            };
            buddyRequestObject3 = {
                averageSpeed: 5,
                divorcePoint: [1, 1],
                divorcePointName: "32 Shelly Street",
                divorceTime: "2017-11-10T12:00:28.684Z",
                experiencedRoute: experiencedRouteId2,
                experiencedRouteName: "Ride to work3",
                experiencedUser: expUserId,
                inexperiencedRoute: inexperiencedRouteId2,
                inexperiencedRouteName: "Ride to 18 Penny Promenade",
                length: 1000,
                meetingPoint: [0, 0],
                meetingPointName: "64 Ryan Road",
                meetingTime: "2017-11-10T11:34:28.684Z",
                route: [[0, 0], [0.5, 0.5], [1, 1]],
            };
            buddyRequestObject4 = {
                averageSpeed: 5,
                divorcePoint: [1, 1],
                divorcePointName: "32 Shelly Street",
                divorceTime: "2017-11-10T12:00:28.684Z",
                experiencedRoute: experiencedRouteId2,
                experiencedRouteName: "Ride to work4",
                experiencedUser: expUserId,
                inexperiencedRoute: inexperiencedRouteId3,
                inexperiencedRouteName: "Ride to 18 Penny Promenade",
                length: 1000,
                meetingPoint: [0, 0],
                meetingPointName: "64 Ryan Road",
                meetingTime: "2017-11-10T11:34:28.684Z",
                route: [[0, 0], [0.5, 0.5], [1, 1]],
            };
        });
    });
    after("Delete test users from Firebase", () => {
        return FirebaseUtils.deleteFirebaseUsers(uids);
    });
    describe("Creation", () => {
        it("should create a BuddyRequest", () => {

            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
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
                    Authorization: "Firebase monkey",
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
                    Authorization: "Firebase " + inexpUserJwt,
                },
                json: buddyRequestObject,
                method: "PUT",
                url: url + "/buddyRequest",
            }).then(response => {
                buddyRequest1Id = parseInt(response.body.result.id, 10);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    json: buddyRequestObject2,
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
                        Authorization: "Firebase " + inexpUserJwt,
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
                        .isSame(buddyRequestObject.divorceTime, "second")).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName)
                        .to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute)
                        .to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second")).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[0].owner).to.equal(inexpUserId);
                    expect(buddyRequests[0].status).to.equal("pending");
                    expect(buddyRequests[0].reason).to.equal("");
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created, "second")).to.be.true;
                });
            });
            it("should get all of a user's sent buddy requests when no id is given", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
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
                        .isSame(buddyRequestObject.divorceTime, "second"),
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
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(moment(buddyRequests[0].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second"),
                        "Meeting time is different to expected." +
                        "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                        "\nActual: " + moment(buddyRequests[0].meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[0].owner).to.equal(inexpUserId);
                    expect(buddyRequests[0].status).to.equal("pending");
                    expect(buddyRequests[0].reason).to.equal("");
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created, "second")).to.be.true;
                    expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[1].divorceTime)
                        .isSame(buddyRequestObject.divorceTime, "second"),
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
                    expect(buddyRequests[1].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[1].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[1].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second"),
                        "Meeting time is different to expected." +
                        "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                        "\nActual: " + moment(buddyRequests[1].meetingTime)).to.be.true;
                    expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[1].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[1].owner).to.equal(inexpUserId);
                    expect(buddyRequests[1].status).to.equal("pending");
                    expect(buddyRequests[1].reason).to.equal("");
                    expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[1].updated).isSame(buddyRequests[1].created, "second")).to.be.true;
                });
            });
            it("should set otherUser correctly to the experiencedUser", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
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
                    expect(buddyRequests[0].otherUser.id).to.equal(expUserId);
                });
            });
            it("should not get a user's received buddy requests from the sent endpoint", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + expUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error +
                        " body is " + response.body);
                    let buddyRequests = response.body.result;
                    expect(buddyRequests.length).to.equal(0);
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
                        Authorization: "Firebase " + randomUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest1Id,
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
                        Authorization: "Firebase " + expUserJwt,
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
                        .isSame(buddyRequestObject.divorceTime, "second")).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName)
                        .to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute)
                        .to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second")).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[0].owner).to.equal(inexpUserId);
                    expect(buddyRequests[0].status).to.equal("pending");
                    expect(buddyRequests[0].reason).to.equal("");
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created, "second")).to.be.true;
                });
            });
            it("should get all of a user's received buddy requests when no id is given", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + expUserJwt,
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
                        .isSame(buddyRequestObject.divorceTime, "second"),
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
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second"),
                        "Meeting time is different to expected." +
                        "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                        "\nActual: " + moment(buddyRequests[0].meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[0].owner).to.equal(inexpUserId);
                    expect(buddyRequests[0].status).to.equal("pending");
                    expect(buddyRequests[0].reason).to.equal("");
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequests[0].created, "second")).to.be.true;
                    expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[1].divorceTime)
                        .isSame(buddyRequestObject.divorceTime, "second"),
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
                    expect(buddyRequests[1].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[1].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[1].meetingTime)
                        .isSame(buddyRequestObject.meetingTime, "second"),
                        "Meeting time is different to expected." +
                        "\nExpected: " + moment(buddyRequestObject.meetingTime) +
                        "\nActual: " + moment(buddyRequests[1].meetingTime)).to.be.true;
                    expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[1].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[1].owner).to.equal(inexpUserId);
                    expect(buddyRequests[1].status).to.equal("pending");
                    expect(buddyRequests[1].reason).to.equal("");
                    expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[1].updated).isSame(buddyRequests[1].created, "second")).to.be.true;
                });
            });
            it("should set otherUser correctly to the inexperiencedUser", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + expUserJwt,
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
                    expect(buddyRequests[0].otherUser.id).to.equal(inexpUserId);
                });
            });
            it("should not get a user's sent buddy requests from the received endpoint", () => {
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/received",
                }).then(response => {
                    expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                    response.statusCode + ", error given is: " + response.error +
                        " body is " + response.body);
                    let buddyRequests = response.body.result;
                    expect(buddyRequests.length).to.equal(0);
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
                        Authorization: "Firebase " + randomUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/received?id=" + buddyRequest1Id,
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
                    Authorization: "Firebase " + inexpUserJwt,
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
                        Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                        Authorization: "Firebase " + expUserJwt,
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
                                Authorization: "Firebase " + inexpUserJwt,
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
                    Authorization: "Firebase " + inexpUserJwt,
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
                    Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                                Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + expUserJwt,
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
                                Authorization: "Firebase " + expUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
                            Authorization: "Firebase " + inexpUserJwt,
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
        it("should not let you mark it as completed", () => {
            const status = {
                id: buddyRequestId,
                status: "completed",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
                },
                json: status,
                method: "POST",
                url: url + "/buddyRequest/status",
            }).then(response => {
                expect(response.statusCode).to.equal(400, "Expected 400 response but got " +
                    response.statusCode + ", error given is: " + response.error +
                    " body is " + response.body);
                expect(response.body.error).to.be.equal(
                    "Can't set a BuddyRequest's status to 'completed'. This only " +
                    "happens when a user submits a review.");
            });
        });
        it("should give a hint to anyone who spells 'canceled' the non-US way", () => {
            const status = {
                id: buddyRequestId,
                status: "cancelled",
            };
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
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

    describe("Updating status after route deletion", () => {
        let buddyRequest1Id;
        let buddyRequest2Id;
        let buddyRequest3Id;
        let buddyRequest4Id;
        before("Set up 4 buddy requests from inexp user -> exp user", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
                },
                json: buddyRequestObject,
                method: "PUT",
                url: url + "/buddyRequest",
            }).then(response => {
                // Buddy request 1: from inexp user 1 -> exp user
                buddyRequest1Id = parseInt(response.body.result.id, 10);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    json: buddyRequestObject2,
                    method: "PUT",
                    url: url + "/buddyRequest",
                });
            }).then(response => {
                // Buddy request 2: from inexp user 1 -> exp user
                buddyRequest2Id = parseInt(response.body.result.id, 10);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    json: buddyRequestObject3,
                    method: "PUT",
                    url: url + "/buddyRequest",
                });
            }).then(response => {
                // Buddy request 3: from inexp user 1 -> exp user
                buddyRequest3Id = parseInt(response.body.result.id, 10);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt2,
                    },
                    json: buddyRequestObject4,
                    method: "PUT",
                    url: url + "/buddyRequest",
                });
            }).then(response => {
                // Buddy request 4: from inexp user 2 -> exp user
                buddyRequest4Id = parseInt(response.body.result.id, 10);
            });
        });

        it("Should only update status for any buddy requests with the deleted exp route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + expUserJwt,
                },
                method: "DELETE",
                url: url + "/experiencedRoute?id=" + experiencedRouteId,
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest1Id,
                });
            }).then(response => {
                expect(response.body.result[0].status).to.equal("canceled");
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest2Id,
                });
            }).then(response => {
                expect(response.body.result[0].status).to.equal("pending");
            });
        });

        it("Should only update status for any buddy requests with the deleted inexp route", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt,
                },
                method: "DELETE",
                url: url + "/inexperiencedRoute?id=" + inexperiencedRouteId,
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest2Id,
                });
            }).then(response => {
                expect(response.body.result[0].status).to.equal("canceled");
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest3Id,
                });
            }).then(response => {
                expect(response.body.result[0].status).to.equal("pending");
            });
        });

        it("Should only update status for any buddy requests with the deleted user", () => {
            return defaultRequest({
                headers: {
                    Authorization: "Firebase " + inexpUserJwt2,
                },
                method: "DELETE",
                url: url + "/user?id=" + inexpUserId2,
            }).then(response => {
                expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error);
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest3Id,
                });
            }).then(response => {
                expect(response.body.result[0].status).to.equal("pending");
                return defaultRequest({
                    headers: {
                        Authorization: "Firebase " + inexpUserJwt2,
                    },
                    method: "GET",
                    url: url + "/buddyRequest/sent?id=" + buddyRequest4Id,
                });
            }).then(response => {
                // Inexperienced test user 2 has been deleted, so the buddyRequest does not exist
                expect(response.statusCode).to.equal(404, "Expected 404 response but got " +
                response.statusCode + ", error given is: " + response.error);
            });
        });
    });

    describe("Reviewing", () => {
                let buddyRequestId;
                let counter = 0;
                beforeEach("Make a BuddyRequest to review", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: buddyRequestObject,
                        method: "PUT",
                        url: url + "/buddyRequest",
                    }).then(response => {
                        buddyRequestId = parseInt(response.body.result.id, 10);
                        const status = {
                            id: buddyRequestId,
                            status: "accepted",
                        };
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + expUserJwt,
                            },
                            json: status,
                            method: "POST",
                            url: url + "/buddyRequest/status",
                        });
                    });
                });
                it("Should let a user review a buddy request as a 1", () => {
                    counter++;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 1,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200);
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent?id=" + buddyRequestId,
                        });
                    }).then(response => {
                        let buddyRequest = response.body.result[0];
                        expect(buddyRequest.review).to.equal(1, "Review was not set");
                        expect(buddyRequest.status).to.equal("completed", "Status was not set");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + inexpUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.helpedCount).to.equal(counter, "Inexperienced User helpedCount was not updated");
                        expect(user.distance).to.equal(counter * 1000, "Inexperienced User distance was not updated");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + expUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.usersHelped).to.equal(counter, "Experienced User usersHelped was not updated");
                        expect(user.distance).to.equal(counter * 1000, "Experienced User distance was not updated");
                        expect(user.rating).to.equal(1, "Experienced User rating was not updated");
                    });
                });
                it("Should let a user review a buddy request as a 5", () => {
                    counter++;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 5,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(200);
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent?id=" + buddyRequestId,
                        });
                    }).then(response => {
                        let buddyRequest = response.body.result[0];
                        expect(buddyRequest.review).to.equal(5, "Review was not set");
                        expect(buddyRequest.status).to.equal("completed", "Status was not set");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + inexpUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.helpedCount).to.equal(counter, "Inexperienced User helpedCount was not updated");
                        expect(user.distance).to.equal(counter * 1000, "Inexperienced User distance was not updated");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + expUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.usersHelped).to.equal(counter, "Experienced User usersHelped was not updated");
                        expect(user.distance).to.equal(counter * 1000, "Experienced User distance was not updated");
                        expect(user.rating).to.equal((1 + 5) / counter, "Experienced User rating was not updated");
                    });
                });
                it("Should not let an experiencedUser review a buddyRequest", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + expUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 1,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(404);
                        expect(response.body.status).to.equal(404);
                        expect(response.body.error).to.equal("BuddyRequest does not exist");
                    });
                });
                it("Should not let a user review a buddyRequest as a 6", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 6,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400);
                        expect(response.body.status).to.equal(400);
                        expect(response.body.error).to.equal("BuddyRequest review must be between 1 and 5");
                    });
                });
                it("Should not let a user review a buddyRequest as a -2", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: -2,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400);
                        expect(response.body.status).to.equal(400);
                        expect(response.body.error).to.equal("BuddyRequest review must be between 1 and 5");
                    });
                });
                it("Should not let a user review a buddyRequest as a 0", () => {
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 0,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(400);
                        expect(response.body.status).to.equal(400);
                        expect(response.body.error).to.equal("BuddyRequest review must be between 1 and 5");
                    });
                });
                it("Should let a user update a review", () => {
                    counter++;
                    return defaultRequest({
                        headers: {
                            Authorization: "Firebase " + inexpUserJwt,
                        },
                        json: {
                            id: buddyRequestId,
                            score: 1,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            json: {
                                id: buddyRequestId,
                                score: 3,
                            },
                            method: "POST",
                            url: url + "/buddyRequest/review",
                        });
                    }).then(response => {
                        expect(response.statusCode).to.equal(200);
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/buddyRequest/sent?id=" + buddyRequestId,
                        });
                    }).then(response => {
                        let buddyRequest = response.body.result[0];
                        expect(buddyRequest.review).to.equal(3, "Review was not updated");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + inexpUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + inexpUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.helpedCount).to.equal(counter, "Inexperienced User helpedCount was updated " +
                            "but shouldn't have been");
                        expect(user.distance).to.equal(counter * 1000, "Inexperienced User distance was updated " +
                            "but shouldn't have been");
                        return defaultRequest({
                            headers: {
                                Authorization: "Firebase " + expUserJwt,
                            },
                            method: "GET",
                            url: url + "/user?id=" + expUserId,
                        });
                    }).then(response => {
                        let user = response.body.result;
                        expect(user.usersHelped).to.equal(counter, "Experienced User usersHelped was updated " +
                            "but shouldn't have been");
                        expect(user.distance).to.equal(counter * 1000, "Experienced User distance was updated " +
                            "but shouldn't have been");
                        expect(user.rating).to.equal((1 + 5 + 3) / counter, "Experienced User rating was not updated");
                    });
                });
                it("Should not let a user review with no auth", () => {
                    return defaultRequest({
                        json: {
                            id: buddyRequestId,
                            score: 1,
                        },
                        method: "POST",
                        url: url + "/buddyRequest/review",
                    }).then(response => {
                        expect(response.statusCode).to.equal(403);
                        expect(response.body.status).to.equal(403);
                        expect(response.body.error).to.equal("Invalid authorization");
                    });
                });
            });
});
