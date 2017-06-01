import BuddyRequest from "./BuddyRequestDataModel";
import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
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
    after(done => {
        let promises = [];
        routeIds.forEach(id => {
            promises.push(Database.sql("DELETE FROM routes WHERE id=$1", [id]));
        });
        userIds.forEach(id => {
            promises.push(Database.sql("DELETE FROM users WHERE id=$1", [id]));
        });
        Promise.all(promises).then(() => {
            Database.shutDownPool();
            done();
        }).catch((err) => {
            Database.shutDownPool();
            done();
        });
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
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            }, transactionClient)
                .then(response => {
                    expect(response.name).to.equal("Test User");
                });
        });
        it("should create new user (with bio)", () => {
            return Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                profile_bio: "mybio",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            }, transactionClient)
                .then(response => {
                    expect(response.name).to.equal("Test User");
                    expect(response.bio).to.equal("mybio");
                });
        });
        it("should escape SQL injections", () => {
            return Database.putUser({
                email: "test2@example.com",
                jwt_secret: "secret2",
                name: "Test User');DROP TABLE users;",
                pwh: "pwhash2",
                rounds: 5,
                salt: "salty2",
            }, transactionClient);
        });
        describe("User reliant tests", () => {
            let userId;
            beforeEach("Create user to test against", () => {
                return Database.putUser({
                    email: "test@example.com",
                    jwt_secret: "secret",
                    name: "Test User",
                    pwh: "pwhash",
                    rounds: 5,
                    salt: "salty",
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
                    jwt_secret: "secret2",
                    name: "Test User2",
                    pwh: "pwhash2",
                    rounds: 5,
                    salt: "salty2",
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
                const promise = Database.deleteUser(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get a user by id", () => {
                return Database.getUserById(userId, transactionClient)
                .then(user => {
                    return expect(user.name).to.equal("Test User");
                });
            });
            it("should not get a user by an invalid ID", done => {
                const promise = Database.getUserById(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get a user by email", () => {
                return Database.getUserByEmail("test@example.com", transactionClient).then(user => {
                    expect(user.name).to.equal("Test User");
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
                    jwt_secret: "secret",
                    name: "Non-updated Test User",
                    pwh: new Buffer("non-updated"),
                    rounds: 5,
                    salt: new Buffer("salt"),
                }, transactionClient).then(user => {
                    thisUserId = user.id;
                    done();
                });
            });
            // Go through these objects and try to update the user with them
            let updateables = [
                { name: "Updated Test User" },
                { email: "updated@example.com" },
                { pwh: new Buffer("updated") },
                { rounds: 10 },
                { profile_photo: "http://lorempixel.com/400/400/people/Updated" },
                { profile_bio: "Updated Biography" },
                {
                    email: "updated@example.com",
                    name: "Updated Test User",
                    profile_bio: "Updated Biography",
                    profile_photo: "http://lorempixel.com/400/400/people/Updated",
                    pwh: new Buffer("updated"),
                    rounds: 10,
                },
            ];
            for (let i = 0; i < updateables.length; i++) {
                let updates = updateables[i];
                let keys = Object.keys(updates).join(", ");
                it("should update " + keys, () => {
                    return Database.updateUser(thisUserId, updates, transactionClient).then(() => {
                        return Database.sqlTransaction("SELECT name, email, pwh, rounds, profile_photo, profile_bio " +
                            "FROM users WHERE id=$1;", [thisUserId], transactionClient).then(result => {
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
        });
    });
    describe("General Route Functions", () => {
        let thisUserId;
        let thisUserId2;
        let routeData;
        const faultyRouteData = new RouteDataModel({
            arrivalTime: "14:00:00+00",
            days: ["tuesday", "sunday"],
            departureTime: "13:00:00+00",
            owner: -1,
            route: [[0, 0], [1, 0], [1, 1]],
        });
        beforeEach("Create user and route to test against", () => {
            return Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                routeData = new RouteDataModel({
                    arrivalTime: "14:00:00+00",
                    days: ["tuesday", "sunday"],
                    departureTime: "13:00:00+00",
                    owner: thisUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                });
                return thisUserId;
            })
            // create second valid user
            .then(() => {
                return Database.putUser({
                    email: "test2@example.com",
                    jwt_secret: "secret",
                    name: "Test User2",
                    pwh: "pwhash",
                    rounds: 5,
                    salt: "salty",
                },
                transactionClient);
            })
            .then(user => {
                thisUserId2 = user.id;
                return thisUserId2;
            });
        });
        it("should create a route", () => {
            return Database.putRoute(routeData, transactionClient).then(routeId => {
                routeIds.push(routeId);
                return Database.sqlTransaction(
                    "SELECT arrivalTime, departureTime, owner, days::text[] FROM routes WHERE id=$1",
                    ["" + routeId],
                    transactionClient
                ).then(result => {
                    expect(result.rows[0].arrivaltime).to.equal(routeData.arrivalTime);
                    expect(result.rows[0].departuretime).to.equal(routeData.departureTime);
                    expect(result.rows[0].owner).to.equal(routeData.owner);
                    expect(result.rows[0].days).to.eql(routeData.days);
                });
            });
        });
        it("should not create a route for an invalid owner", done => {
            const promise = Database.putRoute(faultyRouteData, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        describe("Route reliant tests", () => {
            let thisRouteId;
            let thisRouteId2;
            beforeEach("Create route to test against", () => {
                return Database.putRoute(routeData, transactionClient).then(routeId => {
                    thisRouteId = routeId;
                    return Database.putRoute(routeData, transactionClient);
                }).then(routeId => {
                    thisRouteId2 = routeId;
                });
            });
            it("should get a route by ID if user is the owner", () => {
                return Database.getRoutes({id: thisRouteId, userId: thisUserId}, transactionClient).then(result => {
                    expect(result.length).to.equal(1);
                    expect(result[0].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[0].departureTime).to.equal(routeData.departureTime);
                    expect(result[0].owner).to.equal(routeData.owner);
                    expect(result[0].days).to.eql(routeData.days);
                });
            });
            it("should not get a route by an invalid ID", done => {
                const promise = Database.getRoutes({id: -1, userId: thisUserId}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get a route if user is not the owner", done => {
                const promise = Database.getRoutes({id: thisRouteId, userId: thisUserId2}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get all routes of a user", () => {
                return Database.getRoutes({userId: thisUserId}, transactionClient).then(result => {
                    expect(result.length).to.equal(2);
                    expect(result[0].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[0].departureTime).to.equal(routeData.departureTime);
                    expect(result[0].owner).to.equal(routeData.owner);
                    expect(result[0].days).to.eql(routeData.days);
                    expect(result[1].arrivalTime).to.equal(routeData.arrivalTime);
                    expect(result[1].departureTime).to.equal(routeData.departureTime);
                    expect(result[1].owner).to.equal(routeData.owner);
                    expect(result[1].days).to.eql(routeData.days);
                });
            });
            it("should not get routes of a user if he didn't create any yet", done => {
                const promise = Database.getRoutes({userId: thisUserId2}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get a nearby route", () => {
                return Database.getRoutesNearby(500, 1, 1, transactionClient).then(routes => {
                    const rids = routes.map((r) => {
                        return r.id;
                    });
                    expect(rids).to.contain(thisRouteId);
                });
            });
            it("should not get a far away route", () => {
                return Database.getRoutesNearby(1, 1.6, 2.4, transactionClient).then(routes => {
                    const rids = routes.map((r) => {
                        return r.id;
                    });
                    expect(rids).not.to.contain(thisRouteId);
                });
            });
            it("should not get a route in a tiny radius (<1m)", done => {
                const promise = Database.getRoutesNearby(0.5, 1.6, 2.4, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get a route in a huuuge radius (>2km)", done => {
                const promise = Database.getRoutesNearby(2001, 1.6, 2.4, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not delete any routes with an invalid id", done => {
                const promise = Database.deleteRoute(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should delete a route", () => {
                return Database.deleteRoute(thisRouteId, transactionClient).then(() => {
                    Database.sqlTransaction(
                        "SELECT * FROM routes WHERE id=$1;",
                        [thisRouteId],
                        transactionClient
                    ).then(result => {
                        expect(result.rowCount).to.equal(0);
                    });
                });
            });
            it("should delete any routes associated with a user, when that user is deleted", () => {
                return Database.deleteUser(thisUserId, transactionClient)
                .then(() => {
                    return Database.sqlTransaction(
                        "SELECT * FROM routes WHERE id=$1;",
                        ["" + thisRouteId],
                        transactionClient
                    );
                }).then((result: any) => {
                    expect(result.rowCount).to.equal(0);
                });
            });
        });
    });
    describe("Route Matching", () => {
        let thisUserId;
        let thisRouteId;
        let routeData;
        beforeEach("Create user and route to test against", done => {
            Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                routeData = new RouteDataModel({
                    arrivalTime: "13:30:00+00",
                    days: ["tuesday", "friday", "sunday"],
                    departureTime: "12:45:00+00",
                    owner: thisUserId,
                    route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
                });
                return Database.putRoute(routeData, transactionClient);
            })
            .then(routeId => {
                thisRouteId = routeId;
                done();
            });
        });
        it("should match a route", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00", // A Friday
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            return Database.matchRoutes(matchParams, transactionClient).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === thisRouteId;
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(routes));
                expect(thisRoute.owner).to.equal(thisUserId);
                console.log(JSON.stringify(moment(thisRoute.meetingTime)));
                expect(moment("2017-09-08T12:45:00+00").isBefore(thisRoute.meetingTime)).to.equal(true,
                    "meetingTime is before the route's start time (2017-09-08T12:45:00+00). Got " +
                    thisRoute.meetingTime);
                expect(moment("2017-09-08T13:30:00+00").isAfter(thisRoute.meetingTime)).to.equal(true,
                    "meetingTime is after the route's end time (2017-09-08T13:30:00+00). Got " +
                    thisRoute.meetingTime);
                expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
            });
        });
        it("should not match a route if the radius is too big", done => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 5000,
                startPoint: <[number, number]> [0, 1.4],
            };
            const promise = Database.matchRoutes(matchParams, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match a route if the radius is too small", done => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 0.5,
                startPoint: <[number, number]> [0, 1.4],
            };
            const promise = Database.matchRoutes(matchParams, transactionClient);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match a route in the wrong direction", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-08T13:20:00+00",
                endPoint: <[number, number]> [0, 1.6],
                radius: 500,
                startPoint: <[number, number]> [0, 4.6],
            };
            return Database.matchRoutes(matchParams, transactionClient).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === thisRouteId;
                })[0];
                expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
            });
        });
        it("should not match a route if days are set to exclude the required day", () => {
            const matchParams = {
                arrivalDateTime: "2017-09-09T13:20:00+00",
                endPoint: <[number, number]> [0, 4.6],
                radius: 500,
                startPoint: <[number, number]> [0, 1.4],
            };
            return Database.matchRoutes(matchParams, transactionClient).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === thisRouteId;
                })[0];
                expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
            });
        });
    });
    describe("Route Updating", () => {
        // insert a route to update
        let updateRouteId;
        let thisUserId;
        let routeData;
        beforeEach("Create user and route to update", done => {
            Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                routeData = new RouteDataModel({
                    arrivalTime: "13:30:00+00",
                    days: ["tuesday", "sunday"],
                    departureTime: "12:45:00+00",
                    owner: thisUserId,
                    route: [[0, 0], [1, 0], [1, 1]],
                });
                return Database.putRoute(routeData, transactionClient);
            })
            .then(routeId => {
                updateRouteId = routeId;
                done();
            });
        });

        it("should update all properties at once", () => {
            const updates = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday"],
                departureTime: "12:00:00+00",
                id: updateRouteId,
                route: [[0, 0], [1, 0], [1, 1], [0, 1]],
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(updates.days);
                expect(newRoute.route).to.eql(updates.route);
                expect(newRoute.arrivalTime).to.equal("13:00:00+00");
                expect(newRoute.departureTime).to.equal("12:00:00+00");
            });
        });
        it("should update one property at a time - arrivalTime", () => {
            const updates = {
                arrivalTime: "13:30:00+00",
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(routeData.days);
                expect(newRoute.route).to.eql(routeData.route);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should update one property at a time - departureTime", () => {
            const updates = {
                departureTime: "12:45:00+00",
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(routeData.days);
                expect(newRoute.route).to.eql(routeData.route);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(updates.departureTime);
            });
        });
        it("should update one property at a time - days", () => {
            const updates = {
                days: ["thursday", "friday"],
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(updates.days);
                expect(newRoute.route).to.eql(routeData.route);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should update one property at a time - route", () => {
            const updates = {
                id: updateRouteId,
                route: [[0, 0], [1, 0], [1, 1]],
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(routeData.days);
                expect(newRoute.route).to.eql(updates.route);
                expect(newRoute.arrivalTime).to.equal(routeData.arrivalTime);
                expect(newRoute.departureTime).to.equal(routeData.departureTime);
            });
        });
        it("should not be able to update ownership", () => {
            const updates = {
                id: updateRouteId,
                owner: userIds[0],
            };
            return Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            }).then(() => {
                return Database.getRouteById(updateRouteId, transactionClient);
            }).then(newRoute => {
                expect(newRoute.owner).to.eql(thisUserId);
            });
        });
        it("should not be able to update to an invalid departureTime", done => {
            const updates = {
                departureTime: "14:00:00+00",
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid arrivalTime", done => {
            const updates = {
                arrivalTime: "12:00:00+00",
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid departureTime + arrivalTime", done => {
            const updates = {
                arrivalTime: "12:00:00+00",
                departureTime: "13:00:00+00",
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid length route", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2]],
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to a route with 1D coordinates", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2], [7.125], [8.5, 6.3]],
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to a route with 3D coordinates", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2], [7.125, 4.7, 0.12], [8.5, 6.3]],
            };
            const promise = Database.getRouteById(updateRouteId, transactionClient).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates, transactionClient);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });

    });
    describe("General Buddy Request functions", () => {
        let userId: number;
        beforeEach("Create user to own buddyRequests", done => {
            Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            },
            transactionClient).then(newUser => {
                userId = newUser.id;
                done();
            });
        });
        describe("Creation", () => {
            it("should create a buddy request", () => {
                let buddyRequestData: BuddyRequest = {
                    arrivalDateTime: "2000-01-01T13:00:00+00",
                    endPoint: [15, 15],
                    notifyOwner: false,
                    radius: 1000,
                    startPoint: [10, 10],
                };
                return Database.createBuddyRequest(userId, buddyRequestData, transactionClient)
                .then(buddyRequestId => {
                    return Database.sqlTransaction(
                        "SELECT arrivalDateTime, ST_AsText(endPoint) AS endPoint, notifyOwner, radius, " +
                        "ST_AsText(startPoint) AS startPoint, owner FROM buddy_requests WHERE id=$1",
                        ["" + buddyRequestId],
                        transactionClient
                    ).then(result => {
                        expect(moment(result.rows[0].arrivaldatetime)
                            .isSame(buddyRequestData.arrivalDateTime)).to.be.true;
                        expect(Database.pointStringToCoords(result.rows[0].endpoint))
                            .to.eql(buddyRequestData.endPoint);
                        expect(Database.pointStringToCoords(result.rows[0].startpoint))
                            .to.eql(buddyRequestData.startPoint);
                        expect(result.rows[0].notifyowner).to.equal(buddyRequestData.notifyOwner);
                        expect(result.rows[0].radius).to.equal(buddyRequestData.radius);
                        expect(result.rows[0].owner).to.equal(userId);
                    });
                });
            });
            it("should not create a buddy request with an invalid arrivalTime", done => {
                let buddyRequestData: BuddyRequest = {
                    arrivalDateTime: "I'm a little teapot",
                    endPoint: [15, 15],
                    notifyOwner: false,
                    radius: 1000,
                    startPoint: [10, 10],
                };
                const promise = Database.createBuddyRequest(userId, buddyRequestData, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Retreival", () => {
            let buddyRequestId;
            let spareUserId;
            beforeEach("Create a buddy request to be retreived, and a second user with no buddy requests", done => {
                Database.createBuddyRequest(userId, {
                    arrivalDateTime: "2000-01-01T13:00:00+00",
                    endPoint: [15, 15],
                    notifyOwner: false,
                    radius: 1000,
                    startPoint: [10, 10],
                },
                transactionClient).then(newRequestId => {
                    buddyRequestId = newRequestId;
                }).then(() => {
                    Database.putUser({
                        email: "test2@example.com",
                        jwt_secret: "secret",
                        name: "Test User2",
                        pwh: "pwhash",
                        rounds: 5,
                        salt: "salty",
                    },
                    transactionClient).then(newUser => {
                        spareUserId = newUser.id;
                        done();
                    });
                });
            });
            it("should get a buddy request by ID", () => {
                return Database.getBuddyRequests({userId, id: buddyRequestId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.filter(buddyRequest => {
                        return buddyRequest.id === buddyRequestId;
                    }).length).to.equal(1);
                });
            });
            it("should not get a buddy request by an invalid ID", done => {
                const promise = Database.getBuddyRequests({userId, id: -1}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should get all of a user's buddy requests", () => {
                return Database.getBuddyRequests({userId}, transactionClient)
                .then(buddyRequests => {
                    expect(buddyRequests.filter(buddyRequest => {
                        return buddyRequest.id === buddyRequestId;
                    }).length).to.equal(1);
                });
            });
            it("should not get any buddy requests belonging to another user", done => {
                const promise = Database.getBuddyRequests({
                    id: buddyRequestId,
                    userId: spareUserId,
                }, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not get any buddy requests for a user who has none", done => {
                const promise = Database.getBuddyRequests({id: -1, userId: spareUserId}, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
        describe("Updating", () => {
            let buddyRequestId;
            let existingBuddyRequest: BuddyRequest = {
                arrivalDateTime: "2000-01-01T13:00:00+00",
                endPoint: [15, 15],
                notifyOwner: false,
                radius: 1000,
                startPoint: [10, 10],
            };
            beforeEach("Make a buddyRequest to update", done => {
                Database.createBuddyRequest(userId, existingBuddyRequest,
                transactionClient).then(newRequestId => {
                    buddyRequestId = newRequestId;
                    existingBuddyRequest.owner = userId;
                    existingBuddyRequest.id = <number> newRequestId;
                    done();
                });
            });
            // Go through these objects and try to update the buddyRequest with them
            let updateables = [
                {arrivalDateTime: "2000-01-01T13:35:00+00"},
                {endPoint: <[number, number]> [2, 4]},
                {startPoint: <[number, number]> [150, 10]},
                {notifyOwner: true},
                {radius: 999},
                {
                    arrivalDateTime: "2000-01-01T13:30:00+00",
                    endPoint: <[number, number]> [18, 15],
                    notifyOwner: true,
                    radius: 1230,
                    startPoint: <[number, number]> [19, 10],
                },
            ];
            for (let i = 0; i < updateables.length; i++) {
                let updates = updateables[i];
                let keys = Object.keys(updates).join(", ");
                it("should update " + keys, () => {
                    return Database.updateBuddyRequest(existingBuddyRequest, updates, transactionClient).then(() => {
                        return Database.sqlTransaction("SELECT arrivalDateTime, radius, notifyOwner, " +
                        "ST_AsText(endPoint) as endPoint, ST_AsText(startPoint) as startPoint " +
                        "FROM buddy_requests WHERE id=$1;", ["" + buddyRequestId], transactionClient)
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
            let buddyRequestId;
            let ownerId;
            beforeEach("Make a user and buddyRequest to delete", done => {
                Database.putUser({
                    email: "test2@example.com",
                    jwt_secret: "secret",
                    name: "Test User2",
                    pwh: "pwhash",
                    rounds: 5,
                    salt: "salty",
                },
                transactionClient).then(newUser => {
                    ownerId = newUser.id;
                    return Database.createBuddyRequest(ownerId, {
                        arrivalDateTime: "2000-01-01T13:00:00+00",
                        endPoint: [15, 15],
                        notifyOwner: false,
                        radius: 1000,
                        startPoint: [10, 10],
                    },
                    transactionClient);
                }).then(newRequestId => {
                    buddyRequestId = newRequestId;
                    done();
                });
            });
            it("should delete a buddyRequest", () => {
                return Database.deleteBuddyRequest(buddyRequestId, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.sqlTransaction("SELECT * FROM buddy_requests WHERE id=$1;",
                    ["" + buddyRequestId], transactionClient)
                    .then(results => {
                        expect(results.rows.length).to.equal(0);
                    });
                });
            });
            it("should delete a buddyRequest when it's owner is deleted", () => {
                return Database.deleteUser(ownerId, transactionClient).then(success => {
                    expect(success).to.be.true;
                    return Database.sqlTransaction("SELECT * FROM buddy_requests WHERE id=$1;",
                    ["" + buddyRequestId], transactionClient)
                    .then(results => {
                        expect(results.rows.length).to.equal(0);
                    });
                });
            });
            it("should not delete a buddyRequest with an invalid id", done => {
                const promise = Database.deleteBuddyRequest(-1, transactionClient);
                expect(promise).to.be.rejected.and.notify(done);
            });
        });
    });
});
describe("Database shutdown", () => {
    let routeId = 1;
    let userId = 1;
    it("should shut down the database", () => {
        // expect(Database.shutDownPool()).to.eventually.equal(true).and.notify(done);
        Database.shutDownPool().then(response => {
            expect(response).to.equal(true);
        });
    });
    it("should reject all database operations", done => {
        let promises = [];
        // sql
        promises.push(Database.sql("SELECT now();"));
        // putRoute
        const route = new RouteDataModel({
            arrivalTime: "13:00:00+00",
            days: ["monday"],
            departureTime: "12:00:00+00",
            owner: 123,
            route: [[0, 0], [1, 0], [1, 1]],
        });
        promises.push(Database.putRoute(route));
        // getRouteById
        promises.push(Database.getRouteById(routeId));
        // getRoutesNearby
        promises.push(Database.getRoutesNearby(5, 1, 1));
        // deleteRoute
        promises.push(Database.deleteRoute(routeId));
        // putUser
        promises.push(
            Database.putUser({
                email: "test@example.com",
                jwt_secret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
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
