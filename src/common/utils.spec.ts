import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import RouteQuery from "./RouteQueryDataModel";
import User from "./UserDataModels";
import * as chai from "chai";
import * as mocha from "mocha";

// const before = mocha.before;
// const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;
const expect = chai.expect;
// const assert = chai.assert;
// const should = chai.should;

describe("Various useful functions", () => {
    describe("lineStringToCoords", () => {
        it("should convert a linestring into coords", () => {
            const lineString = "LINESTRING(0 0,1 1,2 2)";
            const coords = [[0, 0], [1, 1], [2, 2]];
            expect(Database.lineStringToCoords(lineString)).to.eql(coords);
        });
        it("should not convert an invalid linestring into coords", () => {
            let lineString = "POINT(0 2 5)";
            expect(() => {
                Database.lineStringToCoords(lineString);
            }).to.throw("Input is not a Linestring");
        });
    });
    describe("pointStringToCoords", () => {
        it("should convert a pointstring into coords", () => {
            const pointString = "POINT(5 6.6)";
            const coords = [5, 6.6];
            expect(Database.pointStringToCoords(pointString)).to.eql(coords);
        });
        it("should not convert an invalid pointstring into coords", () => {
            const pointString = "LINESTRING(0 2,5 6)";
            expect(() => {
                Database.pointStringToCoords(pointString);
            }).to.throw("Input is not a Point.");
        });
    });
    describe("coordsToLineString", () => {
        it("should convert coords into a linestring", () => {
            const lineString = "LINESTRING(0 0,1 1,2 2)";
            const coords = [[0, 0], [1, 1], [2, 2]];
            expect(Database.coordsToLineString(coords)).to.equal(lineString);
        });
    });
    describe("RouteDataModel", () => {
        it("should be constructed correctly", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            const route = new RouteDataModel(obj);
            expect(route.arrivalTime).to.equal(1234, "Arrival time is wrong! expected 1234, got " + route.arrivalTime);
            expect(route.departureTime).to.equal(1000, "Departure time is wrong! expected 1000, got " +
                route.departureTime);
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.days).to.eql(["tuesday", "sunday"], "Days is wrong!");
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
        });
        it("should throw an error if there is no arrival time", () => {
            const obj = {
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Route requires an arrival time");
        });
        it("should throw an error if there is no departure time", () => {
            const obj = {
                arrivalTime: 999,
                days: ["tuesday", "sunday"],
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Route requires a departure time");
        });
        it("should throw an error if the arrival is before departure", () => {
            const obj = {
                arrivalTime: 999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Arrival time is before Departure time");
        });
        it("should throw an error if there is only one coordinate passed", () => {
            const obj = {
                arrivalTime: 1999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Route requires at least 2 points");
        });
        it("should throw an error if there is a 3D coordinate present", () => {
            const obj = {
                arrivalTime: 1999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1, 1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Coordinates in a Route should only have 2 items in them, [latitude, longitude]");
        });
        it("should throw an error if there is a 1D coordinate present", () => {
            const obj = {
                arrivalTime: 1999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]");
        });
        it("should throw an error if there is no owner", () => {
            const obj = {
                arrivalTime: 1999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            expect(() => {
                return new RouteDataModel(obj);
            }).to.throw("400:Route requires an owner");
        });
        it("should be constructed correctly from an SQL row", () => {
            const row = {
                arrivaltime: 1234,
                days: 66,
                departuretime: 1000,
                id: 321,
                owner: 123,
                route: "LINESTRING(0 0,1 1,2 2)",
            };
            const route = RouteDataModel.fromSQLRow(row);
            expect(route.arrivalTime).to.equal(1234, "Arrival time is wrong! expected 1234, got " + route.arrivalTime);
            expect(route.departureTime).to.equal(1000, "Departure time is wrong! expected 1000, got " +
                route.departureTime);
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.days).to.eql(["tuesday", "sunday"], "Days is wrong! expected ['tuesday', 'sunday'], " +
                "got " + route.days);
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
        });
    });
    describe("RouteQuery", () => {
        it("should be constructed correctly", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                endPoint: [1, 1],
                id: 321,
                notifyOwner: true,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
            };
            const routeQuery = new RouteQuery(obj);
            expect(routeQuery.arrivalTime).to.equal(
                1234,
                "Arrival time is wrong! expected 1234, got " + routeQuery.arrivalTime
            );
            expect(routeQuery.id).to.equal(321, "ID is wrong! expected 321, got " + routeQuery.id);
            expect(routeQuery.owner).to.equal(123, "Owner is wrong! expected 123, got " + routeQuery.owner);
            expect(routeQuery.radius).to.equal(200, "Radius is wrong! expected 200, got " + routeQuery.radius);
            expect(routeQuery.days).to.eql(["tuesday", "sunday"], "Days is wrong!");
            expect(routeQuery.startPoint).to.eql([0, 0]);
            expect(routeQuery.endPoint).to.eql([1, 1]);
            expect(routeQuery.notifyOwner).to.equal(true);
        });
        it("should throw an error if startPoint is 1D", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                endPoint: [1, 1],
                id: 321,
                owner: 123,
                radius: 200,
                startPoint: [0],
            };
            expect(() => {
                return new RouteQuery(obj);
            }).to.throw("400:RouteQuery requires a 2D start point");
        });
        it("should throw an error if startPoint is 3D", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                endPoint: [1, 1],
                id: 321,
                owner: 123,
                radius: 200,
                startPoint: [0, 0, 0],
            };
            expect(() => {
                return new RouteQuery(obj);
            }).to.throw("400:RouteQuery requires a 2D start point");
        });
        it("should throw an error if endPoint is 1D", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                endPoint: [1],
                id: 321,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
            };
            expect(() => {
                return new RouteQuery(obj);
            }).to.throw("400:RouteQuery requires a 2D end point");
        });
        it("should throw an error if endPoint is 3D", () => {
            const obj = {
                arrivalTime: 1234,
                days: ["tuesday", "sunday"],
                endPoint: [1, 1, 1],
                id: 321,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
            };
            expect(() => {
                return new RouteQuery(obj);
            }).to.throw("400:RouteQuery requires a 2D end point");
        });
        it("should be constructed correctly from an SQL row", () => {
            const row = {
                arrivalTime: 1234,
                days: 21,
                endPoint: "POINT(1 1)",
                id: 321,
                notifyOwner: true,
                owner: 123,
                radius: 200,
                startPoint: "POINT(0 0)",
            };
            const routeQuery = RouteQuery.fromSQLRow(row);
            expect(routeQuery.arrivalTime).to.equal(
                1234,
                "Arrival time is wrong! expected 1234, got " + routeQuery.arrivalTime
            );
            expect(routeQuery.id).to.equal(321, "ID is wrong! expected 321, got " + routeQuery.id);
            expect(routeQuery.owner).to.equal(123, "Owner is wrong! expected 123, got " + routeQuery.owner);
            expect(routeQuery.days).to.eql(["monday", "wednesday", "friday"], "Days is wrong! expected " +
                "['monday', 'wednesday', 'friday'], got " + routeQuery.days);
            expect(routeQuery.startPoint).to.eql([0, 0]);
            expect(routeQuery.endPoint).to.eql([1, 1]);
            expect(routeQuery.notifyOwner).to.equal(true);
        });
    });
    describe("User", () => {
        it("should be constructed", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = new User(data);
            expect(user.id).to.equal(555);
            expect(user.name).to.equal("Test User");
            expect(user.email).to.equal("test@example.com");
            expect(Buffer.compare(user.pwh, new Buffer("test"))).to.equal(0);
            expect(Buffer.compare(user.salt, new Buffer("salt"))).to.equal(0);
            expect(user.rounds).to.equal(5);
            expect(user.jwtSecret).to.equal("secret");
        });
        it("should be constructed without an id", () => {
            const data = {
                email: "test@example.com",
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = new User(data);
            expect(user.id).to.be.undefined;
            expect(user.name).to.equal("Test User");
            expect(user.email).to.equal("test@example.com");
            expect(Buffer.compare(user.pwh, new Buffer("test"))).to.equal(0);
            expect(Buffer.compare(user.salt, new Buffer("salt"))).to.equal(0);
            expect(user.rounds).to.equal(5);
            expect(user.jwtSecret).to.equal("secret");
        });
        it("should error if no name is given", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "secret",
                name: " ",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a name");
        });
        it("should error if no email is given", () => {
            const data = {
                email: "",
                id: 555,
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires an email");
        });
        it("should error if no password is given", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer(""),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a password hash");
        });
        it("should error if no salt is given", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer(""),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a password salt");
        });
        it("should error if no. of rounds are not given", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "secret",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 0,
                salt: new Buffer("salt"),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires the number of hashing rounds to be set");
        });
        it("should error if no JWT secret is given", () => {
            const data = {
                email: "test@example.com",
                id: 555,
                jwtSecret: "",
                name: "Test User",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a JWT secret");
        });
        it("should be constructed from full data", () => {
            const data = {
                bio: "I'm a really fast cyclist",
                email: "test@example.com",
                helped: 21,
                id: 555,
                joined: 1234567,
                jwtSecret: "secret",
                name: "Test User",
                photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = new User(data);
            expect(user.id).to.equal(555);
            expect(user.name).to.equal("Test User");
            expect(user.email).to.equal("test@example.com");
            expect(Buffer.compare(user.pwh, new Buffer("test"))).to.equal(0);
            expect(Buffer.compare(user.salt, new Buffer("salt"))).to.equal(0);
            expect(user.rounds).to.equal(5);
            expect(user.jwtSecret).to.equal("secret");
            expect(user.bio).to.equal("I'm a really fast cyclist");
            expect(user.photo).to.equal("www.example.com/image.jpg");
            expect(user.joined).to.equal(1234567);
            expect(user.helped).to.equal(21);
        });
        it("should be constructed from a postgres row(ish) object", () => {
            const row = {
                email: "test@example.com",
                id: 555,
                jwt_secret: "secret",
                name: "Test User",
                profile_bio: "I'm a really fast cyclist",
                profile_helped: 21,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = User.fromSQLRow(row);
            expect(user.name).to.equal("Test User");
            expect(user.email).to.equal("test@example.com");
            expect(user.bio).to.equal("I'm a really fast cyclist");
            expect(user.photo).to.equal("www.example.com/image.jpg");
            expect(user.joined).to.equal(1234567);
            expect(user.helped).to.equal(21);
        });
        it("should not leak private data when made into a UserProfile", () => {
            const row = {
                email: "test@example.com",
                id: 555,
                jwt_secret: "secret",
                name: "Test User",
                profile_bio: "I'm a really fast cyclist",
                profile_helped: 21,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = User.fromSQLRow(row).asUserProfile();
            expect(user).not.to.include.keys("jwtSecret");
            expect(user).not.to.include.keys("pwh");
            expect(user).not.to.include.keys("salt");
            expect(user).not.to.include.keys("rounds");
        });
        it("should not leak data when turned into a UserSettings", () => {
            const row = {
                email: "test@example.com",
                id: 555,
                jwt_secret: "secret",
                name: "Test User",
                profile_bio: "I'm a really fast cyclist",
                profile_helped: 21,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
            };
            const user = User.fromSQLRow(row).asUserSettings();
            expect(user).not.to.include.keys("bio");
            expect(user).not.to.include.keys("joined");
            expect(user).not.to.include.keys("helped");
            expect(user).not.to.include.keys("photo");
        });
    });
});
