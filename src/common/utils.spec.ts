/* tslint:disable */
import * as Database from "./database";
import { RouteDataModel } from "./RouteDataModel";
import * as chai from "chai";
import * as logger from "winston";

const expect = chai.expect;

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
            }).to.throw("Input is not a Linestring.");
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
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            }
            const route = new RouteDataModel(obj);
            expect(route.arrivalTime).to.equal(1234, "Arrival time is wrong! expected 1234, got " + route.arrivalTime);
            expect(route.departureTime).to.equal(1000, "Departure time is wrong! expected 1000, got " +
                route.departureTime);
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
        });
        it("should throw an error if the arrival is before departure", () => {
            const obj = {
                arrivalTime: 999,
                departureTime: 1000,
                id: 321,
                owner: 123,
                route: [[0, 0], [1, 1], [2, 2]],
            }
            expect(() => {
                const route = new RouteDataModel(obj);
            }).to.throw("Arrival time is before Departure time");
        });
        it("should be constructed correctly from an SQL row", () => {
            const row = {
                arrivaltime: 1234,
                departuretime: 1000,
                id: 321,
                owner: 123,
                route: "LINESTRING(0 0,1 1,2 2)",
            }
            const route = RouteDataModel.fromSQLRow(row);
            expect(route.arrivalTime).to.equal(1234, "Arrival time is wrong! expected 1234, got " + route.arrivalTime);
            expect(route.departureTime).to.equal(1000, "Departure time is wrong! expected 1000, got " +
                route.departureTime);
            expect(route.id).to.equal(321, "ID is wrong! expected 321, got " + route.id);
            expect(route.owner).to.equal(123, "Owner is wrong! expected 123, got " + route.owner);
            expect(route.route).to.eql([[0, 0], [1, 1], [2, 2]]);
        });
    });
});
