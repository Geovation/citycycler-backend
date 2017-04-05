import { pointStringToCoords } from "./database";
export default class RouteQuery {
    public static fromSQLRow(row) {
        // Convert the bitmasked int into an array of days
        const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        /* tslint:disable no-bitwise */
        const daysArray = daysOfWeek.filter((day, i) => {
            return row.days & 1 << i;
        });
        /* tslint:enable no-bitwise */
        return new RouteQuery({
            arrivalTime: row.arrivalTime,
            days: daysArray,
            endPoint: pointStringToCoords(row.endPoint),
            id: row.id,
            owner: row.owner,
            radius: row.radius,
            startPoint: pointStringToCoords(row.startPoint),
        });
    }

    public arrivalTime: number;
    public days?: string[];
    public endPoint: [number, number];
    public id?: number;
    public owner?: number;
    public radius: number;
    public startPoint: [number, number];

    constructor(obj) {
        if (!obj.startPoint || obj.startPoint.length !== 2 ) {
            throw "400:RouteQuery requires a 2D start point";
        } else if (!obj.endPoint || obj.endPoint.length !== 2 ) {
            throw "400:RouteQuery requires a 2D end point";
        }
        if (!obj.days) {
            obj.days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        }
        this.arrivalTime = obj.arrivalTime;
        this.days = obj.days;
        this.startPoint = obj.startPoint;
        this.endPoint = obj.endPoint;
        this.id = obj.id;
        this.owner = obj.owner;
        this.radius = obj.radius;
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
