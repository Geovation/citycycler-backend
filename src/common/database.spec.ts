/* tslint:disable */
import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as logger from "winston";

const expect = chai.expect;
const assert = chai.assert;
const should = chai.should;
chai.use(chaiAsPromised);

// Test the database Functions
describe("MatchMyRoute Database Functions", () => {
    let userIds = [];	// These are to assist wiht cleanup afterwards
    let routeIds = [];
    beforeAll(done => {
        // Shut down any running database pools
        Database.shutDownPool().then(result => {
            if (result) {
                // Start a new database pool
                Database.startUpPool();
                done();
            } else {
                console.error("Couldn't shut down old pool!");
                process.exit(1);
            }
        });
    });
    afterAll(done => {
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
    // Test that the arbritary sql function works, because we'll be relying on this for the other tests.
    it("should be connected to the database", done => {
        const rowCount = Database.sql("select count(*) from pg_stat_activity").then(result => {
            return result.rowCount;
        });
        expect(rowCount).to.eventually.be.above(0, "pg reports " + rowCount + " connections to the DB")
            .and.notify(done);
    });
    describe("User related functions", () => {
        it("should create new users", done => {
            const promise = Database.putUser("Test User", "test@example.com", "pwhash", "salty", 5, "secret").then(
                user => {
                    userIds.push(user.id);
                    expect(user.name).to.equal("Test User");
                    expect(user.email).to.equal("test@example.com");
                    expect(Buffer.compare(new Buffer("pwhash"), user.pwh)).to.equal(0);
                    expect(Buffer.compare(new Buffer("salty"), user.salt)).to.equal(0);
                    expect(user.rounds).to.equal(5);
                    expect(user.jwtSecret).to.equal("secret");
                    done();
                }, err => {
                    assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
                });
        });
        it("should fail to create users with duplicate emails", done => {
            const promise = Database.putUser("Test User2", "test@example.com", "pwhash2", "salty2", 5, "secret2");
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should escape SQL injections", done => {
            const promise = Database.putUser("Test User');DROP TABLE users;", "test2@example.com", "pwhash2", "salty2", 5, "secret2").then(user => {
                userIds.push(user.id);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should get a user by ID", done => {
            const promise = Database.getUserById(userIds[0]).then(user => {
                expect(user.name).to.equal("Test User");
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should not get a user by an invalid ID", done => {
            const promise = Database.getUserById(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should get a user by email", done => {
            const promise = Database.getUserByEmail("test@example.com").then(user => {
                expect(user.name).to.equal("Test User");
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should not get a user by an invalid email", done => {
            const promise = Database.getUserByEmail("idontexist@example.com");
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should not delete any users with an invalid id", done => {
            const promise = Database.deleteUser(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should delete a user", done => {
            const promise = Database.deleteUser(userIds[0]).then(() => {
                const userCount = Database.sql("SELECT * FROM users WHERE id=$1", [userIds[0]]).then(result => {
                    expect(result.rowCount).to.equal(0);
                    done();
                }, err => {
                    assert.fail(err, 0, "Inner Promise was rejected (Database.sql): " + err).and.notify(done);
                });
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
    });
    describe("Route Functions", () => {
        it("should create a route", done => {
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
                "days": ["tuesday", "sunday"],
            });
            const promise = Database.putRoute(route);
            promise.then(routeId => {
                routeIds.push(routeId);
                Database.sql("SELECT arrivalTime, departureTime, owner, days::integer FROM routes WHERE id=$1",
                    ["" + routeId]).then(result => {
                        expect(result.rows[0].arrivaltime).to.equal(route.arrivalTime);
                        expect(result.rows[0].departuretime).to.equal(route.departureTime);
                        expect(result.rows[0].owner).to.equal(route.owner);
                        expect(result.rows[0].days).to.equal(66);
                        done();
                    }, err => {
                        assert.fail(err, 0, "Inner Promise was rejected (Database.sql): " + err).and.notify(done);
                    });
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should not create a route for an invalid owner", done => {
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": -1,
                "route": [[0, 0], [1, 0], [1, 1]],
                "days": ["tuesday", "sunday"],
            });
            const promise = Database.putRoute(route);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should get a route by ID", done => {
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
                "days": ["tuesday", "sunday"],
            });
            const promise = Database.getRouteById(routeIds[0]);
            promise.then(result => {
                expect(result.arrivalTime).to.equal(route.arrivalTime);
                expect(result.departureTime).to.equal(route.departureTime);
                expect(result.owner).to.equal(route.owner);
                expect(result.days).to.eql(route.days);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should not get a route by an invalid ID", done => {
            const promise = Database.getRouteById(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        describe("Matching", () => {
            beforeAll(done => {
                // Put in a big straight route that is easy to reason about
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
                const promise = Database.matchRoutes(matchParams).then(routes => {
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
                    done();
                }, err => {
                    assert.fail(err, 0, "matchRoutes failed with: " + err).and.notify(done);
                });
            });
            it("should not match a route if the end radius is too big", done => {
                const matchParams = {
                    start: {
                        latitude: 0,
                        longitude: 1.4,
                        radius: 500,
                    },
                    end: {
                        latitude: 0,
                        longitude: 4.6,
                        radius: 5000,
                    },
                    time: 500,
                    days: ["thursday", "friday", "sunday"],
                };
                const promise = Database.matchRoutes(matchParams);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not match a route if the end radius is too small", done => {
                const matchParams = {
                    start: {
                        latitude: 0,
                        longitude: 1.4,
                        radius: 500,
                    },
                    end: {
                        latitude: 0,
                        longitude: 4.6,
                        radius: 0.5,
                    },
                    time: 500,
                    days: ["thursday", "friday", "sunday"],
                };
                const promise = Database.matchRoutes(matchParams);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not match a route if the start radius is too big", done => {
                const matchParams = {
                    start: {
                        latitude: 0,
                        longitude: 1.4,
                        radius: 5000,
                    },
                    end: {
                        latitude: 0,
                        longitude: 4.6,
                        radius: 500,
                    },
                    time: 500,
                    days: ["thursday", "friday", "sunday"],
                };
                const promise = Database.matchRoutes(matchParams);
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not match a route if the start radius is too small", done => {
                const matchParams = {
                    start: {
                        latitude: 0,
                        longitude: 1.4,
                        radius: 0.5,
                    },
                    end: {
                        latitude: 0,
                        longitude: 4.6,
                        radius: 500,
                    },
                    time: 500,
                    days: ["thursday", "friday", "sunday"],
                };
                const promise = Database.matchRoutes(matchParams);
                expect(promise).to.be.rejected.and.notify(done);
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
                const promise = Database.matchRoutes(matchParams).then(routes => {
                    const thisRoute = routes.filter((route) => {
                        return route.id === routeIds[1];
                    })[0];
                    expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
                    done();
                }, err => {
                    assert.fail(err, 0, "matchRoutes failed with: " + err).and.notify(done);
                });
            });
            it("should match a route if days are unset", done => {
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
                };
                const promise = Database.matchRoutes(matchParams).then(routes => {
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
                    done();
                }, err => {
                    assert.fail(err, 0, "matchRoutes failed with: " + err).and.notify(done);
                });
            });
            it("should not match a route if days are set to exclude the route", done => {
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
                    days: ["monday", "wednesday", "saturday"],
                };
                const promise = Database.matchRoutes(matchParams).then(routes => {
                    const thisRoute = routes.filter((route) => {
                        return route.id === routeIds[1];
                    })[0];
                    expect(thisRoute).to.equal(undefined, "Got route when we shouldn't: " + JSON.stringify(thisRoute));
                    done();
                }, err => {
                    assert.fail(err, 0, "matchRoutes failed with: " + err).and.notify(done);
                });
            });
            it("should match a route if time is not set", done => {
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
                    days: ["thursday", "friday", "sunday"],
                };
                const promise = Database.matchRoutes(matchParams).then(routes => {
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
                    done();
                }, err => {
                    assert.fail(err, 0, "matchRoutes failed with: " + err).and.notify(done);
                });
            });
        });
        it("should get a nearby route", done => {
            const promise = Database.getRoutesNearby(500, 1, 1).then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).to.contain(routeIds[0]);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should not get a far away route", done => {
            const promise = Database.getRoutesNearby(1, 1.6, 2.4).then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).not.to.contain(routeIds[0]);
                done();
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
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
        describe("Updating", () => {
            it("should update all properties at once", done => {
                const updates = {
                    id: routeIds[0],
                    days: ["tuesday"],
                    arrivalTime: 1500,
                    departureTime: 900,
                    route: [[0, 0], [1, 0], [1, 1], [0, 1]],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.days).to.eql(["tuesday"]);
                    expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                    expect(newRoute.arrivalTime).to.equal(1500);
                    expect(newRoute.departureTime).to.equal(900);
                    done();
                });
            });
            it("should update one property at a time - arrivalTime", done => {
                const updates = {
                    id: routeIds[0],
                    arrivalTime: 15000,
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.days).to.eql(["tuesday"]);
                    expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                    expect(newRoute.arrivalTime).to.equal(15000);
                    expect(newRoute.departureTime).to.equal(900);
                    done();
                });
            });
            it("should update one property at a time - departureTime", done => {
                const updates = {
                    id: routeIds[0],
                    departureTime: 14000,
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.days).to.eql(["tuesday"]);
                    expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                    expect(newRoute.arrivalTime).to.equal(15000);
                    expect(newRoute.departureTime).to.equal(14000);
                    done();
                });
            });
            it("should update one property at a time - days", done => {
                const updates = {
                    id: routeIds[0],
                    days: ["thursday", "friday"],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.days).to.eql(["thursday", "friday"]);
                    expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1], [0, 1]]);
                    expect(newRoute.arrivalTime).to.equal(15000);
                    expect(newRoute.departureTime).to.equal(14000);
                    done();
                });
            });
            it("should update one property at a time - route", done => {
                const updates = {
                    id: routeIds[0],
                    route: [[0, 0], [1, 0], [1, 1]],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.days).to.eql(["thursday", "friday"]);
                    expect(newRoute.route).to.eql([[0, 0], [1, 0], [1, 1]]);
                    expect(newRoute.arrivalTime).to.equal(15000);
                    expect(newRoute.departureTime).to.equal(14000);
                    done();
                });
            });
            it("should not be able to update ownership", done => {
                const updates = {
                    id: routeIds[0],
                    owner: userIds[0],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }).then(() => {
                    return Database.getRouteById(routeIds[0]);
                }).then(newRoute => {
                    expect(newRoute.owner).to.eql(userIds[1]);
                    done();
                });
            });
            it("should not be able to update to an invalid departureTime", done => {
                const updates = {
                    id: routeIds[0],
                    departureTime: 16000,
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                }, err => { });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not be able to update to an invalid arrivalTime", done => {
                const updates = {
                    id: routeIds[0],
                    arrivalTime: 100,
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not be able to update to an invalid departureTime + arrivalTime", done => {
                const updates = {
                    id: routeIds[0],
                    departureTime: 16000,
                    arrivalTime: 15999,
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not be able to update to an invalid length route", done => {
                const updates = {
                    id: routeIds[0],
                    route: [[5, 6.2]],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not be able to update to a route with 1D coordinates", done => {
                const updates = {
                    id: routeIds[0],
                    route: [[5, 6.2], [7.125], [8.5, 6.3]],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });
            it("should not be able to update to a route with 3D coordinates", done => {
                const updates = {
                    id: routeIds[0],
                    route: [[5, 6.2], [7.125, 4.7, 0.12], [8.5, 6.3]],
                };
                const promise = Database.getRouteById(routeIds[0]).then(originalRoute => {
                    return Database.updateRoute(originalRoute, updates);
                });
                expect(promise).to.be.rejected.and.notify(done);
            });

        });
        it("should not delete any routes with an invalid id", done => {
            const promise = Database.deleteRoute(-1);
            expect(promise).to.be.rejected.and.notify(done);
        });
        it("should delete a route", done => {
            const promise = Database.deleteRoute(routeIds[0]);
            promise.then(() => {
                Database.sql("SELECT * FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                    expect(result.rowCount).to.equal(0);
                    done();
                });
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
        it("should delete any routes associated with a user, when that user is deleted", done => {
            // Make a new route for our userIds[1]
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
                "days": ["tuesday", "sunday"],
            });
            Database.putRoute(route).then(routeId => {
                Database.deleteUser(userIds[1]).then(() => {
                    Database.sql("SELECT * FROM routes WHERE id=$1;", ["" + routeId]).then(result => {
                        expect(result.rowCount).to.equal(0);
                        done();
                    }, err => {
                        assert.fail(err, 0, "Inner Promise was rejected (Database.sql): " + err).and.notify(done);
                    });
                }, err => {
                    assert.fail(err, 0, "Inner Promise was rejected (Database.deleteUser): " + err).and.notify(done);
                });
            }, err => {
                assert.fail(err, 0, "Promise was rejected: " + err).and.notify(done);
            });
        });
    });
    describe("Database shutdown", () => {
        it("should shut down the database", done => {
            expect(Database.shutDownPool()).to.eventually.equal(true).and.notify(done);
        });
        it("should reject all database operations", done => {
            let promises = [];
            // sql
            promises.push(Database.sql("SELECT now();"));
            // putRoute
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
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
                Database.putUser("Test User 3", "test3@example.com", "test", "test", 5, "secret")
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
