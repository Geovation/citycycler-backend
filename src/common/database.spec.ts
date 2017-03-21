/* tslint:disable */
import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as logger from "winston";

const expect = chai.expect;
chai.use(chaiAsPromised);

// Test the database Functions
describe("MatchMyRoute Database Functions", () => {
    let userIds = [];	// These are to assist wiht cleanup afterwards
    let routeIds = [];
    beforeAll(() => {
        // Shut down any running database pools
        Database.shutDownPool();
        // Start a new database pool
        Database.startUpPool();
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
    it("should be connected to the database", () => {
        const rowCount = Database.sql("select count(*) from pg_stat_activity").then(result => {
            return result.rowCount;
        });
        expect(rowCount).to.eventually.be.above(0);
    });
    describe("User related functions", () => {
        it("should create new users", done => {
            const promise = Database.putUser("Test User", "test@example.com", "pwhash", "salty", 5, "secret");
            promise.catch(() => { });
            expect(promise).not.to.be.rejected;
            promise.then(user => {
                userIds.push(user.id);
                expect(user.name).to.equal("Test User");
                expect(user.email).to.equal("test@example.com");
                expect(Buffer.compare(new Buffer("pwhash"), user.pwh)).to.equal(0);
                expect(Buffer.compare(new Buffer("salty"), user.salt)).to.equal(0);
                expect(user.rounds).to.equal(5);
                expect(user.jwtSecret).to.equal("secret");
                done();
            }, () => { done(); });
        });
        it("should fail to create users with duplicate emails", () => {
            const promise = Database.putUser("Test User2", "test@example.com", "pwhash2", "salty2", 5, "secret2");
            promise.catch((err) => { });	// Silence the node warning about unhandled promise rejections
            expect(promise).to.be.rejected;
        });
        it("should escape SQL injections", done => {
            const promise = Database.putUser("Test User');DROP TABLE users;", "test2@example.com", "pwhash2", "salty2", 5, "secret2");
            expect(promise).not.to.be.rejected;
            promise.then(user => {
                userIds.push(user.id);
                done();
            }, () => {
                done();
            });
        });
        it("should get a user by ID", done => {
            const promise = Database.getUserById(userIds[0]);
            expect(promise).not.to.be.rejected;
            promise.then(user => {
                expect(user.name).to.equal("Test User");
                done();
            }, () => {
                done();
            });
        });
        it("should not get a user by an invalid ID", () => {
            const promise = Database.getUserById(-1);
            expect(promise).to.be.rejected;
        });
        it("should get a user by email", done => {
            const promise = Database.getUserByEmail("test@example.com");
            expect(promise).not.to.be.rejected;
            promise.then(user => {
                expect(user.name).to.equal("Test User");
                done();
            }, () => {
                done();
            });
        });
        it("should not get a user by an invalid email", () => {
            const promise = Database.getUserByEmail("idontexist@example.com");
            expect(promise).to.be.rejected;
        });
        it("should not delete any users with an invalid id", () => {
            const promise = Database.deleteUser(-1);
            expect(promise).to.be.rejected;
        });
        it("should delete a user", done => {
            const promise = Database.deleteUser(userIds[0]);
            expect(promise).not.to.be.rejected;
            expect(promise).to.eventually.equal(true);
            promise.then(() => {
                const userCount = Database.sql("SELECT * FROM users WHERE id=$1", [userIds[0]]).then(result => {
                    expect(result.rowCount).to.equal(0);
                    done();
                }, () => {
                    done();
                });
            }, () => {
                done();
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
            });
            const promise = Database.putRoute(route);
            promise.catch(() => { });
            expect(promise).not.to.be.rejected;
            expect(promise).to.eventually.be.above(0);
            promise.then(routeId => {
                routeIds.push(routeId);
                Database.sql("SELECT * FROM routes WHERE id=$1", ["" + routeId]).then(result => {
                    expect(result.rows[0].arrivaltime).to.equal(route.arrivalTime);
                    expect(result.rows[0].departuretime).to.equal(route.departureTime);
                    expect(result.rows[0].owner).to.equal(route.owner);
                    done();
                }, () => {
                    done();
                });
                done();
            }, () => {
                done();
            });
        });
        it("should not create a route for an invalid owner", () => {
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": -1,
                "route": [[0, 0], [1, 0], [1, 1]],
            });
            const promise = Database.putRoute(route);
            promise.catch(() => { });
            expect(promise).to.be.rejected;
        });
        it("should get a route by ID", done => {
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
            });
            const promise = Database.getRouteById(routeIds[0]);
            expect(promise).not.to.be.rejected;
            promise.then(result => {
                expect(result.arrivalTime).to.equal(route.arrivalTime);
                expect(result.departureTime).to.equal(route.departureTime);
                expect(result.owner).to.equal(route.owner);
                done();
            }, () => {
                done();
            });
        });
        it("should not get a route by and invalid ID", () => {
            const promise = Database.getRouteById(-1);
            expect(promise).to.be.rejected;
        });
        it("should get a nearby route", done => {
            const promise = Database.getRoutesNearby(1, 0.4, 1.2);
            expect(promise).not.to.be.rejected;
            promise.then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).to.contain(routeIds[0]);
                done();
            }).catch(() => {
                expect(false).to.equal("Error, this didn't work1");
                done();
            });
        });
        it("should not get a far away route", done => {
            const promise = Database.getRoutesNearby(1, 1.6, 2.4);
            expect(promise).not.to.be.rejected;
            promise.then(routes => {
                const rids = routes.map((r) => {
                    return r.id;
                });
                expect(rids).not.to.contain(routeIds[0]);
                done();
            }).catch(() => {
                expect(false).to.equal("Error, this didn't work2");
                done();
            });
        });
        it("should not delete any routes with an invalid id", () => {
            const promise = Database.deleteRoute(-1);
            expect(promise).to.be.rejected;
        });
        it("should delete a route", done => {
            const promise = Database.deleteRoute(routeIds[0]);
            expect(promise).not.to.be.rejected;
            promise.then(() => {
                Database.sql("SELECT * FROM routes WHERE id=$1;", [routeIds[0]]).then(result => {
                    expect(result.rowCount).to.equal(0);
                    done();
                });
            }).catch(() => {
                expect(false).to.equal("Error, this didn't work3");
                done();
            });
        });
        it("should delete any routes associated with a user, when that user is deleted", done => {
            // Make a new route for our userIds[1]
            const route = new RouteDataModel({
                "arrivalTime": 15000,
                "departureTime": 14000,
                "owner": userIds[1],
                "route": [[0, 0], [1, 0], [1, 1]],
            });
            const promise = Database.putRoute(route).then(routeId => {
                Database.deleteUser(userIds[1]).then(() => {
                    Database.sql("SELECT * FROM routes WHERE id=$1;", ["" + routeId]).then(result => {
                        expect(result.rowCount).to.equal(0);
                        done();
                    });
                });
            }).catch(() => {
                done();
            });
            expect(promise).not.to.be.rejected;
        });
    });
});
