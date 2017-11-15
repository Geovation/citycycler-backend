import { lineStringToCoords } from "./database";
import * as moment from "moment";
export default class ExperiencedRoute {
    public static fromSQLRow(row) {
        return new ExperiencedRoute({
            arrivalTime: row.arrivaltime,
            days: row.days,
            deleted: row.deleted,
            departureTime: row.departuretime,
            endPointName: row.endpointname,
            id: row.id,
            length: row.length,
            name: row.name,
            owner: row.owner,
            route: lineStringToCoords(row.route),
            startPointName: row.startpointname,
        });
    }

    public arrivalTime: string;
    public days: string[];
    public deleted: boolean;
    public departureTime: string;
    public endPointName: string;
    public id: number;
    public length: number;
    public name: string;
    public owner: string;
    public route: number[][];
    public startPointName: string;

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
        } else if (obj.startPointName === undefined || obj.startPointName === null) {
            throw new Error("400:ExperiencedRoute requires a startPointName");
        } else if (obj.endPointName === undefined || obj.endPointName === null) {
            throw new Error("400:ExperiencedRoute requires an endPointName");
        } else if (obj.length === undefined || obj.length === null) {
            throw new Error("400:ExperiencedRoute requires a length");
        } else if (typeof obj.deleted === "undefined") {
            obj.deleted = false;
        }
        if (!obj.days) {
            obj.days = [];
        }
        if (!obj.name) {
            obj.name = obj.startPointName + " to " + obj.endPointName;
        }
        this.arrivalTime = obj.arrivalTime;
        this.days = obj.days;
        this.deleted = obj.deleted;
        this.departureTime = obj.departureTime;
        this.endPointName = obj.endPointName;
        this.id = obj.id;
        this.length = obj.length;
        this.name = obj.name;
        this.owner = obj.owner;
        this.route = obj.route;
        this.startPointName = obj.startPointName;
    }
}
