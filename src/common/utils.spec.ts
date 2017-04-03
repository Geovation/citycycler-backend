import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import * as chai from "chai";
import * as mocha from "mocha";

// const before = mocha.before;
// const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;
const expect = chai.expect;
const assert = chai.assert;
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
            try {
                Database.lineStringToCoords(lineString);
                assert.fail(0, 1, "lineStringToCoords should have thrown an error. Instead got: " +
                    JSON.stringify(Database.lineStringToCoords(lineString)));
            } catch (err) {
                expect(err).to.equal("Input is not a Linestring");
            }
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
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err).to.equal("400:Route requires an arrival time");
            }
        });
        it("should throw an error if there is no departure time", () => {
            const obj = {
                arrivalTime: 999,
                days: ["tuesday", "sunday"],
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err).to.equal("400:Route requires a departure time");
            }
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
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err).to.equal("400:Arrival time is before Departure time");
            }
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
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err).to.equal("400:Route requires at least 2 points");
            }
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
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err)
                    .to.equal("400:Coordinates in a Route should only have 2 items in them, [latitude, longitude]");
            }
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
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err)
                    .to.equal("400:Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]");
            }
        });
        it("should throw an error if there is no owner", () => {
            const obj = {
                arrivalTime: 1999,
                days: ["tuesday", "sunday"],
                departureTime: 1000,
                id: 321,
                route: [[0, 0], [1, 1], [2, 2]],
            };
            try {
                const route = new RouteDataModel(obj);
                assert.fail(0, 1, "RouteDataModel constructor should have thrown an error. Instead got: " +
                    JSON.stringify(route));
            } catch (err) {
                expect(err).to.equal("400:Route requires an owner");
            }
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
});
