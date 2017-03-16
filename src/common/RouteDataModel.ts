import { lineStringToCoords } from "./database";
export class RouteDataModel {
    public static fromSQLRow(row) {
        return new RouteDataModel({
            arrivalTime: row.arrivaltime,
            departureTime: row.departuretime,
            id: row.id,
            owner: row.owner,
            route: lineStringToCoords(row.route),
        });
    }

    public arrivalTime: number;
    public departureTime: number;
    public id: number;
    public owner: number;
    public route: number[][];

    constructor(obj) {
        this.arrivalTime = obj.arrivalTime;
        this.departureTime = obj.departureTime;
        this.id = obj.id;
        this.owner = obj.owner;
        this.route = obj.route;
    }
}
