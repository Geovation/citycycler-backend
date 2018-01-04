    import BuddyRequest from "./BuddyRequestDataModel";
import * as Database from "./database";
import ExperiencedRoute from "./ExperiencedRouteDataModel";
import InexperiencedRoute from "./InexperiencedRouteDataModel";
import User from "./UserDataModels";
import * as chai from "chai";
import * as mocha from "mocha";
import * as moment from "moment";

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
        it("should handle decimal numbers", () => {
            const lineString = "LINESTRING(0 0,0.5 0.5,1 1)";
            const coords = [[0, 0], [0.5, 0.5], [1, 1]];
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
    describe("ExperiencedRoute", () => {
        it("should be constructed correctly without a name", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            const route = new ExperiencedRoute(obj);
            expect(route.arrivalTime).to.equal("13:00:00+00", "Arrival time is wrong! expected 13:00:00+00, got " +
                route.arrivalTime);
            expect(route.departureTime).to.equal("12:00:00+00", "Departure time is wrong! expected 12:00:00+00, got " +
                route.departureTime);
            expect(route.endPointName).to.equal("33 Stanley Street");
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.length).to.equal(5000);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.days).to.eql(["tuesday", "sunday"], "Days is wrong!");
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
            expect(route.startPointName).to.equal("112 Rachel Road");
            expect(route.name).to.equal("112 Rachel Road to 33 Stanley Street");
        });
        it("should be constructed correctly with a name", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 2000,
                name: "Ride to work",
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            const route = new ExperiencedRoute(obj);
            expect(route.arrivalTime).to.equal("13:00:00+00", "Arrival time is wrong! expected 13:00:00+00, got " +
                route.arrivalTime);
            expect(route.departureTime).to.equal("12:00:00+00", "Departure time is wrong! expected 12:00:00+00, got " +
                route.departureTime);
            expect(route.endPointName).to.equal("33 Stanley Street");
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.length).to.equal(2000);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.days).to.eql(["tuesday", "sunday"], "Days is wrong!");
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
            expect(route.startPointName).to.equal("112 Rachel Road");
            expect(route.name).to.equal("Ride to work");
        });
        it("should throw an error if there is no arrival time", () => {
            const obj = {
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires a valid arrival time");
        });
        it("should throw an error if there is no departure time", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires a valid departure time");
        });
        it("should throw an error if the arrival is before departure", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "14:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:Arrival time is before Departure time");
        });
        it("should throw an error if there is only one coordinate passed", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires at least 2 points");
        });
        it("should throw an error if there is a 3D coordinate present", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:Coordinates in a ExperiencedRoute should only have 2 items in them, " +
                "[latitude, longitude]");
        });
        it("should throw an error if there is a 1D coordinate present", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:Coordinates in a ExperiencedRoute should have exactly 2 items in them, " +
                "[latitude, longitude]");
        });
        it("should throw an error if there is no owner", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",

            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires an owner");
        });
        it("should throw an error if there is no startPointName", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                endPointName: "33 Stanley Street",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires a startPointName");
        });
        it("should throw an error if there is no endPointName", () => {
            const obj = {
                arrivalTime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departureTime: "12:00:00+00",
                id: 321,
                length: 5000,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
                startPointName: "112 Rachel Road",
            };
            expect(() => {
                return new ExperiencedRoute(obj);
            }).to.throw("400:ExperiencedRoute requires an endPointName");
        });
        it("should be constructed correctly from an SQL row", () => {
            const row = {
                arrivaltime: "13:00:00+00",
                days: ["tuesday", "sunday"],
                departuretime: "12:00:00+00",
                endpointname: "33 Stanley Street",
                id: 321,
                length: 5000,
                name: "Ride to work",
                owner: 123,
                route: "LINESTRING(0 0,1 1,2 2)",
                startpointname: "122 Rachel Road",
            };
            const route = ExperiencedRoute.fromSQLRow(row);
            expect(route.arrivalTime).to.equal("13:00:00+00", "Arrival time is wrong! expected 13:00:00+00, got " +
                route.arrivalTime);
            expect(route.departureTime).to.equal("12:00:00+00", "Departure time is wrong! expected 12:00:00+00, got " +
                route.departureTime);
            expect(route.endPointName).to.equal("33 Stanley Street");
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.days).to.eql(["tuesday", "sunday"], "Days is wrong! expected ['tuesday', 'sunday'], " +
                "got " + route.days);
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
            expect(route.startPointName).to.equal("122 Rachel Road");
            expect(route.name).to.equal("Ride to work");
            expect(route.length).to.equal(5000);
        });
    });
    describe("InexperiencedRoute", () => {
        it("should be constructed correctly", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            const inexperiencedRoute = new InexperiencedRoute(obj);
            expect(moment(inexperiencedRoute.arrivalDateTime).isSame(obj.arrivalDateTime)).to.be.true;
            expect(inexperiencedRoute.id).to.equal(321, "ID is wrong! expected 321, got " +
                inexperiencedRoute.id);
            expect(inexperiencedRoute.owner).to.equal(123, "Owner is wrong! expected 123, got " +
                inexperiencedRoute.owner);
            expect(inexperiencedRoute.radius).to.equal(200, "Radius is wrong! expected 200, got " +
                inexperiencedRoute.radius);
            expect(inexperiencedRoute.startPoint).to.eql([0, 0]);
            expect(inexperiencedRoute.endPoint).to.eql([1, 1]);
            expect(inexperiencedRoute.notifyOwner).to.equal(false);
            expect(inexperiencedRoute.startPointName).to.equal(obj.startPointName);
            expect(inexperiencedRoute.endPointName).to.equal(obj.endPointName);
            expect(inexperiencedRoute.name).to.equal(obj.name);
            expect(inexperiencedRoute.length).to.equal(obj.length);
        });
        it("should throw an error if startPoint is 1D", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a 2D start point");
        });
        it("should throw an error if startPoint is 3D", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0, 0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a 2D start point");
        });
        it("should throw an error if endPoint is 1D", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a 2D end point");
        });
        it("should throw an error if endPoint is 3D", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a 2D end point");
        });
        it("should make a sensible name if none is given", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 100,
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            const inexperiencedRoute = new InexperiencedRoute(obj);
            expect(inexperiencedRoute.name).to.equal("33 Angel Ave to 66 Devil Drive");
        });
        it("should throw an error if there is no length", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a length");
        });
        it("should throw an error if there is no startPointName", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                endPointName: "66 Devil Drive",
                id: 321,
                length: 1000,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires a startPointName");
        });
        it("should throw an error if there is no endPointName", () => {
            const obj = {
                arrivalDateTime: "2017-09-08T13:00:00+00",
                endPoint: [1, 1],
                id: 321,
                length: 1000,
                name: "The hill from hell",
                notifyOwner: false,
                owner: 123,
                radius: 200,
                startPoint: [0, 0],
                startPointName: "33 Angel Ave",
            };
            expect(() => {
                return new InexperiencedRoute(obj);
            }).to.throw("400:InexperiencedRoute requires an endPointName");
        });
        it("should be constructed correctly from an SQL row", () => {
            const row = {
                arrivaldatetime: "2017-09-09T13:00:00+00",
                endpoint: "POINT(1 1)",
                endpointname: "36 Angus Avenue",
                id: 321,
                length: 1234,
                name: "Ride to work",
                notifyowner: false,
                owner: 123,
                radius: 200,
                startpoint: "POINT(0 0)",
                startpointname: "92 Riley Road",
            };
            const inexperiencedRoute = InexperiencedRoute.fromSQLRow(row);
            expect(moment(inexperiencedRoute.arrivalDateTime).isSame(row.arrivaldatetime)).to.be.true;
            expect(inexperiencedRoute.id).to.equal(321, "ID is wrong! expected 321, got " +
                inexperiencedRoute.id);
            expect(inexperiencedRoute.owner).to.equal(123, "Owner is wrong! expected 123, got " +
                inexperiencedRoute.owner);
            expect(inexperiencedRoute.startPoint).to.eql([0, 0]);
            expect(inexperiencedRoute.endPoint).to.eql([1, 1]);
            expect(inexperiencedRoute.notifyOwner).to.equal(false);
            expect(inexperiencedRoute.name).to.equal("Ride to work");
            expect(inexperiencedRoute.length).to.equal(1234);
            expect(inexperiencedRoute.startPointName).to.equal("92 Riley Road");
            expect(inexperiencedRoute.endPointName).to.equal("36 Angus Avenue");
        });
    });
    describe("User", () => {
        it("should be constructed", () => {
            const data = {
                email: "test@example.com",
                firstname: "Test",
                id: "abcd",
                surname: "User",
            };
            const user = new User(data);
            expect(user.id).to.equal("abcd");
            expect(user.firstname).to.equal("Test");
            expect(user.surname).to.equal("User");
            expect(user.email).to.equal("test@example.com");
        });
        it("should be constructed without an id", () => {
            const data = {
                email: "test@example.com",
                firstname: "Test",
                surname: "User",
            };
            const user = new User(data);
            expect(user.id).to.be.undefined;
            expect(user.firstname).to.equal("Test");
            expect(user.surname).to.equal("User");
            expect(user.email).to.equal("test@example.com");
        });
        it("should error if no first name is given", () => {
            const data = {
                email: "test@example.com",
                firstname: " ",
                id: "abcd",
                surname: "User",
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a first name");
        });
        it("should error if no surname is given", () => {
            const data = {
                email: "test@example.com",
                firstname: "Test",
                id: "abcd",
                surname: " ",
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires a surname");
        });
        it("should error if no email is given", () => {
            const data = {
                email: "",
                firstname: "Test",
                id: "abcd",
                surname: "User",
            };
            expect(() => {
                return new User(data);
            }).to.throw("User object requires an email");
        });
        it("should be constructed from full data", () => {
            const data = {
                bio: "I'm a really fast cyclist",
                distance: 123321,
                email: "test@example.com",
                firstname: "Test",
                helpedCount: 13,
                id: "abcd",
                joined: 1234567,
                photo: "www.example.com/image.jpg",
                preferences: {
                    rideDifficulty: "balanced",
                    units: "miles",
                },
                rating: 7.5,
                surname: "User",
                usersHelped: 21,
            };
            const user = new User(data);
            expect(user.id).to.equal("abcd");
            expect(user.firstname).to.equal("Test");
            expect(user.surname).to.equal("User");
            expect(user.email).to.equal("test@example.com");
            expect(user.bio).to.equal("I'm a really fast cyclist");
            expect(user.photo).to.equal("www.example.com/image.jpg");
            expect(user.joined).to.equal(1234567);
            expect(user.usersHelped).to.equal(21);
            expect(user.helpedCount).to.equal(13);
            expect(user.distance).to.equal(123321);
            expect(user.rating).to.equal(7.5);
            expect(user.preferences.rideDifficulty).to.equal("balanced");
            expect(user.preferences.units).to.equal("miles");
        });
        it("should be constructed from a postgres row(ish) object", () => {
            const row = {
                email: "test@example.com",
                firstname: "Test",
                id: "abcd",
                preferences_difficulty: "quiet",
                preferences_units: "kilometers",
                profile_bio: "I'm a really fast cyclist",
                profile_distance: 5000,
                profile_help_count: 21,
                profile_helped_count: 12,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                profile_rating_sum: 100,
                surname: "User",
            };
            const user = User.fromSQLRow(row);
            expect(user.firstname).to.equal("Test");
            expect(user.surname).to.equal("User");
            expect(user.email).to.equal("test@example.com");
            expect(user.bio).to.equal("I'm a really fast cyclist");
            expect(user.photo).to.equal("www.example.com/image.jpg");
            expect(user.joined).to.equal(1234567);
            expect(user.usersHelped).to.equal(21);
            expect(user.helpedCount).to.equal(12);
            expect(user.distance).to.equal(5000);
            expect(user.rating).to.equal(100 / 21);
            expect(user.preferences.rideDifficulty).to.equal("quiet");
            expect(user.preferences.units).to.equal("kilometers");
        });
        it("should not leak private data when made into a UserProfile", () => {
            const row = {
                email: "test@example.com",
                firstname: "Test",
                id: "abcd",
                jwt_secret: "secret",
                profile_bio: "I'm a really fast cyclist",
                profile_helped: 21,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
                surname: "User",
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
                firstname: "Test",
                id: "abcd",
                jwt_secret: "secret",
                profile_bio: "I'm a really fast cyclist",
                profile_helped: 21,
                profile_joined: 1234567,
                profile_photo: "www.example.com/image.jpg",
                pwh: new Buffer("test"),
                rounds: 5,
                salt: new Buffer("salt"),
                surname: "User",
            };
            const user = User.fromSQLRow(row).asUserSettings();
            expect(user).not.to.include.keys("bio");
            expect(user).not.to.include.keys("joined");
            expect(user).not.to.include.keys("helped");
            expect(user).not.to.include.keys("photo");
        });
    });
    describe("BuddyRequest", () => {
        let buddyRequestObject = {
            averageSpeed: 5,
            created: "2017-06-07T10:24:28.684Z",
            divorcePoint: [1, 1],
            divorcePointName: "99 Chris Crescent",
            divorceTime: "2017-06-08T12:00:28.684Z",
            experiencedRoute: 333,
            experiencedRouteName: "Ride to work",
            experiencedUser: 444,
            id: 111,
            inexperiencedRoute: 222,
            inexperiencedRouteName: "My First Ride",
            length: 101,
            meetingPoint: [0, 0],
            meetingPointName: "1 Shelly Street",
            meetingTime: "2017-06-08T11:34:28.684Z",
            owner: 555,
            reason: "",
            review: undefined,
            route: [[0, 0], [0, 1], [0, 2]],
            status: "pending",
            updated: "2017-06-07T10:24:28.684Z",
        };
        it("should be constructed correctly", () => {
            const buddyRequest = new BuddyRequest(buddyRequestObject);
            expect(buddyRequest.averageSpeed).to.equal(buddyRequestObject.averageSpeed);
            expect(buddyRequest.created).to.equal(buddyRequestObject.created);
            expect(buddyRequest.divorcePoint).to.eql(buddyRequestObject.divorcePoint);
            expect(buddyRequest.divorcePointName).to.eql(buddyRequestObject.divorcePointName);
            expect(buddyRequest.divorceTime).to.equal(buddyRequestObject.divorceTime);
            expect(buddyRequest.experiencedRoute).to.equal(buddyRequestObject.experiencedRoute);
            expect(buddyRequest.experiencedRouteName).to.equal(buddyRequestObject.experiencedRouteName);
            expect(buddyRequest.experiencedUser).to.equal(buddyRequestObject.experiencedUser);
            expect(buddyRequest.id).to.equal(buddyRequestObject.id);
            expect(buddyRequest.inexperiencedRoute).to.equal(buddyRequestObject.inexperiencedRoute);
            expect(buddyRequest.inexperiencedRouteName).to.equal(buddyRequestObject.inexperiencedRouteName);
            expect(buddyRequest.length).to.equal(buddyRequestObject.length);
            expect(buddyRequest.meetingPoint).to.eql(buddyRequestObject.meetingPoint);
            expect(buddyRequest.meetingPointName).to.equal(buddyRequestObject.meetingPointName);
            expect(buddyRequest.meetingTime).to.equal(buddyRequestObject.meetingTime);
            expect(buddyRequest.owner).to.equal(buddyRequestObject.owner);
            expect(buddyRequest.reason).to.equal(buddyRequestObject.reason);
            expect(buddyRequest.review).to.equal(0);
            expect(buddyRequest.route).to.equal(buddyRequestObject.route);
            expect(buddyRequest.status).to.equal(buddyRequestObject.status);
            expect(buddyRequest.updated).to.equal(buddyRequestObject.updated);
        });
        it("should throw an error if meetingPoint is 1D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.meetingPoint = [0];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a 2D meeting point");
        });
        it("should throw an error if meetingPoint is 3D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.meetingPoint = [0, 0, 0];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a 2D meeting point");
        });
        it("should throw an error if divorcePoint is 1D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.divorcePoint = [0];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a 2D divorce point");
        });
        it("should throw an error if divorcePoint is 3D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.divorcePoint = [0, 0, 0];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a 2D divorce point");
        });
        it("should throw an error if a route coordinate is 3D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.route = [[0, 0, 0], [0, 1], [0, 2]];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a route of 2D points");
        });
        it("should throw an error if a route coordinate is 1D", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.route = [[0, 0], [0, 1], [2]];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a route of 2D points");
        });
        it("should throw an error if the route is only 1 point long", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.route = [[0, 0]];
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a route of at least 2 points");
        });
        it("should throw an error if there is an invalid meetingTime", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.meetingTime = "about 10 this afternoon";
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a valid meeting time");
        });
        it("should throw an error if there is an invalid divorceTime", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.divorceTime = "about 11 this afternoon";
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a valid divorce time");
        });
        it("should throw an error if there the divorceTime is before the meetingTime", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.meetingTime = "2017-06-08T12:00:28.684Z";
            copy.divorceTime = "2017-06-08T11:34:28.684Z";
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:Divorce time is before Meeting time");
        });
        it("should throw an error if the status is not a valid status", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.status = "thinking about it";
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest requires a status of 'pending', 'accepted', 'rejected', " +
                "'canceled' or 'completed'");
        });
        it("should throw an error if the review is 6", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.review = 6;
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest review must be between 1 and 5");
        });
        it("should throw an error if the review is -2", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.review = -2;
            expect(() => {
                return new BuddyRequest(copy);
            }).to.throw("400:BuddyRequest review must be between 1 and 5");
        });
        for (let key in buddyRequestObject) {
            if (key !== "id" && key !== "reason" && key !== "review") {
                const copy = Object.assign({}, buddyRequestObject);
                copy[key] = undefined;
                let determiner = "aeiou".indexOf(key[0]) === -1 ? "a" : "an";
                it("should throw an error when constructed without " + determiner + " " + key, () => {
                    expect(() => {
                        return new BuddyRequest(copy);
                    }).to.throw("400:BuddyRequest requires " + determiner + " " + key);
                });
            }
        }
        it("should be created without any other entity id if status is 'canceled'", () => {
            const copy = Object.assign({}, buddyRequestObject);
            copy.owner = undefined;
            copy.inexperiencedRoute = undefined;
            copy.experiencedRoute = undefined;
            copy.experiencedUser = undefined;
            copy.status = "canceled";
            expect(() => {
                return new BuddyRequest(copy);
            }).not.to.throw();
        });
    });
});
