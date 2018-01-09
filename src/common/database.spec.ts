import * as Database from "./database";
import ExperiencedRoute from "./ExperiencedRouteDataModel";
import InexperiencedRoute from "./InexperiencedRouteDataModel";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as moment from "moment";
// import * as should from "should";
import * as logger from "winston";

const before = mocha.before;
const after = mocha.after;
const beforeEach = mocha.beforeEach;
const afterEach = mocha.afterEach;
const describe = mocha.describe;
const it = mocha.it;
const expect = chai.expect;
// const assert = chai.assert;
// const should = chai.should;
chai.use(chaiAsPromised);

// Test the database Functions
describe("MatchMyRoute Database Functions", () => {
    let userIds = [];	// These are to assist wiht cleanup afterwards
    let routeIds = [];
    before((done) => {
        // console.log("trying to shut down pool");
        // Shut down any running database pools
        Database.shutDownPool().then(result => {
            if (result) {
                // Start a new database pool
                // console.log("trying to start new database");
                Database.startUpPool(true);
                Database.resetDatabase().then(
                    e => { done(); }
                ).catch(
                    err => { done(err); }
                    );
            } else {
                logger.error("Couldn't shut down old pool!");
                process.exit(1);
            }
        });
    });
    after(() => {
        return Database.shutDownPool();
    });
    let transactionClient;
    beforeEach("Create transaction client", function(done){
        Database.createTransactionClient().then(newClient => {
            transactionClient = newClient;
            done();
        }).catch(e => {
            // console.error("cannot create transaction client");
            done();
        });
    });
    afterEach("Rolling back transaction", function(done) {
        Database.rollbackAndReleaseTransaction(
            transactionClient,
            (typeof this.currentTest !== "undefined" ? this.currentTest.title : "no Title")
        ).then(
            () => done()
        ).catch(err => {
            // console.error("Cannot roll back");
            done(err);
        });
    });
    // Test that the arbritary sql function works, because we'll be relying on this for the other tests.
    it("should be connected to the database", done => {
        const rowCount = Database.sqlTransaction(
            "select count(*) from pg_stat_activity",
            [],
            transactionClient
        ).then(result => {
            return result.rowCount;
        });
        expect(rowCount).to.eventually.be.above(0, "pg reports " + rowCount + " connections to the DB")
            .and.notify(done);
    });

    describe("User related functions", () => {
        it("should create new user (without bio)", () => {
            return Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            }, transactionClient)
                .then(response => {
                    expect(response.firstname).to.equal("Test");
                    expect(response.surname).to.equal("User");
                });
        });
        it("should create new user (with bio)", () => {
            return Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                profile_bio: "mybio",
                surname: "User",
            }, transactionClient)
                .then(response => {
                    expect(response.firstname).to.equal("Test");
                    expect(response.surname).to.equal("User");
                    expect(response.bio).to.equal("mybio");
                });
        });
        it("should escape SQL injections", () => {
            return Database.putUser({
                email: "test2@example.com",
                firstname: "Test",
                id: "testuser2",
                surname: "User');DROP TABLE users;",
            }, transactionClient);
        });
        describe("User reliant tests", () => {
            let userId;
            beforeEach("Create user to test against", () => {
                return Database.putUser({
                    email: "test@example.com",
                    firstname: "Test",
                    id: "testuser",
                    surname: "User",
                },
                transactionClient)
                .then(user => {
                    userId = user.id;
                    return userId;
                });
            });
            it("should fail to create users with duplicate emails", done => {
                const promise = Database.putUser({
                    email: "test@example.com",
                    firstname: "Test",
                    id: "testuser2",
                    surname: "User 2",
                }, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should delete a user", (done) => {
                const promise = Database.deleteUser(userId, transactionClient)
                .then(() => {
                    return Database.getUserById(userId, transactionClient);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not delete any users with an invalid id", done => {
                const promise = Database.deleteUser("abcd", transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get a user by id", () => {
                return Database.getUserById(userId, transactionClient)
                .then(user => {
                    expect(user.firstname).to.equal("Test");
                    expect(user.surname).to.equal("User");
                });
            });
            it("should not get a user by an invalid ID", done => {
                const promise = Database.getUserById("abcd", transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get a user by email", () => {
                return Database.getUserByEmail("test@example.com", transactionClient).then(user => {
                    expect(user.firstname).to.equal("Test");
                    expect(user.surname).to.equal("User");
                });
            });
            it("should not get a user by an invalid email", done => {
                const promise = Database.getUserByEmail("idontexist@example.com", transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Updating", () => {
            // NOTE: These tests are all atomic!
            let thisUserId; // The userId that the tests can use to get/update users
            beforeEach("Create the user to run tests against", done => {
                Database.putUser({
                    email: "non-updated@example.com",
                    firstname: "Non-updated Test",
                    id: "non-updated",
                    surname: "User",
                }, transactionClient).then(user => {
                    thisUserId = user.id;
                    done();
                });
            });
            // Go through these objects and try to update the user with them
            let updateables = [
                { firstname: "Updated Test" },
                { surname: "User" },
                { email: "updated@example.com" },
                { preferences_units: "kilometers" },
                { preferences_difficulty: "quiet" },
                { profile_photo: "http://lorempixel.com/400/400/people/Updated" },
                { profile_bio: "Updated Biography" },
                {
                    email: "updated@example.com",
                    firstname: "Updated Test",
                    profile_bio: "Updated Biography",
                    profile_photo: "http://lorempixel.com/400/400/people/Updated",
                    surname: "User",
                },
            ];
            for (let i = 0; i < updateables.length; i++) {
                let updates = updateables[i];
                let keys = Object.keys(updates).join(", ");
                it("should update " + keys, () => {
                    return Database.updateUser(thisUserId, updates, transactionClient).then(() => {
                        return Database.sqlTransaction("SELECT firstname, surname, email, profile_photo, " +
                            "profile_bio, preferences_difficulty, preferences_units FROM users WHERE id=$1;",
                            [thisUserId], transactionClient).then(result => {
                                return result.rows[0];
                            });
                    }).then(user => {
                        for (let key of Object.keys(updates)) {
                            if (user[key] instanceof Buffer) {
                                expect(Buffer.compare(user[key], updates[key]))
                                    .to.equal(0);
                            } else {
                                expect(user[key]).to.equal(updates[key]);
                            }
                        }
                    });
                });
            }
            it("should not update preferences_units to an invalid value", done => {
                const updates = {preferences_units: "smoots"};
                const promise = Database.updateUser(thisUserId, updates, transactionClient).then(() => {
                    return Database.sqlTransaction("SELECT preferences_units FROM users WHERE id=$1;",
                        [thisUserId], transactionClient);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not update preferences_difficulty to an invalid value", done => {
                const updates = {preferences_difficulty: "easy peasy"};
                const promise = Database.updateUser(thisUserId, updates, transactionClient).then(() => {
                    return Database.sqlTransaction("SELECT preferences_difficulty FROM users WHERE id=$1;",
                        [thisUserId], transactionClient);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
    });
    describe("General ExperiencedRoute Functions", () => {
        let thisUserId;
        let thisUserId2;
        let routeData;
        const faultyRouteData = new ExperiencedRoute({
            arrivalTime: "14:00:00+00",
            days: ["tuesday", "sunday"],
            departureTime: "13:00:00+00",
            endPointName: "112 Rachel Road",
            length: 5000,
            owner: -1,
            route: [[0, 0], [1, 0], [1, 1]],
            startPointName: "33 Stanley Street",
        });
        beforeEach("Create user and experienced route to test against", () => {
            return Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                routeData = new ExperiencedRoute({
                    arrivalTime: "14:00:00+00",
                    days: ["tuesday", "sunday"],
                    departureTime: "13:00:00+00",
                    endPointName: "112 Rachel Road",
                    length: 5000,
                    name: "Ride to work",
                    owner: thisUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                    startPointName: "33 Stanley Street",
                });
                return thisUserId;
            })
            // create second valid user
            .then(() => {
                return Database.putUser({
                    email: "test2@example.com",
                    firstname: "Test",
                    id: "testuser2",
                    surname: "User 2",
                },
                transactionClient);
            })
            .then(user => {
                thisUserId2 = user.id;
                return thisUserId2;
            });
        });
        it("should create an experienced route", () => {
            return Database.putExperiencedRoute(routeData, transactionClient).then(routeId => {
                routeIds.push(routeId);
                return Database.sqlTransaction(
                    "SELECT arrivalTime, departureTime, owner, days::text[], startPointName, endPointName, " +
                    "name, length FROM experienced_routes WHERE id=$1",
                    ["" + routeId],
                    transactionClient
                ).then(result => {
                    expect(result.rows[0].arrivaltime).to.equal(routeData.arrivalTime);
                    expect(result.rows[0].departuretime).to.equal(routeData.departureTime);
                    expect(result.rows[0].owner).to.equal(routeData.owner);
                    expect(result.rows[0].days).to.eql(routeData.days);
                    expect(result.rows[0].startpointname).to.equal(routeData.startPointName);
                    expect(result.rows[0].endpointname).to.equal(routeData.endPointName);
                    expect(result.rows[0].length).to.equal(routeData.length);
                    expect(result.rows[0].name).to.equal(routeData.name);
                });
            });
        });
        it("should create an experienced route with no name", () => {
            let thisRoute = routeData = new ExperiencedRoute({
                arrivalTime: "14:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "13:00:00+00",
                endPointName: "112 Rachel Road",
                length: 5000,
                owner: routeData.owner,
                route: [[0, 0], [1, 0], [1, 1]],
                startPointName: "33 Stanley Street",
            });
            return Database.putExperiencedRoute(thisRoute, transactionClient).then(routeId => {
                routeIds.push(routeId);
                return Database.sqlTransaction(
                    "SELECT arrivalTime, departureTime, owner, days::text[], startPointName, endPointName, " +
                    "name, length FROM experienced_routes WHERE id=$1",
                    ["" + routeId],
                    transactionClient
                ).then(result => {
                    expect(result.rows[0].arrivaltime).to.equal(routeData.arrivalTime);
                    expect(result.rows[0].departuretime).to.equal(routeData.departureTime);
                    expect(result.rows[0].owner).to.equal(routeData.owner);
                    expect(result.rows[0].days).to.eql(routeData.days);
                    expect(result.rows[0].startpointname).to.equal(routeData.startPointName);
                    expect(result.rows[0].endpointname).to.equal(routeData.endPointName);
                    expect(result.rows[0].length).to.equal(routeData.length);
                    expect(result.rows[0].name).to.equal("33 Stanley Street to 112 Rachel Road");
                });
            });
        });
        it("should not create an experienced route for an invalid owner", done => {
            const promise = Database.putExperiencedRoute(faultyRouteData, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        describe("Route reliant tests", () => {
            let thisRouteId;
            let thisRouteId2;
            beforeEach("Create route to test against", () => {
                return Database.putExperiencedRoute(routeData, transactionClient).then(routeId => {
                    thisRouteId = routeId;
                    return Database.putExperiencedRoute(routeData, transactionClient);
                }).then(routeId => {
                    thisRouteId2 = routeId;
                });
            });
            it("should get an experienced route by ID if user is the owner", () => {
                return Database.getExperiencedRoutes({id: thisRouteId, userId: thisUserId}, transactionClient)
                .then(result => {
                    expect(result.length).to.equal(1);
                    expect(result[0].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[0].departureTime).to.equal(routeData.departureTime);
                    expect(result[0].owner).to.equal(routeData.owner);
                    expect(result[0].days).to.eql(routeData.days);
                    expect(result[0].startPointName).to.equal(routeData.startPointName);
                    expect(result[0].endPointName).to.equal(routeData.endPointName);
                    expect(result[0].length).to.equal(routeData.length);
                    expect(result[0].name).to.equal(routeData.name);
                });
            });
            it("should not get an experienced route by an invalid ID", done => {
                const promise = Database.getExperiencedRoutes({id: -1, userId: thisUserId}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get an experienced route if user is not the owner", done => {
                const promise = Database.getExperiencedRoutes(
                    {id: thisRouteId, userId: thisUserId2},
                    transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get all routes of a user", () => {
                return Database.getExperiencedRoutes({userId: thisUserId}, transactionClient).then(result => {
                    expect(result.length).to.equal(2);
                    expect(result[0].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[0].departureTime).to.equal(routeData.departureTime);
                    expect(result[0].owner).to.equal(routeData.owner);
                    expect(result[0].days).to.eql(routeData.days);
                    expect(result[0].startPointName).to.equal(routeData.startPointName);
                    expect(result[0].endPointName).to.equal(routeData.endPointName);
                    expect(result[0].length).to.equal(routeData.length);
                    expect(result[0].name).to.equal(routeData.name);
                    expect(result[1].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[1].departureTime).to.equal(routeData.departureTime);
                    expect(result[1].owner).to.equal(routeData.owner);
                    expect(result[1].days).to.eql(routeData.days);
                    expect(result[1].startPointName).to.equal(routeData.startPointName);
                    expect(result[1].endPointName).to.equal(routeData.endPointName);
                    expect(result[1].length).to.equal(routeData.length);
                    expect(result[1].name).to.equal(routeData.name);
                });
            });
            it("should not get routes of a user if he didn't create any yet", () => {
                return Database.getExperiencedRoutes({userId: thisUserId2}, transactionClient).then(result => {
                    expect(result.length).to.equal(0);
                });
            });
            it("should get a nearby route", () => {
                return Database.getExperiencedRoutesNearby(500, 1, 1, transactionClient).then(routes => {
                    const rids = routes.map((r) => {
                        return r.id;
                    });
                    expect(rids).to.contain(thisRouteId);
                });
            });
            it("should not get a far away route", () => {
                return Database.getExperiencedRoutesNearby(1, 1.6, 2.4, transactionClient).then(routes => {
                    const rids = routes.map((r) => {
                        return r.id;
                    });
                    expect(rids).not.to.contain(thisRouteId);
                });
            });
            it("should not get an experienced route in a tiny radius (<1m)", done => {
                const promise = Database.getExperiencedRoutesNearby(0.5, 1.6, 2.4, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get an experienced route in a huuuge radius (>2km)", done => {
                const promise = Database.getExperiencedRoutesNearby(2001, 1.6, 2.4, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not delete any routes with an invalid id", done => {
                const promise = Database.deleteExperiencedRoute(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should delete an experienced route", () => {
                return Database.deleteExperiencedRoute(thisRouteId, transactionClient).then(() => {
                    Database.sqlTransaction(
                        "SELECT * FROM experienced_routes WHERE id=$1;",
                        [thisRouteId],
                        transactionClient
                    ).then(result => {
                        expect(result.rows[0].deleted).to.be.true;
                    });
                });
            });
            it("should delete any routes associated with a user, when that user is deleted", () => {
                return Database.deleteUser(thisUserId, transactionClient)
                .then(() => {
                    return Database.sqlTransaction(
                        "SELECT * FROM experienced_routes WHERE id=$1;",
                        ["" + thisRouteId],
                        transactionClient
                    );
                }).then((result: any) => {
                    expect(result.rowCount).to.equal(0);
                });
            });
        });
        describe("Retrieval after deleting", () => {
            let experiencedRouteId1;
            let experiencedRouteId2;
            beforeEach("Set up two experienced routes", () => {
                return Database.putExperiencedRoute(routeData, transactionClient)
                    .then(routeId => {
                        experiencedRouteId1 = routeId;
                        return Database.putExperiencedRoute(routeData, transactionClient);
                    }).then(routeId => {
                        experiencedRouteId2 = routeId;
                    });
            });
            it("should only get non-deleted experienced routes if includedeleted is set to false", () => {
                return Database.deleteExperiencedRoute(experiencedRouteId1, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.getExperiencedRoutes({
                        includedeleted: false,
                        userId: thisUserId}, transactionClient);
                }).then(experiencedRoutes => {
                    expect(experiencedRoutes.length).to.equal(1);
                    expect(experiencedRoutes[0].deleted).to.be.false;
                });
            });
            it("should get all experienced routes if includedeleted is set to true", () => {
                return Database.deleteExperiencedRoute(experiencedRouteId1, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.getExperiencedRoutes({
                        includedeleted: true,
                        userId: thisUserId}, transactionClient);
                }).then(experiencedRoutes => {
                    expect(experiencedRoutes.length).to.equal(2);
                    expect(experiencedRoutes[1].deleted).to.be.true;
                });
            });
        });
    });
    describe("Route Matching", () => {
        let thisUserId = "testUserInexperienced";
        let matchedUserId;
        let matchedRouteId;
        let routeData;
        const newArrivalDateTime = null;
        beforeEach("Create user and route to test against", done => {
            Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            },
            transactionClient)
            .then(user => {
                matchedUserId = user.id;
                routeData = new ExperiencedRoute({
                    arrivalTime: "13:30:00+00",
                    days: ["tuesday", "friday", "sunday"],
                    departureTime: "12:45:00+00",
                    endPointName: "33 Stanley Street",
                    length: 5000,
                    owner: matchedUserId,
                    route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                    startPointName: "112 Rachel Road",
                });
                return Database.putExperiencedRoute(routeData, transactionClient);
            })
            .then(routeId => {
                matchedRouteId = routeId;
                done();
            });
        });
        it("should match an experienced route", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00", // A Friday
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            return Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient)
                .then(routes => {
                    const matchedRoute = routes.filter((route) => {
                        return route.id === matchedRouteId;
                    })[0];
                    expect(matchedRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                        JSON.stringify(routes));
                    expect(matchedRoute, "Returned match doesn't have owner").to.have.property("owner");
                    expect(matchedRoute.owner, "Returned owner doesn't id").to.have.property("id");
                    expect(matchedRoute.owner.id).to.equal(matchedUserId, "Owner is not what was expected");
                    expect(moment("2017-09-08T12:45:00+00").isBefore(matchedRoute.meetingTime)).to.equal(true,
                        "meetingTime is before the route's start time (2017-09-08T12:45:00+00). Got " +
                        matchedRoute.meetingTime);
                    expect(moment("2017-09-08T13:30:00+00").isAfter(matchedRoute.meetingTime)).to.equal(true,
                        "meetingTime is after the route's end time (2017-09-08T13:30:00+00). Got " +
                        matchedRoute.meetingTime);
                    expect(matchedRoute.meetingPoint).to.eql([0, 1.4]);
                    expect(matchedRoute.divorcePoint).to.eql([0, 4.6]);
                    expect(matchedRoute.name).to.equal("112 Rachel Road to 33 Stanley Street");
                    expect(matchedRoute.route).to.eql([[0, 1.4], [0, 2], [0, 3], [0, 4], [0, 4.6]]);
                    expect(matchedRoute.length).to.equal(353848);
                    expect(matchedRoute.averageSpeed).to.equal(245.7);
                });
        });
        it("should not match an experienced route if the radius is too big", done => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 5000,
                startPoint: <[number, number]> [0, 1.4],
            };
            const promise = Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match an experienced route if the radius is too small", done => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 0.5,
                startPoint: <[number, number]> [0, 1.4],
            };
            const promise = Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match an experienced route in the wrong direction", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 1.6],
                radius: 500,
                startPoint: <[number, number]> [0, 4.6],
            };
            return Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient).then(routes => {
                const matchedRoute = routes.filter((route) => {
                    return route.id === matchedRouteId;
                })[0];
                expect(matchedRoute).to.equal(undefined,
                    "Got route when we shouldn't: " + JSON.stringify(matchedRoute));
            });
        });
        it("should not match an experienced route if days are set to exclude the required day", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-09T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            return Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient)
                .then(routes => {
                    const matchedRoute = routes.filter((route) => {
                        return route.id === matchedRouteId;
                    })[0];
                    expect(matchedRoute).to.equal(undefined,
                        "Got route when we shouldn't: " + JSON.stringify(matchedRoute));
                });
        });
        it("should not match an experienced route if it was deleted", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            return Database.deleteExperiencedRoute(matchedRouteId, transactionClient).then(success => {
                expect(success).to.be.true;
                return Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient);
            }).then(routes => {
                const matchedRoute = routes.filter((route) => {
                    return route.id === matchedRouteId;
                })[0];
                expect(matchedRoute).to.equal(undefined,
                    "Got route when we shouldn't: " + JSON.stringify(matchedRoute));
            });
        });
        it("should not match an experienced route if it is owned by that user", () => {
            let shouldNotMatchOwnRouteId;
            before("Create an experienced route from this user to test against", done => {
                Database.putExperiencedRoute(new ExperiencedRoute({
                    arrivalTime: "13:30:00+00",
                    days: ["tuesday", "friday", "sunday"],
                    departureTime: "12:45:00+00",
                    endPointName: "33 Stanley Street",
                    length: 5000,
                    owner: thisUserId,
                    route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                    startPointName: "112 Rachel Road",
                }), transactionClient)
                .then(routeId => {
                    shouldNotMatchOwnRouteId = routeId;
                    done();
                });
            });
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            // The userId is given, so the user's own experienced route will not be matched
            return Database.matchRoutes(matchParams, thisUserId, newArrivalDateTime, transactionClient)
                .then(routes => {
                    const matchedRoute = routes.filter((route) => {
                        return route.id === matchedRouteId;
                    })[0];
                    const nonMatchedRoute = routes.filter((route) => {
                        return route.id === shouldNotMatchOwnRouteId;
                    })[0];
                    expect(matchedRoute.owner.id).to.equal(matchedUserId, "Owner is not what was expected");
                    expect(nonMatchedRoute).to.equal(undefined,
                        "Got route when we shouldn't: " + JSON.stringify(nonMatchedRoute));
                });
        });
    });
    describe("Route Updating", () => {
        // insert an experienced route to update
        let updateExperiencedRouteId;
        let thisUserId;
        let routeData;
        beforeEach("Create user and route to update", done => {
            Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                routeData = new ExperiencedRoute({
                    arrivalTime: "13:30:00+00",
                    days: ["tuesday", "sunday"],
                    departureTime: "12:45:00+00",
                    endPointName: "33 Rachel Road",
                    length: 5000,
                    name: "Ride to work",
                    owner: thisUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                    startPointName: "122 Stanley Street",
                });
                return Database.putExperiencedRoute(routeData, transactionClient);
            })
            .then(routeId => {
                updateExperiencedRouteId = routeId;
                done();
            });
        });

        it("should update all properties at once", () => {
            const updates = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday"],
                departureTime: "12:00:00+00",
                id: updateExperiencedRouteId,
                name: "Ride home",
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(updates.days);
                expect(newRoute.arrivalTime).to.equal("13:00:00+00");
                expect(newRoute.departureTime).to.equal("12:00:00+00");
                expect(newRoute.name).to.equal("Ride home");
            });
        });
        it("should update one property at a time - arrivalTime", () => {
            const updates = {
                arrivalTime: "13:30:00+00",
                id: updateExperiencedRouteId,
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(routeData.days);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should update one property at a time - departureTime", () => {
            const updates = {
                departureTime: "12:45:00+00",
                id: updateExperiencedRouteId,
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(routeData.days);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(updates.departureTime);
            });
        });
        it("should update one property at a time - days", () => {
            const updates = {
                days: ["thursday", "friday"],
                id: updateExperiencedRouteId,
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(updates.days);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should update one property at a time - name", () => {
            const updates = {
                id: updateExperiencedRouteId,
                name: "Ride home",
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.name).to.equal(updates.name);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should not be able to update ownership", () => {
            const updates = {
                id: updateExperiencedRouteId,
                owner: userIds[0],
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.owner).to.eql(thisUserId);
            });
        });
        it("should not be able to update length", () => {
            const updates = {
                id: updateExperiencedRouteId,
                length: 200,
            };
            return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.length).to.eql(routeData.length);
            });
        });
        it("should not be able to update to an invalid departureTime", done => {
            const updates = {
                departureTime: "14:00:00+00",
                id: updateExperiencedRouteId,
            };
            const promise = Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid arrivalTime", done => {
            const updates = {
                arrivalTime: "12:00:00+00",
                id: updateExperiencedRouteId,
            };
            const promise = Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid departureTime + arrivalTime", done => {
            const updates = {
                arrivalTime: "12:00:00+00",
                departureTime: "13:00:00+00",
                id: updateExperiencedRouteId,
            };
            const promise = Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update route", done => {
            const updates = {
                id: updateExperiencedRouteId,
                route: [[8, 6.2], [5, 3.0]],
            };
            Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.route).not.to.eql(updates.route);
                done();
            });
        });
        it("should not be able to update startPointName", done => {
            const updates = {
                id: updateExperiencedRouteId,
                startPointName: "188 Andy Avenue",
            };
            Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.startPointName).not.to.eql(updates.startPointName);
                done();
            });
        });
        it("should not be able to update endPointName", done => {
            const updates = {
                endPointName: "2 Daniel Drive",
                id: updateExperiencedRouteId,
            };
            Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient)
            .then(originalRoute => {
                return Database.updateExperiencedRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getExperiencedRouteById(updateExperiencedRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.endPointName).not.to.eql(updates.endPointName);
                done();
            });
        });
    });
    describe("General Inexperienced Route functions", () => {
        let userId: string;
        beforeEach("Create user to own inexperiencedRoutes", done => {
            Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            },
            transactionClient).then(newUser => {
                userId = newUser.id;
                done();
            });
        });
        describe("Creation", () => {
            it("should create an inexperienced route", () => {
                let inexperiencedRouteData: InexperiencedRoute = {
                    arrivalDateTime: "2000-01-01T13:00:00+00",
                    deleted: false,
                    endPoint: [15, 15],
                    endPointName: "44 Simon Street",
                    length: 1000,
                    name: "Ride to the park",
                    notifyOwner: false,
                    radius: 1000,
                    reusable: true,
                    startPoint: [10, 10],
                    startPointName: "1 Denis Drive",
                };
                return Database.createInexperiencedRoute(userId, inexperiencedRouteData, transactionClient)
                .then(inexperiencedRouteId => {
                    return Database.sqlTransaction(
                        "SELECT arrivalDateTime, ST_AsText(endPoint) AS endPoint, notifyOwner, radius, " +
                        "ST_AsText(startPoint) AS startPoint, owner, length, name, startPointName, " +
                        "endPointName, reusable FROM inexperienced_routes WHERE id=$1",
                        ["" + inexperiencedRouteId],
                        transactionClient
                    ).then(result => {
                        expect(moment(result.rows[0].arrivaldatetime)
                            .isSame(inexperiencedRouteData.arrivalDateTime)).to.be.true;
                        expect(Database.pointStringToCoords(result.rows[0].endpoint))
                            .to.eql(inexperiencedRouteData.endPoint);
                        expect(Database.pointStringToCoords(result.rows[0].startpoint))
                            .to.eql(inexperiencedRouteData.startPoint);
                        expect(result.rows[0].notifyowner).to.equal(inexperiencedRouteData.notifyOwner);
                        expect(result.rows[0].radius).to.equal(inexperiencedRouteData.radius);
                        expect(result.rows[0].owner).to.equal(userId);
                        expect(result.rows[0].length).to.equal(inexperiencedRouteData.length);
                        expect(result.rows[0].name).to.equal(inexperiencedRouteData.name);
                        expect(result.rows[0].startpointname).to.equal(inexperiencedRouteData.startPointName);
                        expect(result.rows[0].endpointname).to.equal(inexperiencedRouteData.endPointName);
                        expect(result.rows[0].reusable).to.equal(inexperiencedRouteData.reusable);
                    });
                });
            });
            it("should create an inexperienced route that is not reusable", () => {
                let inexperiencedRouteData: InexperiencedRoute = {
                    arrivalDateTime: "2000-01-01T13:00:00+00",
                    deleted: false,
                    endPoint: [15, 15],
                    endPointName: "44 Simon Street",
                    length: 1000,
                    name: "Ride to the park",
                    notifyOwner: false,
                    radius: 1000,
                    reusable: false,
                    startPoint: [10, 10],
                    startPointName: "1 Denis Drive",
                };
                return Database.createInexperiencedRoute(userId, inexperiencedRouteData, transactionClient)
                .then(inexperiencedRouteId => {
                    return Database.sqlTransaction(
                        "SELECT arrivalDateTime, ST_AsText(endPoint) AS endPoint, notifyOwner, radius, " +
                        "ST_AsText(startPoint) AS startPoint, owner, length, name, startPointName, " +
                        "endPointName, reusable FROM inexperienced_routes WHERE id=$1",
                        ["" + inexperiencedRouteId],
                        transactionClient
                    ).then(result => {
                        expect(moment(result.rows[0].arrivaldatetime)
                            .isSame(inexperiencedRouteData.arrivalDateTime)).to.be.true;
                        expect(Database.pointStringToCoords(result.rows[0].endpoint))
                            .to.eql(inexperiencedRouteData.endPoint);
                        expect(Database.pointStringToCoords(result.rows[0].startpoint))
                            .to.eql(inexperiencedRouteData.startPoint);
                        expect(result.rows[0].notifyowner).to.equal(inexperiencedRouteData.notifyOwner);
                        expect(result.rows[0].radius).to.equal(inexperiencedRouteData.radius);
                        expect(result.rows[0].owner).to.equal(userId);
                        expect(result.rows[0].length).to.equal(inexperiencedRouteData.length);
                        expect(result.rows[0].name).to.equal(inexperiencedRouteData.name);
                        expect(result.rows[0].startpointname).to.equal(inexperiencedRouteData.startPointName);
                        expect(result.rows[0].endpointname).to.equal(inexperiencedRouteData.endPointName);
                        expect(result.rows[0].reusable).to.equal(inexperiencedRouteData.reusable);
                    });
                });
            });
            it("should not create an inexperienced route with an invalid arrivalTime", done => {
                let inexperiencedRouteData: InexperiencedRoute = {
                    arrivalDateTime: "I'm a little teapot",
                    deleted: false,
                    endPoint: [15, 15],
                    endPointName: "44 Simon Street",
                    length: 1000,
                    name: "Ride to the park",
                    notifyOwner: false,
                    radius: 1000,
                    reusable: true,
                    startPoint: [10, 10],
                    startPointName: "1 Denis Drive",
                };
                const promise = Database.createInexperiencedRoute(userId, inexperiencedRouteData, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Retrieval", () => {
            let inexperiencedRouteId;
            let spareUserId;
            beforeEach("Create an inexperienced route to be retrieved, and a second user with no inexperienced routes",
            done => {
                Database.createInexperiencedRoute(userId, {
                    arrivalDateTime: "2000-01-01T13:00:00+00",
                    deleted: false,
                    endPoint: [15, 15],
                    endPointName: "44 Simon Street",
                    length: 1000,
                    name: "Ride to the park",
                    notifyOwner: false,
                    radius: 1000,
                    reusable: true,
                    startPoint: [10, 10],
                    startPointName: "1 Denis Drive",
                },
                transactionClient).then(newInexperiencedRouteId => {
                    inexperiencedRouteId = newInexperiencedRouteId;
                }).then(() => {
                    Database.putUser({
                        email: "test2@example.com",
                        firstname: "Test",
                        id: "testuser2",
                        surname: "User 2",
                    },
                    transactionClient).then(newUser => {
                        spareUserId = newUser.id;
                        done();
                    });
                });
            });
            it("should get an inexperienced route by ID", () => {
                return Database.getInexperiencedRoutes({userId, id: inexperiencedRouteId}, transactionClient)
                .then(inexperiencedRoutes => {
                    expect(inexperiencedRoutes.filter(inexperiencedRoute => {
                        return inexperiencedRoute.id === inexperiencedRouteId;
                    }).length).to.equal(1);
                });
            });
            it("should not get an inexperienced route by an invalid ID", done => {
                const promise = Database.getInexperiencedRoutes({userId, id: -1}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get all of a user's inexperienced routes", () => {
                return Database.getInexperiencedRoutes({userId}, transactionClient)
                .then(inexperiencedRoutes => {
                    expect(inexperiencedRoutes.filter(inexperiencedRoute => {
                        return inexperiencedRoute.id === inexperiencedRouteId;
                    }).length).to.equal(1);
                });
            });
            it("should not get any inexperienced routes belonging to another user", done => {
                const promise = Database.getInexperiencedRoutes({
                    id: inexperiencedRouteId,
                    userId: spareUserId,
                }, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get any inexperienced routes for a user who has none", () => {
                return Database.getInexperiencedRoutes({userId: spareUserId}, transactionClient).then(result => {
                    expect(result.length).to.equal(0);
                });
            });
        });
        describe("Updating", () => {
            let inexperiencedRouteId;
            let existingInexperiencedRoute: InexperiencedRoute = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                deleted: false,
                endPoint: [15, 15],
                endPointName: "44 Simon Street",
                length: 1000,
                name: "Ride to the park",
                notifyOwner: false,
                radius: 1000,
                reusable: true,
                startPoint: [10, 10],
                startPointName: "1 Denis Drive",
            };
            beforeEach("Make an inexperiencedRoute to update", done => {
                Database.createInexperiencedRoute(userId, existingInexperiencedRoute,
                transactionClient).then(newInexperiencedRouteId => {
                    inexperiencedRouteId = newInexperiencedRouteId;
                    existingInexperiencedRoute.owner = userId;
                    existingInexperiencedRoute.id = <number> newInexperiencedRouteId;
                    done();
                });
            });
            // Go through these objects and try to update the inexperiencedRoute with them
            let updateables = [
                {arrivalDateTime: "2000-01-01T13:35:00+00"},
                {name: "My best ride ever"},
                {notifyOwner: true},
                {radius: 999},
                {
                    arrivalDateTime: "2000-01-01T13:30:00+00",
                    name: "My best ride ever",
                    notifyOwner: true,
                    radius: 1230,
                },
            ];
            for (let i = 0; i < updateables.length; i++) {
                let updates = updateables[i];
                let keys = Object.keys(updates).join(", ");
                it("should update " + keys, () => {
                    return Database.updateInexperiencedRoute(existingInexperiencedRoute, updates, transactionClient)
                    .then(() => {
                        return Database.sqlTransaction("SELECT arrivalDateTime, radius, notifyOwner, " +
                        "ST_AsText(endPoint) as endPoint, ST_AsText(startPoint) as startPoint, " +
                        "name, length, startPointName, endPointName " +
                        "FROM inexperienced_routes WHERE id=$1;", ["" + inexperiencedRouteId], transactionClient)
                        .then(result => {
                            return result.rows[0];
                        });
                    }).then(user => {
                        for (let key of Object.keys(updates)) {
                            if (key === "startPoint" || key === "endPoint") {
                                expect(Database.pointStringToCoords(user[key.toLowerCase()]))
                                    .to.eql(updates[key]);
                            } else if (key === "arrivalDateTime") {
                                expect(moment(user[key.toLowerCase()]).isSame(updates[key])).to.be.true;
                            } else {
                                expect(user[key.toLowerCase()]).to.equal(updates[key]);
                            }
                        }
                    });
                });
            }
        });
        describe("Deleting", () => {
            let inexperiencedRouteId;
            let ownerId;
            beforeEach("Make a user and inexperiencedRoute to delete", done => {
                Database.putUser({
                    email: "test2@example.com",
                    firstname: "Test",
                    id: "testuser2",
                    surname: "User 2",
                },
                transactionClient).then(newUser => {
                    ownerId = newUser.id;
                    return Database.createInexperiencedRoute(ownerId, {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        deleted: false,
                        endPoint: [15, 15],
                        endPointName: "44 Simon Street",
                        length: 1000,
                        name: "Ride to the park",
                        notifyOwner: false,
                        radius: 1000,
                        reusable: true,
                        startPoint: [10, 10],
                        startPointName: "1 Denis Drive",
                    },
                    transactionClient);
                }).then(newInexperiencedRouteId => {
                    inexperiencedRouteId = newInexperiencedRouteId;
                    done();
                });
            });
            it("should delete an inexperiencedRoute", () => {
                return Database.deleteInexperiencedRoute(inexperiencedRouteId, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.sqlTransaction("SELECT * FROM inexperienced_routes WHERE id=$1;",
                    ["" + inexperiencedRouteId], transactionClient)
                    .then(results => {
                        expect(results.rows[0].deleted).to.be.true;
                    });
                });
            });
            it("should delete an inexperiencedRoute when it's owner is deleted", () => {
                return Database.deleteUser(ownerId, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.sqlTransaction("SELECT * FROM inexperienced_routes WHERE id=$1;",
                    ["" + inexperiencedRouteId], transactionClient)
                    .then(results => {
                        expect(results.rows.length).to.equal(0);
                    });
                });
            });
            it("should not delete an inexperiencedRoute with an invalid id", done => {
                const promise = Database.deleteInexperiencedRoute(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Retrieval after deleting", () => {
            let inexperiencedRouteId1;
            let inexperiencedRouteId2;
            beforeEach("Set up two inexperienced routes", () => {
                return Database.createInexperiencedRoute(userId, {
                        arrivalDateTime: "2017-11-15T13:00:00+00",
                        deleted: false,
                        endPoint: [15, 15],
                        endPointName: "44 Simon Street",
                        length: 1000,
                        name: "Ride to the park",
                        notifyOwner: false,
                        radius: 1000,
                        reusable: true,
                        startPoint: [10, 10],
                        startPointName: "1 Denis Drive",
                    },
                    transactionClient).then(newInexperiencedRouteId => {
                        inexperiencedRouteId1 = newInexperiencedRouteId;
                        return Database.createInexperiencedRoute(userId, {
                            arrivalDateTime: "2017-11-16T09:00:00+00",
                            deleted: false,
                            endPoint: [15, 15],
                            endPointName: "1 Sekforde Street",
                            length: 2200,
                            name: "Ride to work",
                            notifyOwner: false,
                            radius: 1000,
                            reusable: true,
                            startPoint: [10, 10],
                            startPointName: "Liverpool Street",
                        },
                        transactionClient);
                    }).then(newInexperiencedRouteId => {
                        inexperiencedRouteId2 = newInexperiencedRouteId;
                    });
            });
            it("should only get non-deleted reusable inexperienced routes if includedeleted is set to false", () => {
                return Database.deleteInexperiencedRoute(inexperiencedRouteId1, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.getInexperiencedRoutes({userId, includedeleted: false}, transactionClient);
                }).then(inexperiencedRoutes => {
                    expect(inexperiencedRoutes.length).to.equal(1);
                    expect(inexperiencedRoutes[0].deleted).to.be.false;
                });
            });
            it("should get all reusable inexperienced routes if includedeleted is set to true", () => {
                return Database.deleteInexperiencedRoute(inexperiencedRouteId1, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.getInexperiencedRoutes({userId, includedeleted: true}, transactionClient);
                }).then(inexperiencedRoutes => {
                    expect(inexperiencedRoutes.length).to.equal(2);
                    expect(inexperiencedRoutes[1].deleted).to.be.true;
                });
            });
        });
    });
    describe("Buddy Requests", () => {
        let expUserId;  // The experienced User id
        let experiencedRoute;   // The experienced Route
        let inexpUserId;  // The inexperienced User id
        let inexperiencedRoute; // The inexperienced Rout
        let buddyRequestObject; // A BuddyRequest object with the ids all set correctly
        beforeEach("Create two users to send/receive the Buddy requests, with respective routes", () => {
            return Database.putUser({
                email: "experienced@example.com",
                firstname: "Experienced",
                id: "experienceduser",
                surname: "User",
            }, transactionClient)
            .then(newUser => {
                expUserId = newUser.id;
            })
            .then(() => {
                return Database.putUser({
                    email: "inexperienced@example.com",
                    firstname: "Inexperienced",
                    id: "inexperienceduser",
                    surname: "User",
                },
                transactionClient);
            }).then(newUser => {
                inexpUserId = newUser.id;
            }).then((): Promise<number> => {
                return Database.putExperiencedRoute(new ExperiencedRoute({
                    arrivalTime: "14:00:00+00",
                    days: ["tuesday", "sunday"],
                    departureTime: "13:00:00+00",
                    endPointName: "112 Rachel Road",
                    length: 5000,
                    name: "Ride to work",
                    owner: expUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                    startPointName: "33 Stanley Street",
                }), transactionClient);
            }).then(routeId => {
                experiencedRoute = routeId;
            }).then(() => {
                return Database.createInexperiencedRoute(inexpUserId, new InexperiencedRoute({
                    arrivalDateTime: "2017-11-12T13:00:00+00",
                    endPoint: [15, 15],
                    endPointName: "112 Rachel Road",
                    length: 5100,
                    name: "Ride home",
                    notifyOwner: false,
                    radius: 1000,
                    startPoint: [10, 10],
                    startPointName: "33 Stanley Street",
                }), transactionClient);
            }).then(routeId => {
                inexperiencedRoute = routeId;
                buddyRequestObject = {  // A general buddyRequest Object, which we can copy
                    averageSpeed: 5,
                    created: "2017-11-08T10:24:28.684Z",
                    divorcePoint: [1, 1],
                    divorcePointName: "99 Chris Crescent",
                    divorceTime: "2017-11-12T12:00:28.684Z",
                    experiencedRoute,
                    experiencedRouteName: "Ride to work",
                    experiencedUser: expUserId,
                    inexperiencedRoute,
                    inexperiencedRouteName: "My First Ride",
                    length: 5000,
                    meetingPoint: [0, 0],
                    meetingPointName: "1 Shelly Street",
                    meetingTime: "2017-11-12T11:34:28.684Z",
                    owner: inexpUserId,
                    reason: "",
                    route: [[0, 0], [0.5, 0.5], [1, 1]],
                    status: "pending",
                    updated: "2017-11-08T10:24:28.684Z",
                };
            });
        });
        describe("Creation", () => {
            it("should create a BuddyRequest", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(buddyRequestId => {
                    return Database.sqlTransaction("SELECT * FROM buddy_requests where id=$1",
                        ["" + buddyRequestId], transactionClient)
                    .then(results => {
                        expect(results.rows[0]).to.not.be.undefined;
                        expect(results.rows[0].averagespeed).to.equal(buddyRequestObject.averageSpeed);
                        expect(moment(results.rows[0].created).isSame(buddyRequestObject.created)).to.be.true;
                        expect(moment(results.rows[0].divorcetime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                        expect(results.rows[0].experiencedroute).to.equal(buddyRequestObject.experiencedRoute);
                        expect(results.rows[0].experiencedroutename).to.equal(buddyRequestObject.experiencedRouteName);
                        expect(results.rows[0].experienceduser).to.equal(buddyRequestObject.experiencedUser);
                        expect(results.rows[0].inexperiencedroute).to.equal(buddyRequestObject.inexperiencedRoute);
                        expect(results.rows[0].inexperiencedroutename)
                            .to.equal(buddyRequestObject.inexperiencedRouteName);
                        expect(moment(results.rows[0].meetingtime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                        expect(results.rows[0].owner).to.equal(buddyRequestObject.owner);
                        expect(results.rows[0].length).to.equal(buddyRequestObject.length);
                        expect(results.rows[0].status).to.equal(buddyRequestObject.status);
                        expect(results.rows[0].reason).to.equal(buddyRequestObject.reason);
                        expect(moment(results.rows[0].updated).isSame(buddyRequestObject.updated)).to.be.true;
                        expect(results.rows[0].meetingpointname).to.equal(buddyRequestObject.meetingPointName);
                        expect(results.rows[0].divorcepointname).to.equal(buddyRequestObject.divorcePointName);
                    });
                });
            });
            it("should not be able to create a review when creating a BuddyRequest", () => {
                let obj = Object.assign({}, buddyRequestObject);
                obj.review = 1;
                return Database.createBuddyRequest(obj, transactionClient).then(buddyRequestId => {
                    return Database.sqlTransaction("SELECT * FROM buddy_requests where id=$1",
                        ["" + buddyRequestId], transactionClient)
                    .then(results => {
                        expect(results.rows[0]).to.not.be.undefined;
                        expect(results.rows[0].review).to.equal(0);
                    });
                });
            });
        });
        describe("Retrieval", () => {
            let firstBuddyRequestId;
            let secondBuddyRequestId;
            let randomOtherId;
            beforeEach("Create 2 BuddyRequests to get, and a random user", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(buddyRequestId => {
                    firstBuddyRequestId = buddyRequestId;
                }).then(() => {
                    return Database.createBuddyRequest(buddyRequestObject, transactionClient);
                }).then(buddyRequestId => {
                    secondBuddyRequestId = buddyRequestId;
                }).then(() => {
                    return Database.putUser({
                        email: "random@example.com",
                        firstname: "Unattached",
                        id: "randomuser",
                        surname: "User",
                    }, transactionClient);
                }).then(user => {
                    randomOtherId = user.id;
                });
            });
            it("should get a BuddyRequest by ID for the inexperienced user", () => {
                return Database.getSentBuddyRequests({id: firstBuddyRequestId, userId: inexpUserId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(1);
                    expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[0].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[0].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[0].status).to.equal(buddyRequestObject.status);
                    expect(buddyRequests[0].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[0].review).to.equal(0);
                });
            });
            it("should get a BuddyRequest by ID for the experienced user", () => {
                return Database.getReceivedBuddyRequests({id: firstBuddyRequestId, userId: expUserId},
                    transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(1);
                    expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[0].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[0].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[0].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[0].status).to.equal(buddyRequestObject.status);
                    expect(buddyRequests[0].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[0].review).to.equal(0);
                });
            });
            it("should get all of an inexperienced user's sent BuddyRequests", () => {
                return Database.getSentBuddyRequests({userId: inexpUserId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(2);
                    expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[0].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[0].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[0].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[0].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(buddyRequests[0].status).to.equal(buddyRequestObject.status);
                    expect(buddyRequests[0].review).to.equal(0);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[1].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[1].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[1].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[1].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[1].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[1].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[1].length).to.equal(buddyRequestObject.length);
                    expect(buddyRequests[1].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[1].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(moment(buddyRequests[1].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[1].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[1].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                    expect(buddyRequests[1].status).to.equal(buddyRequestObject.status);
                    expect(moment(buddyRequests[1].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[1].myRoute).to.eql([[10, 10], [15, 15]]);
                    expect(buddyRequests[1].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[1].review).to.equal(0);
                });
            });
            it("should get all of an experienced user's received BuddyRequests", () => {
                return Database.getReceivedBuddyRequests({userId: expUserId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(2);
                    expect(buddyRequests[0].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[0].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[0].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[0].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[0].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[0].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[0].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[0].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[0].length).to.equal(buddyRequestObject.length);
                    expect(buddyRequests[0].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(moment(buddyRequests[0].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[0].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[0].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[0].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[0].route).to.eql(buddyRequestObject.route);
                    expect(buddyRequests[0].status).to.equal(buddyRequestObject.status);
                    expect(moment(buddyRequests[0].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[0].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[0].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[0].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[0].review).to.equal(0);
                    expect(buddyRequests[1].averageSpeed).to.equal(buddyRequestObject.averageSpeed);
                    expect(moment(buddyRequests[1].created).isSame(buddyRequestObject.created)).to.be.true;
                    expect(moment(buddyRequests[1].divorceTime).isSame(buddyRequestObject.divorceTime)).to.be.true;
                    expect(buddyRequests[1].divorcePoint).to.eql(buddyRequestObject.divorcePoint);
                    expect(buddyRequests[1].experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
                    expect(buddyRequests[1].experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
                    expect(buddyRequests[1].experiencedUser).to.equal(buddyRequestObject.experiencedUser);
                    expect(buddyRequests[1].inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
                    expect(buddyRequests[1].inexperiencedRouteName)
                        .to.equal(buddyRequestObject.inexperiencedRouteName);
                    expect(buddyRequests[1].length).to.equal(buddyRequestObject.length);
                    expect(moment(buddyRequests[1].meetingTime).isSame(buddyRequestObject.meetingTime)).to.be.true;
                    expect(buddyRequests[1].meetingPoint).to.eql(buddyRequestObject.meetingPoint);
                    expect(buddyRequests[1].owner).to.equal(buddyRequestObject.owner);
                    expect(buddyRequests[1].reason).to.equal(buddyRequestObject.reason);
                    expect(buddyRequests[1].route).to.eql(buddyRequestObject.route);
                    expect(buddyRequests[1].status).to.equal(buddyRequestObject.status);
                    expect(moment(buddyRequests[1].updated).isSame(buddyRequestObject.updated)).to.be.true;
                    expect(buddyRequests[1].meetingPointName).to.equal(buddyRequestObject.meetingPointName);
                    expect(buddyRequests[1].myRoute).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(buddyRequests[1].divorcePointName).to.equal(buddyRequestObject.divorcePointName);
                    expect(buddyRequests[1].review).to.equal(0);
                });
            });
            it("should set the otherUser to the experiencedUser when the inexperiencedUser gets it", () => {
                return Database.getSentBuddyRequests({id: firstBuddyRequestId, userId: inexpUserId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests[0].otherUser.id).to.equal(expUserId);
                });
            });
            it("should set the otherUser to the inexperiencedUser when the experiencedUser gets it", () => {
                return Database.getReceivedBuddyRequests({id: firstBuddyRequestId, userId: expUserId},
                    transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests[0].otherUser.id).to.equal(inexpUserId);
                });
            });
            it("should not get an experienced user's received BuddyRequests when looking for sent ones", () => {
                return Database.getSentBuddyRequests({userId: expUserId}, transactionClient).then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(0);
                });
            });
            it("should not get an inexperienced user's sent BuddyRequests when looking for received ones", () => {
                return Database.getReceivedBuddyRequests({userId: inexpUserId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.length).to.equal(0);
                });
            });
            it("should not get a sent BuddyRequest by an invalid ID", done => {
                const promise = Database.getSentBuddyRequests({id: -1, userId: inexpUserId}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get another user's sent BuddyRequest", done => {
                const promise = Database.getSentBuddyRequests({id: firstBuddyRequestId, userId: randomOtherId},
                    transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get a received BuddyRequest by an invalid ID", done => {
                const promise = Database.getReceivedBuddyRequests({id: -1, userId: inexpUserId}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get another user's received BuddyRequest", done => {
                const promise = Database.getReceivedBuddyRequests({id: firstBuddyRequestId, userId: randomOtherId},
                    transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Updating", () => {
            let buddyRequestId;
            let existingBuddyRequest;
            beforeEach("Create a BuddyRequest to update", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(newBuddyRequestId => {
                    buddyRequestId = newBuddyRequestId;
                    existingBuddyRequest = Object.assign({}, buddyRequestObject);
                    existingBuddyRequest.id = newBuddyRequestId;
                });
            });
            // These two lists are updates objects that should/shouldn't succede
            const thingsThatCanBeUpdated = [
                {meetingTime: "2017-11-12T10:20:28.684Z"},
                {divorceTime: "2017-11-12T12:12:12.684Z"},
                {meetingPoint: [0.5, 0.5]},
                {divorcePoint: [0.6, 0.6]},
                {meetingPointName: "32 Arthur Avenue"},
                {divorcePointName: "64 Derek Drive"},
                {status: "rejected"},
                {review: 5},
                {review: 1},
                {review: 0},
                {length: 1234},
                {reason: "Excellent Reason"},
                {   // All at once
                    divorcePoint: [0.6, 0.6],
                    divorcePointName: "64 Derek Drive",
                    divorceTime: "2017-11-12T12:12:12.684Z",
                    length: 1234,
                    meetingPoint: [0.5, 0.5],
                    meetingPointName: "32 Arthur Avenue",
                    meetingTime: "2017-11-12T10:20:28.684Z",
                    reason: "Excellent Reason",
                    review: 1,
                    status: "rejected",
                },
            ];
            // These have a "error" property.
            // If it is undefined, the update should fail silently, and just not have cahnged anything
            // If it is a truthy value, expect the update to be rejected
            const thingsThatCannotBeUpdated: any[] = [
                {owner: -1},
                {id: -1},
                {experiencedUser: -1},
                {experiencedRoute: -1},
                {experiencedRouteName: "A silly name!"},
                {inexperiencedRoute: -1},
                {inexperiencedRouteName: "An even sillier name!"},
                {averageSpeed: 200},
                {created: "2000-01-01T12:00:00.000Z"},
                {updated: "2000-01-01T12:00:00.000Z"},
                {error: "400:BuddyRequest review must be between 1 and 5", review: 6},
                {error: "400:BuddyRequest review must be between 1 and 5", review: -2},
                {route: [[1, 1], [0.5, 0.5], [2, 2]]},
                {
                    divorceTime: "2017-11-12T10:12:12.684Z",
                    error: "400:Divorce time is before Meeting time",
                    meetingTime: "2017-11-12T12:20:28.684Z",
                },
            ];
            let mostRecentlyUpdated = moment();
            for (let updates of thingsThatCanBeUpdated) {
                const keys = Object.keys(updates).join(", ");
                it("should update " + keys, () => {
                    return Database.updateBuddyRequest(existingBuddyRequest, _.cloneDeep(updates),
                    transactionClient).then(() => {
                        return Database.getSentBuddyRequests({id: buddyRequestId, userId: existingBuddyRequest.owner},
                            transactionClient);
                    }).then(buddyRequests => {
                        for (let key in updates) {
                            if (key.indexOf("Time") !== -1) {
                                expect(moment(buddyRequests[0][key]).isSame(updates[key])).to.be.true;
                            } else {
                                expect(buddyRequests[0][key]).to.eql(updates[key]);
                            }
                        }
                        expect(moment(mostRecentlyUpdated).isBefore(buddyRequests[0].updated)).to.be.true;
                        mostRecentlyUpdated = moment(buddyRequests[0].updated);
                    });
                });
            }
            mostRecentlyUpdated = moment();
            for (let updates of thingsThatCannotBeUpdated) {
                const updateables = _.omit(updates, ["error"]);
                const keys = Object.keys(updateables).join(", ");
                it("should fail to update " + keys + (updates.error ? ", and throw an error" : ""), () => {
                    if (updates.error) {
                        expect(() => {
                            Database.updateBuddyRequest(existingBuddyRequest, _.cloneDeep(updateables),
                                transactionClient);
                        }).to.throw(updates.error);
                    } else {
                        return Database.updateBuddyRequest(existingBuddyRequest, _.cloneDeep(updateables),
                            transactionClient)
                        .then(() => {
                            return Database.getSentBuddyRequests(
                                {id: buddyRequestId, userId: existingBuddyRequest.owner},
                                transactionClient);
                            }).then(buddyRequests => {
                                for (let key in updateables) {
                                    if (key.indexOf("Time") !== -1) {
                                        expect(moment(buddyRequests[0][key]).isSame(updateables[key])).to.be.false;
                                    } else {
                                        expect(buddyRequests[0][key]).to.not.eql(updateables[key]);
                                    }
                                }
                                expect(moment(mostRecentlyUpdated).isBefore(buddyRequests[0].updated)).to.be.true;
                            });
                    }
                });
            }
        });

        describe("Updating status after route deletion", () => {
            let experiencedRouteId2;
            let inexperiencedRouteId2;
            let inexpUserId2;
            let buddyRequestId1;
            let buddyRequestId2;
            let buddyRequestObject2;

            beforeEach("Create another experienced route for the experienced user /" +
                " Create another inexperienced user and a new inexperienced route /" +
                " Create two buddy requests to update for comparison", () => {
                return Database.putExperiencedRoute(new ExperiencedRoute({
                    arrivalTime: "14:00:00+00",
                    days: ["monday", "friday"],
                    departureTime: "13:00:00+00",
                    endPointName: "112 Rachel Road",
                    length: 5000,
                    name: "Ride to work",
                    owner: expUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                    startPointName: "33 Stanley Street",
                }), transactionClient)
                .then(routeId => {
                    experiencedRouteId2 = routeId;
                    return Database.putUser({
                        email: "inexperienced2@example.com",
                        firstname: "Inexperienced",
                        id: "inexperienceduser2",
                        surname: "User 2",
                    }, transactionClient);
                })
                .then(newUser => {
                    inexpUserId2 = newUser.id;
                    return Database.createInexperiencedRoute(inexpUserId2, new InexperiencedRoute({
                        arrivalDateTime: "2017-11-14T13:00:00+00",
                        endPoint: [15, 15],
                        endPointName: "112 Rachel Road",
                        length: 5100,
                        name: "Ride home on Tuesday",
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                        startPointName: "33 Stanley Street",
                    }), transactionClient);
                })
                .then(routeId => {
                    inexperiencedRouteId2 = routeId;
                    buddyRequestObject2 = {
                        averageSpeed: 5,
                        created: "2017-11-08T11:24:28.684Z",
                        divorcePoint: [1, 1],
                        divorcePointName: "99 Chris Crescent",
                        divorceTime: "2017-11-14T12:00:28.684Z",
                        experiencedRoute: experiencedRouteId2,
                        experiencedRouteName: "Ride to work",
                        experiencedUser: expUserId,
                        inexperiencedRoute: inexperiencedRouteId2,
                        inexperiencedRouteName: "My First Ride",
                        length: 5000,
                        meetingPoint: [0, 0],
                        meetingPointName: "1 Shelly Street",
                        meetingTime: "2017-11-14T11:34:28.684Z",
                        owner: inexpUserId2,
                        reason: "",
                        route: [[0, 0], [0.5, 0.5], [1, 1]],
                        status: "pending",
                        updated: "2017-11-08T11:24:28.684Z",
                    };
                    return Database.createBuddyRequest(buddyRequestObject, transactionClient);
                })
                .then(newBuddyRequestId => {
                    buddyRequestId1 = newBuddyRequestId;
                    return Database.createBuddyRequest(buddyRequestObject2, transactionClient);
                })
                .then(newBuddyRequestId => {
                    buddyRequestId2 = newBuddyRequestId;
                });
            });

            it("Should only update status for any buddy requests with the deleted exp route", () => {
               return Database.deleteExperiencedRoute(experiencedRoute, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId1, userId: inexpUserId}, transactionClient);
                }).then(buddyRequests => {
                    expect(buddyRequests[0].status).to.equal("canceled");
                    return Database.getSentBuddyRequests({id: buddyRequestId2, userId: inexpUserId2}
                            , transactionClient);
                }).then(buddyRequests => {
                    expect(buddyRequests[0].status).to.equal("pending");
                });
            });

            it("Should only update status for any buddy requests with the deleted inexp route", () => {
                return Database.deleteInexperiencedRoute(inexperiencedRoute, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId1, userId: inexpUserId}, transactionClient);
                }).then(buddyRequests => {
                    expect(buddyRequests[0].status).to.equal("canceled");
                    return Database.getSentBuddyRequests({id: buddyRequestId2, userId: inexpUserId2}
                            , transactionClient);
                }).then(buddyRequests => {
                    expect(buddyRequests[0].status).to.equal("pending");
                });
            });

            it("Should only update status for any buddy requests with the deleted user", () => {
                return Database.deleteUser(inexpUserId2, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId1, userId: inexpUserId}, transactionClient);
                }).then(buddyRequests => {
                    expect(buddyRequests[0].status).to.equal("pending");
                    return Database.getSentBuddyRequests({id: buddyRequestId2, userId: inexpUserId2}
                            , transactionClient);
                }).catch(err => {
                    // Inexperienced test user 2 has been deleted, so the buddy request 2 does not exist
                    expect(err.message).to.equal("404:BuddyRequest does not exist");
                });
            });
        });

        describe("Reviewing", () => {
            let buddyRequestId;
            beforeEach("Create a BuddyRequest to review", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(newBuddyRequestId => {
                    buddyRequestId = newBuddyRequestId;
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(buddyRequests => {
                    const updates = {
                        status: "accepted",
                    };
                    return Database.updateBuddyRequest(buddyRequests[0], updates, transactionClient);
                });
            });
            it("Should be able to review a buddy request as a 1", () => {
                return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient)
                .then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(1,
                        "Review was not saved. Tried to set it to 1 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("completed",
                        "Status was not set. Should be 'comleted' but got " + buddyRequest.status);
                });
            });
            it("Should be able to review a buddy request as a 5", () => {
                return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 5, transactionClient)
                .then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(5,
                        "Review was not saved. Tried to set it to 5 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("completed",
                        "Status was not set. Should be 'comleted' but got " + buddyRequest.status);
                });
            });
            it("Should update the inexperienced user", () => {
                return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient)
                .then(() => {
                    return Database.getUserById(inexpUserId, transactionClient);
                }).then(user => {
                    expect(user.distance).to.equal(buddyRequestObject.length,
                        "User's distance was not updated. Should be " +
                        buddyRequestObject.length + " but got " + user.distance);
                    expect(user.helpedCount).to.equal(1,
                        "User's helpedCount was not updated. Should be 1 but got " + user.helpedCount);
                });
            });
            it("Should update the experienced user", () => {
                return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient)
                .then(() => {
                    return Database.getUserById(expUserId, transactionClient);
                }).then(user => {
                    expect(user.distance).to.equal(buddyRequestObject.length,
                        "User's distance was not updated. Should be " +
                        buddyRequestObject.length + " but got " + user.distance);
                    expect(user.usersHelped).to.equal(1,
                        "User's usersHelped was not updated. Should be 1 but got " + user.usersHelped);
                    expect(user.rating).to.equal(1,
                        "User's rating was not updated. Should be 1 but got " + user.rating);
                });
            });
            it("Should be able to update a review", () => {
                return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient)
                .then(() => {
                    return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 3, transactionClient);
                }).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    // Buddy request should have new review
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(3,
                        "Review was not updated. By here it should be -1, but got " + buddyRequest.review);
                    return Database.getUserById(inexpUserId, transactionClient);
                }).then(user => {
                    // InexperiencedUser should not have changed
                    expect(user.distance).to.equal(buddyRequestObject.length,
                        "Inexperienced user's distance was updated. Should be " +
                        buddyRequestObject.length + " but got " + user.distance);
                    expect(user.helpedCount).to.equal(1,
                        "Inexperienced user's helpedCount was updated. Should be 1 but got " + user.usersHelped);
                    return Database.getUserById(expUserId, transactionClient);
                }).then(user => {
                    // ExperiencedUser should not have changed except for the rating
                    expect(user.distance).to.equal(buddyRequestObject.length,
                        "Experienced user's distance was updated. Should be " +
                        buddyRequestObject.length + " but got " + user.distance);
                    expect(user.usersHelped).to.equal(1,
                        "Experienced user's usersHelped was updated. Should be 1 but got " + user.usersHelped);
                    expect(user.rating).to.equal(3,
                        "Experienced user's rating was not updated. Should be 3 but got " + user.rating);
                });
            });
            it("Should not be able to review a buddy request over 5", () => {
                try {
                    Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 6, transactionClient).then(() => {
                        expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                            "'400:BuddyRequest review must be between 1 and 5'");
                    });
                } catch (err) {
                    expect(err.message).to.equal("400:BuddyRequest review must be between 1 and 5");
                }
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was set. Should still be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("accepted",
                        "Status was set. Should still be 'accpeted' but got " + buddyRequest.status);
                });
            });
            it("Should not be able to review a buddy request with 0", () => {
                try {
                    Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 0, transactionClient).then(() => {
                        expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                            "'400:BuddyRequest review must be between 1 and 5'");
                    });
                } catch (err) {
                    expect(err.message).to.equal("400:BuddyRequest review must be between 1 and 5");
                }
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.status).to.equal("accepted",
                        "Status was set. Should still be 'accpeted' but got " + buddyRequest.status);
                });
            });
            it("Should not be able to review a buddy request negatively", () => {
                try {
                    Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, -1, transactionClient).then(() => {
                        expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                            "'400:BuddyRequest review must be between 1 and 5'");
                    });
                } catch (err) {
                    expect(err.message).to.equal("400:BuddyRequest review must be between 1 and 5");
                }
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was set. Should still be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("accepted",
                        "Status was set. Should still be 'accpeted' but got " + buddyRequest.status);
                });
            });
            it("Should not let the experiencedUser review a buddy request", () => {
                return Database.updateBuddyRequestReview(expUserId, buddyRequestId, 1, transactionClient)
                .then(() => {
                    expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                        "'404:BuddyRequest doesn't exist', but it resolved");
                }, err => {
                expect(err.message).to.equal("404:BuddyRequest does not exist");
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was saved. Should be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("accepted",
                        "Status was set. Should be 'accepted' but got " + buddyRequest.status);
                });
            });
            it("Should not be able to review a rejected BuddyRequest", () => {
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    const updates = {
                        status: "rejected",
                    };
                    return Database.updateBuddyRequest(requests[0], updates, transactionClient);
                }).then(() => {
                    return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient);
                }).then(() => {
                    expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                        "'400:Can't review a rejected BuddyRequest', but it resolved");
                }, err => {
                    expect(err.message).to.equal("400:Can't review a rejected BuddyRequest");
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was saved. Should still be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("rejected",
                        "Status was set. Should be 'rejected' but got " + buddyRequest.status);
                });
            });
            it("Should not be able to review a pending BuddyRequest", () => {
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    const updates = {
                        status: "pending",
                    };
                    return Database.updateBuddyRequest(requests[0], updates, transactionClient);
                }).then(() => {
                    return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient);
                }).then(() => {
                    expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                        "'400:Can't review a pending BuddyRequest', but it resolved");
                }, err => {
                    expect(err.message).to.equal("400:Can't review a pending BuddyRequest");
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was saved. Should still be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("pending",
                        "Status was set. Should be 'pending' but got " + buddyRequest.status);
                });
            });
            it("Should not be able to review a canceled BuddyRequest", () => {
                return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient)
                .then(requests => {
                    const updates = {
                        status: "canceled",
                    };
                    return Database.updateBuddyRequest(requests[0], updates, transactionClient);
                }).then(() => {
                    return Database.updateBuddyRequestReview(inexpUserId, buddyRequestId, 1, transactionClient);
                }).then(() => {
                    expect(false).to.equal(true, "Expected this promise to be rejected with: " +
                        "'400:Can't review a canceled BuddyRequest', but it resolved");
                }, err => {
                    expect(err.message).to.equal("400:Can't review a canceled BuddyRequest");
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(requests => {
                    let buddyRequest = requests[0];
                    expect(buddyRequest.review).to.equal(0,
                        "Review was saved. Should still be 0 but got " + buddyRequest.review);
                    expect(buddyRequest.status).to.equal("canceled",
                        "Status was set. Should be 'canceled' but got " + buddyRequest.status);
                });
            });
        });
        describe("Deletion", () => {
            let buddyRequestId;
            beforeEach("Create a BuddyRequest to delete", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(newBuddyRequestId => {
                    buddyRequestId = newBuddyRequestId;
                });
            });
            it("should delete a BuddyRequest", done => {
                Database.deleteBuddyRequest(buddyRequestId, transactionClient).then(() => {
                    const promise = Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId},
                        transactionClient);
                    expect(promise).to.be.rejected.and.notify(done);
                });
            });
            it("should not delete a BuddyRequest with an invalid id", done => {
                const promise = Database.deleteBuddyRequest(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should cancel the buddy request when the experienced user is deleted", () => {
                return Database.deleteUser(expUserId, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(results => {
                    expect(results.length).to.equal(1);
                    expect(results[0].status).to.equal("canceled");
                    expect(results[0].reason).to.equal("Experienced User has deleted their account");
                });
            });
        });
        describe("Special status changes", () => {
            let buddyRequestId;
            beforeEach("Create a BuddyRequest to affect", () => {
                return Database.createBuddyRequest(buddyRequestObject, transactionClient).then(newBuddyRequestId => {
                    buddyRequestId = newBuddyRequestId;
                });
            });
            it("should cancel the buddy request when the inexperienced user is deleted", () => {
                return Database.deleteUser(inexpUserId, transactionClient).then(() => {
                    return Database.getReceivedBuddyRequests({id: buddyRequestId, userId: expUserId},
                        transactionClient);
                }).then(results => {
                    expect(results.length).to.equal(1);
                    expect(results[0].status).to.equal("canceled");
                    expect(results[0].reason).to.equal("Inexperienced User has deleted their account");
                });
            });
            it("should cancel the buddy request when the experienced user is deleted", () => {
                return Database.deleteUser(expUserId, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId}, transactionClient);
                }).then(results => {
                    expect(results.length).to.equal(1);
                    expect(results[0].status).to.equal("canceled");
                    expect(results[0].reason).to.equal("Experienced User has deleted their account");
                });
            });
            it("should cancel the buddy request when the experienced route is deleted", () => {
                return Database.deleteExperiencedRoute(experiencedRoute, transactionClient).then(() => {
                    return Database.getSentBuddyRequests({id: buddyRequestId, userId: inexpUserId},
                        transactionClient);
                }).then(results => {
                    expect(results.length).to.equal(1);
                    expect(results[0].status).to.equal("canceled");
                    expect(results[0].reason).to.equal("Experienced User has deleted the route \"Ride to work\"");
                });
            });
            it("should cancel the buddy request when the inexperienced route is deleted", () => {
                return Database.deleteInexperiencedRoute(inexperiencedRoute, transactionClient).then(() => {
                    return Database.getReceivedBuddyRequests({id: buddyRequestId, userId: expUserId},
                        transactionClient);
                }).then(results => {
                    expect(results.length).to.equal(1);
                    expect(results[0].status).to.equal("canceled");
                    expect(results[0].reason).to.equal("Inexperienced User no longer needs to buddy up with you");
                });
            });
        });
    });
});
describe("Database shutdown", () => {
    let routeId = 1;
    let userId = "abcd";
    it("should shut down the database", () => {
        // expect(Database.shutDownPool()).to.eventually.equal(true).and.notify(done);
        Database.shutDownPool().then(response => {
            expect(response).to.equal(true);
        });
    });
    it("should reject all database operations", done => {
        let promises = [];
        // sql
        promises.push(Database.sqlTransaction("SELECT now();"));
        // putExperiencedRoute
        const route = new ExperiencedRoute({
            arrivalTime: "13:00:00+00",
            days: ["monday"],
            departureTime: "12:00:00+00",
            endPointName: "122 Stanley Street",
            length: 5000,
            owner: 123,
            route: [[0, 0], [1, 0], [1, 1]],
            startPointName: "33 Rachel Road",
        });
        promises.push(Database.putExperiencedRoute(route));
        // getExperiencedRouteById
        promises.push(Database.getExperiencedRouteById(routeId));
        // getExperiencedRoutesNearby
        promises.push(Database.getExperiencedRoutesNearby(5, 1, 1));
        // deleteExperiencedRoute
        promises.push(Database.deleteExperiencedRoute(routeId));
        // putUser
        promises.push(
            Database.putUser({
                email: "test@example.com",
                firstname: "Test",
                id: "testuser",
                surname: "User",
            })
        );
        // getUserById
        promises.push(Database.getUserById(userId));
        // getUserByEmail
        promises.push(Database.getUserByEmail("test3@example.com"));
        // deleteUser
        promises.push(Database.deleteUser(userId));

        let rejections = [];
        let successes = [];

        // We can't use Promise.all because it rejects on the first rejection
        promises.map((p, i) => {
            p.then(() => {
                successes.push(i);
                return successes.length + rejections.length;
            }, err => {
                rejections.push(i);
                return successes.length + rejections.length;
            }).then(total => {
                if (total === promises.length) {
                    expect(rejections.length).to.equal(promises.length,
                        `The following resolved (bad): ${successes}, the following rejected (good): ${rejections}`);
                    done();
                    }
                });
            });
        });
    });
