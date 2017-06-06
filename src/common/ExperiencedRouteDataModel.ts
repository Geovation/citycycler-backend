import { lineStringToCoords } from "./database";
import * as moment from "moment";
export default class ExperiencedRoute {
    public static fromSQLRow(row) {
        return new ExperiencedRoute({
            arrivalTime: row.arrivaltime,
            days: row.days,
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
        if (obj.arrivalTime === undefined) {
            throw new Error("400:ExperiencedRoute requires a valid arrival time");
        } else if (obj.departureTime === undefined) {
            throw new Error("400:ExperiencedRoute requires a valid departure time");
        }
        let arrivalTime = moment("2000-01-01T" + obj.arrivalTime);
        let departureTime = moment("2000-01-01T" + obj.departureTime);
        if (!arrivalTime.isValid()) {
            throw new Error("400:ExperiencedRoute requires a valid arrival time");
        } else if (!departureTime.isValid()) {
            throw new Error("400:ExperiencedRoute requires a valid departure time");
        } else if (arrivalTime.isBefore(departureTime)) {
            throw new Error("400:Arrival time is before Departure time");
        } else if (obj.route.length < 2) {
            throw new Error("400:ExperiencedRoute requires at least 2 points");
        } else if (Math.max(...obj.route.map(pair => { return pair.length; })) > 2) {
            throw new Error("400:Coordinates in a ExperiencedRoute should only have 2 items in them, " +
                "[latitude, longitude]");
        } else if (Math.min(...obj.route.map(pair => { return pair.length; })) < 2) {
            throw new Error("400:Coordinates in a ExperiencedRoute should have exactly 2 items in them, " +
                "[latitude, longitude]");
        } else if (obj.owner === undefined || obj.owner === null) {
            throw new Error("400:ExperiencedRoute requires an owner");
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
}
