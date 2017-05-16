import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import RouteQuery from "./RouteQueryDataModel";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as mocha from "mocha";
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
                    err => { done(); return (err); }
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
        ).catch(e => {
            // console.error("Cannot roll back");
            done();
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
        it("should create new user", () => {
            Database.putUser({
                email: "test@example.com",
                jwtSecret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            }, transactionClient)
                .then(response => {
                    expect(response.name).to.equal("Test User");
                });
        });
        it("should escape SQL injections", () => {
            return Database.putUser({
                email: "test2@example.com",
                jwtSecret: "secret2",
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
                    jwtSecret: "secret",
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
                    jwtSecret: "secret2",
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
                    jwtSecret: "secret",
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
    describe.skip("General Route Functions", () => {
        let thisUserId;
        beforeEach("Create user to test against", () => {
            return Database.putUser({
                email: "test@example.com",
                jwtSecret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            },
            transactionClient)
            .then(user => {
                thisUserId = user.id;
                return thisUserId;
            });
        });
        it("should create a route", () => {
            const route = new RouteDataModel({
                arrivalTime: 15000,
                days: ["tuesday", "sunday"],
                departureTime: 14000,
                owner: userIds[1],
                route: [[0, 0], [1, 0], [1, 1]],
            });
            return Database.putRoute(route).then(routeId => {
                routeIds.push(routeId);
                return Database.sql("SELECT arrivalTime, departureTime, owner, days::integer FROM routes WHERE id=$1",
                    ["" + routeId]).then(result => {
                        expect(result.rows[0].arrivaltime).to.equal(route.arrivalTime);
                        expect(result.rows[0].departuretime).to.equal(route.departureTime);
                        expect(result.rows[0].owner).to.equal(route.owner);
                        expect(result.rows[0].days).to.equal(66);
                    });
            });
        });
        it("should not create a route for an invalid owner", done => {
            const route = new RouteDataModel({
                arrivalTime: 15000,
                days: ["tuesday", "sunday"],
                departureTime: 14000,
                owner: -1,
                route: [[0, 0], [1, 0], [1, 1]],
            });
            const promise = Database.putRoute(route);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should get a route by ID", () => {
            const route = new RouteDataModel({
                arrivalTime: 15000,
                days: ["tuesday", "sunday"],
                departureTime: 14000,
                owner: userIds[1],
                route: [[0, 0], [1, 0], [1, 1]],
            });
            return Database.getRouteById(routeIds[0]).then(result => {
                expect(result.arrivalTime).to.equal(route.arrivalTime);
                expect(result.departureTime).to.equal(route.departureTime);
                expect(result.owner).to.equal(route.owner);
                expect(result.days).to.eql(route.days);
            });
        });
        it("should not get a route by an invalid ID", done => {
            const promise = Database.getRouteById(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should get a nearby route", () => {
            return Database.getRoutesNearby(500, 1, 1).then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).to.contain(routeIds[0]);
            });
        });
        it("should not get a far away route", () => {
            return Database.getRoutesNearby(1, 1.6, 2.4).then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).not.to.contain(routeIds[0]);
            });
        });
        it("should not get a route in a tiny radius (<1m)", done => {
            const promise = Database.getRoutesNearby(0.5, 1.6, 2.4);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not get a route in a huuuge radius (>2km)", done => {
            const promise = Database.getRoutesNearby(2001, 1.6, 2.4);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not delete any routes with an invalid id", done => {
            const promise = Database.deleteRoute(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should delete a route", () => {
            return Database.deleteRoute(routeIds[0]).then(() => {
                Database.sql("SELECT * FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                    expect(result.rowCount).to.equal(0);
                });
            });
        });
        it("should delete any routes associated with a user, when that user is deleted", () => {
            let routeId;
            let userId;
            // create new user so that no dependency on other tests exists
            return Database.putUser({
                email: "test@example.com",
                jwtSecret: "secret",
                name: "Test User",
                pwh: "pwhash",
                rounds: 5,
                salt: "salty",
            }).then(user => {
                userIds.push(user.id);
                userId = user.id;
                // prepare a new route
                const route = new RouteDataModel({
                    arrivalTime: 15000,
                    days: ["monday"],
                    departureTime: 14000,
                    owner: userId,
                    route: [[0, 0], [1, 0], [1, 1]],
                });
                return Database.putRoute(route);
            }).then(id => {
                routeId = id;
                return Database.deleteUser(userId);
            }).then(() => {
                return Database.sql("SELECT * FROM routes WHERE id=$1;", ["" + routeId]);
            }).then((result: any) => {
                expect(result.rowCount).to.equal(0);
            });
        });
    });
    describe.skip("Route Matching", () => {
        before(done => {
            // Put in a big straight route that is easy to reason about
            const route = new RouteDataModel({
                arrivalTime: 660,
                days: ["tuesday", "friday", "sunday"],
                departureTime: 60,
                owner: userIds[1],
                route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
            });
            Database.putRoute(route).then(routeId => {
                routeIds.push(routeId); // Should be routeIds[1]
                done();
            });
        });
        it("should match a route", () => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                days: ["thursday", "friday", "sunday"],
                endPoint: [0, 4.6],
                radius: 500,
                startPoint: [0, 1.4],
            });
            return Database.matchRoutes(matchParams).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === routeIds[1];
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(routes));
                expect(thisRoute.owner).to.equal(userIds[1]);
                // Should be the intersection between the route days and the search days
                expect(thisRoute.days).to.eql(["friday", "sunday"]);
                expect(thisRoute.meetingTime).to.be.at.least(60, "meetingTime is smaller than the route's start " +
                    "time (60). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingTime).to.be.at.most(660, "meetingTime is larger than the route's end " +
                    "time (660). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
            });
        });
        it("should not match a route if the radius is too big", done => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                days: ["thursday", "friday", "sunday"],
                endPoint: [0, 4.6],
                radius: 5000,
                startPoint: [0, 1.4],
            });
            const promise = Database.matchRoutes(matchParams);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match a route if the radius is too small", done => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                days: ["thursday", "friday", "sunday"],
                endPoint: [0, 4.6],
                radius: 0.5,
                startPoint: [0, 1.4],
            });
            const promise = Database.matchRoutes(matchParams);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not match a route in the wrong direction", () => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                days: ["thursday", "friday", "sunday"],
                endPoint: [0, 1.4],
                radius: 500,
                startPoint: [0, 4.6],
            });
            return Database.matchRoutes(matchParams).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === routeIds[1];
                })[0];
                expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
            });
        });
        it("should match a route if days are unset", () => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                endPoint: [0, 4.6],
                radius: 500,
                startPoint: [0, 1.4],
            });
            return Database.matchRoutes(matchParams).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === routeIds[1];
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(routes));
                expect(thisRoute.owner).to.equal(userIds[1]);
                // Should be all of the days the route is available on
                expect(thisRoute.days).to.eql(["tuesday", "friday", "sunday"]);
                expect(thisRoute.meetingTime).to.be.at.least(60, "meetingTime is smaller than the route's start " +
                    "time (60). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingTime).to.be.at.most(660, "meetingTime is larger than the route's end " +
                    "time (660). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
            });
        });
        it("should not match a route if days are set to exclude the route", () => {
            const matchParams = new RouteQuery({
                arrivalTime: 500,
                days: ["monday", "wednesday", "saturday"],
                endPoint: [0, 4.6],
                radius: 500,
                startPoint: [0, 1.4],
            });
            return Database.matchRoutes(matchParams).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === routeIds[1];
                })[0];
                expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
            });
        });
        it("should match a route if time is not set", () => {
            const matchParams = new RouteQuery({
                days: ["thursday", "friday", "sunday"],
                endPoint: [0, 4.6],
                radius: 500,
                startPoint: [0, 1.4],
            });
            return Database.matchRoutes(matchParams).then(routes => {
                const thisRoute = routes.filter((route) => {
                    return route.id === routeIds[1];
                })[0];
                expect(thisRoute).to.not.equal(undefined, "Route was not matched. Results were " +
                    JSON.stringify(routes));
                expect(thisRoute.owner).to.equal(userIds[1]);
                // Should be the intersection between the route days and the search days
                expect(thisRoute.days).to.eql(["friday", "sunday"]);
                expect(thisRoute.meetingTime).to.be.at.least(60, "meetingTime is smaller than the route's start " +
                    "time (60). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingTime).to.be.at.most(660, "meetingTime is larger than the route's end " +
                    "time (660). Got " + thisRoute.meetingTime + ". Route is: " + JSON.stringify(thisRoute));
                expect(thisRoute.meetingPoint).to.eql([0, 1.4]);
                expect(thisRoute.divorcePoint).to.eql([0, 4.6]);
            });
        });
    });
    describe.skip("Route Updating", () => {
        // insert a route to update
        let updateRouteId;
        before(done => {
            const route = new RouteDataModel({
                arrivalTime: 15000,
                days: ["tuesday", "sunday"],
                departureTime: 14000,
                owner: userIds[1],
                route: [[0, 0], [1, 0], [1, 1]],
            });
            Database.putRoute(route)
                .then(routeId => {
                    // temporary pushing to routeIds before making all tests atomic
                    routeIds.push(routeId);
                    updateRouteId = routeId;
                    done();
                });
        });

        it("should update all properties at once", () => {
            const updates = {
                arrivalTime: 1500,
                days: ["tuesday"],
                departureTime: 900,
                id: updateRouteId,
                route: [[0, 0], [1, 0], [1, 1], [0, 1]],
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(["tuesday"]);
                expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                expect(newRoute.arrivalTime).to.equal(1500);
                expect(newRoute.departureTime).to.equal(900);
            });
        });
        it("should update one property at a time - arrivalTime", () => {
            const updates = {
                arrivalTime: 15000,
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(["tuesday"]);
                expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                expect(newRoute.arrivalTime).to.equal(15000);
                expect(newRoute.departureTime).to.equal(900);
            });
        });
        it("should update one property at a time - departureTime", () => {
            const updates = {
                departureTime: 14000,
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(["tuesday"]);
                expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                expect(newRoute.arrivalTime).to.equal(15000);
                expect(newRoute.departureTime).to.equal(14000);
            });
        });
        it("should update one property at a time - days", () => {
            const updates = {
                days: ["thursday", "friday"],
                id: updateRouteId,
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(["thursday", "friday"]);
                expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                expect(newRoute.arrivalTime).to.equal(15000);
                expect(newRoute.departureTime).to.equal(14000);
            });
        });
        it("should update one property at a time - route", () => {
            const updates = {
                id: updateRouteId,
                route: [[0, 0], [1, 0], [1, 1]],
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.days).to.eql(["thursday", "friday"]);
                expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1]]);
                expect(newRoute.arrivalTime).to.equal(15000);
                expect(newRoute.departureTime).to.equal(14000);
            });
        });
        it("should not be able to update ownership", () => {
            const updates = {
                id: updateRouteId,
                owner: userIds[0],
            };
            return Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            }).then(() => {
                return Database.getRouteById(updateRouteId);
            }).then(newRoute => {
                expect(newRoute.owner).to.eql(userIds[1]);
            });
        });
        it("should not be able to update to an invalid departureTime", done => {
            const updates = {
                departureTime: 16000,
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid arrivalTime", done => {
            const updates = {
                arrivalTime: 100,
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid departureTime + arrivalTime", done => {
            const updates = {
                arrivalTime: 15999,
                departureTime: 16000,
                id: updateRouteId,
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to an invalid length route", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2]],
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to a route with 1D coordinates", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2], [7.125], [8.5, 6.3]],
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not be able to update to a route with 3D coordinates", done => {
            const updates = {
                id: updateRouteId,
                route: [[5, 6.2], [7.125, 4.7, 0.12], [8.5, 6.3]],
            };
            const promise = Database.getRouteById(updateRouteId).then(originalRoute => {
                return Database.updateRoute(originalRoute, updates);
            });
            expect(promise).to.be.rejected.and.notify(done);
        });

    });
    describe("Database shutdown", () => {
        it("should shut down the database", () => {
            // expect(Database.shutDownPool()).to.eventually.equal(true).and.notify(done);
            Database.shutDownPool().then(response => {
                console.log("shutdown resolved");
                expect(response).to.equal(true);
            });
        });
        it("should reject all database operations", done => {
            let promises = [];
            // sql
            promises.push(Database.sql("SELECT now();"));
            // putRoute
            const route = new RouteDataModel({
                arrivalTime: 15000,
                days: ["monday"],
                departureTime: 14000,
                owner: 123,
                route: [[0, 0], [1, 0], [1, 1]],
            });
            promises.push(Database.putRoute(route));
            // getRouteById
            promises.push(Database.getRouteById(routeIds[0]));
            // getRoutesNearby
            promises.push(Database.getRoutesNearby(5, 1, 1));
            // deleteRoute
            promises.push(Database.deleteRoute(routeIds[0]));
            // putUser
            promises.push(
                Database.putUser({
                    email: "test@example.com",
                    jwtSecret: "secret",
                    name: "Test User",
                    pwh: "pwhash",
                    rounds: 5,
                    salt: "salty",
                })
            );
            // getUserById
            promises.push(Database.getUserById(userIds[0]));
            // getUserByEmail
            promises.push(Database.getUserByEmail("test3@example.com"));
            // deleteUser
            promises.push(Database.deleteUser(userIds[0]));

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
});
