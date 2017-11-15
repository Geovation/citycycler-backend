import { pointStringToCoords } from "./database";
export default class InexperiencedRoute {
    public static fromSQLRow(row) {
        return new InexperiencedRoute({
            arrivalDateTime: row.arrivaldatetime,
            deleted: row.deleted,
            endPoint: pointStringToCoords(row.endpoint),
            endPointName: row.endpointname,
            id: row.id,
            length: row.length,
            name: row.name,
            notifyOwner: row.notifyowner,
            owner: row.owner,
            radius: row.radius,
            reusable: row.reusable,
            startPoint: pointStringToCoords(row.startpoint),
            startPointName: row.startpointname,
        });
    }

    public arrivalDateTime: string;
    public deleted: boolean;
    public endPoint: [number, number];
    public endPointName: string;
    public id?: number;
    public owner?: string;
    public radius: number;
    public startPoint: [number, number];
    public startPointName: string;
    public length: number;
    public name: string;
    public notifyOwner: boolean;
    public reusable: boolean;

    constructor(obj) {
        if (!obj.startPoint || obj.startPoint.length !== 2 ) {
            throw new Error("400:InexperiencedRoute requires a 2D start point");
        } else if (!obj.endPoint || obj.endPoint.length !== 2 ) {
            throw new Error("400:InexperiencedRoute requires a 2D end point");
        } else if (obj.startPointName === undefined || obj.startPointName === null) {
            throw new Error("400:InexperiencedRoute requires a startPointName");
        } else if (obj.endPointName === undefined || obj.endPointName === null) {
            throw new Error("400:InexperiencedRoute requires an endPointName");
        } else if (obj.length === undefined || obj.length === null) {
            throw new Error("400:InexperiencedRoute requires a length");
        } else if (!obj.name) {
            obj.name = obj.startPointName + " to " + obj.endPointName;
        } else if (obj.radius <= 0) {
            throw new Error("400:Radius must be positive");
        } else if (typeof obj.reusable === "undefined") {
            obj.reusable = false;
        } else if (typeof obj.deleted === "undefined") {
            obj.deleted = false;
        }
        this.arrivalDateTime = obj.arrivalDateTime;
        this.deleted = obj.deleted;
        this.startPoint = obj.startPoint;
        this.startPointName = obj.startPointName;
        this.endPoint = obj.endPoint;
        this.endPointName = obj.endPointName;
        this.id = obj.id;
        this.owner = obj.owner;
        this.radius = obj.radius;
        this.length = obj.length;
        this.name = obj.name;
        this.notifyOwner = obj.notifyOwner;
        this.reusable = obj.reusable;
    }
}
