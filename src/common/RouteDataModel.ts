import { lineStringToCoords } from "./database";
import * as moment from "moment";
export class RouteDataModel {
    public static fromSQLRow(row) {
        // Convert the bitmasked int into an array of days
        const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        /* tslint:disable no-bitwise */
        const daysArray = daysOfWeek.filter((day, i) => {
            return row.days & 1 << i;
        });
        /* tslint:enable no-bitwise */
        return new RouteDataModel({
            arrivalTime: row.arrivaltime,
            days: daysArray,
            departureTime: row.departuretime,
            id: row.id,
            owner: row.owner,
            route: lineStringToCoords(row.route),
        });
    }

    public arrivalTime: string;
    public days: string[];
    public departureTime: string;
    public id: number;
    public owner: number;
    public route: number[][];

    constructor(obj) {
        let arrivalTime = moment("2000-01-01T" + obj.arrivalTime);
        let departureTime = moment("2000-01-01T" + obj.departureTime);
        if (!arrivalTime.isValid()) {
            throw new Error("400:Route requires a valid arrival time");
        } else if (!departureTime.isValid()) {
            throw new Error("400:Route requires a valid departure time");
        } else if (arrivalTime.isBefore(departureTime)) {
            throw new Error("400:Arrival time is before Departure time");
        } else if (obj.route.length < 2) {
            throw new Error("400:Route requires at least 2 points");
        } else if (Math.max(...obj.route.map(pair => { return pair.length; })) > 2) {
            throw new Error("400:Coordinates in a Route should only have 2 items in them, [latitude, longitude]");
        } else if (Math.min(...obj.route.map(pair => { return pair.length; })) < 2) {
            throw new Error("400:Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]");
        } else if (obj.owner === undefined || obj.owner === null) {
            throw new Error("400:Route requires an owner");
        }
        if (!obj.days) {
            obj.days = [];
        }
        this.arrivalTime = obj.arrivalTime;
        this.days = obj.days;
        this.departureTime = obj.departureTime;
        this.id = obj.id;
        this.owner = obj.owner;
        this.route = obj.route;
    }

    // Convert an array of days into the bitmasked integer form
    /* tslint:disable no-bitwise */
    public getDaysBitmask = (): number => {
        const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        return this.days.map((day) => {
            return 1 << daysOfWeek.indexOf(day);
        }).reduce((days, day) => {
            return days | day;
        }, 0);
    }
    /* tslint:enable no-bitwise */
}
