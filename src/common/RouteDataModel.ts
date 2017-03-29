import { lineStringToCoords } from "./database";
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

    public arrivalTime: number;
    public days: string[];
    public departureTime: number;
    public id: number;
    public owner: number;
    public route: number[][];

    constructor(obj) {
        if (obj.arrivalTime === undefined || obj.arrivalTime === null) {
            throw { ok: false, result: { error: "Route requires an arrival time", status: 400 } };
        } else if (obj.departureTime === undefined || obj.departureTime === null) {
            throw { ok: false, result: { error: "Route requires a departure time", status: 400 } };
        } else if (obj.arrivalTime < obj.departureTime) {
            throw { ok: false, result: { error: "Arrival time is before Departure time", status: 400 } };
        } else if (obj.route.length < 2) {
            throw { ok: false, result: { error: "Route requires at least 2 points", status: 400 } };
        } else if (Math.max(...obj.route.map(pair => { return pair.length; })) > 2) {
            throw {
                ok: false, result:
                {
                    error: "Coordinates in a Route should only have 2 items in them, [latitude, longitude]",
                    status: 400
                }
            };
        } else if (Math.min(...obj.route.map(pair => { return pair.length; })) < 2) {
            throw {
                ok: false, result:
                {
                    error: "Coordinates in a Route should have exactly 2 items in them, [latitude, longitude]",
                    status: 400
                }
            };
        } else if (obj.owner === undefined || obj.owner === null) {
            throw { ok: false, result: { error: "Route requires an owner", status: 400 } };
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
